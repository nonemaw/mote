import * as viewEvents from 'mote/editor/common/viewEvents';
import { Event } from 'vs/base/common/event';
import { TextSelection, TextSelectionMode } from 'mote/editor/common/core/selectionUtils';
import { Transaction } from 'mote/editor/common/core/transaction';
import BlockStore from 'mote/platform/store/common/blockStore';
import RecordStore from 'mote/platform/store/common/recordStore';
import * as segmentUtils from 'mote/editor/common/segmentUtils';
import { OutgoingViewEvent, SelectionChangedEvent, ViewEventDispatcher, ViewEventsCollector } from 'mote/editor/common/viewEventDispatcher';
import { textChange } from 'mote/editor/common/core/textChange';
import { collectValueFromSegment, IAnnotation, ISegment } from 'mote/editor/common/segmentUtils';
import { EditOperation } from 'mote/editor/common/core/editOperation';
import { DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT } from 'mote/editor/common/diffMatchPatch';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { keepLineTypes, textBasedTypes } from 'mote/editor/common/blockTypes';
import { Markdown } from 'mote/editor/common/markdown';
import { BugIndicatingError } from 'vs/base/common/errors';
import { Segment } from 'mote/editor/common/core/segment';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { Disposable } from 'vs/base/common/lifecycle';
import { ConfigurationChangedEvent } from 'mote/editor/common/config/editorOptions';
import { ViewLayout } from 'mote/editor/common/viewLayout/viewLayout';
import { BlockTypes } from 'mote/platform/store/common/record';

export interface ICommandDelegate {
	type(text: string): void;
	compositionType(text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): void;
}

export class ViewController extends Disposable {
	public readonly onEvent: Event<OutgoingViewEvent>;

	private selection: TextSelection;
	private readonly eventDispatcher: ViewEventDispatcher;
	private viewLayout!: ViewLayout;

	constructor(
		configuration: IEditorConfiguration,

		private readonly contentStore: RecordStore<string[]>,
	) {
		super();

		this.selection = { startIndex: -1, endIndex: -1, lineNumber: -2 };
		this.eventDispatcher = new ViewEventDispatcher();
		this.onEvent = this.eventDispatcher.onEvent;

		this._register(configuration.onDidChangeFast((e) => {
			try {
				const eventsCollector = this.eventDispatcher.beginEmitViewEvents();
				this.onConfigurationChanged(eventsCollector, e);
			} finally {
				this.eventDispatcher.endEmitViewEvents();
			}
		}));


	}

	public setViewLayout(viewLayout: ViewLayout) {
		this.viewLayout = viewLayout;
		this._register(this.viewLayout.onDidScroll((e) => {
			if (e.scrollTopChanged) {
				//this._tokenizeViewportSoon.schedule();
			}
			if (e.scrollTopChanged) {
				//this._viewportStart.invalidate();
			}
			this.eventDispatcher.emitSingleViewEvent(new viewEvents.ViewScrollChangedEvent(e));
			/*
			this.eventDispatcher.emitOutgoingEvent(new ScrollChangedEvent(
				e.oldScrollWidth, e.oldScrollLeft, e.oldScrollHeight, e.oldScrollTop,
				e.scrollWidth, e.scrollLeft, e.scrollHeight, e.scrollTop
			));
			*/
		}));
	}

	private onConfigurationChanged(eventsCollector: ViewEventsCollector, e: ConfigurationChangedEvent): void {
		console.log('emit ViewConfigurationChangedEvent');
		eventsCollector.emitViewEvent(new viewEvents.ViewConfigurationChangedEvent(e));
	}

	public addViewEventHandler(eventHandler: ViewEventHandler): void {
		this.eventDispatcher.addViewEventHandler(eventHandler);
	}

	public removeViewEventHandler(eventHandler: ViewEventHandler): void {
		this.eventDispatcher.removeViewEventHandler(eventHandler);
	}

	//#region command expose to editable

	public select(selection: TextSelection): void {
		this.withViewEventsCollector(eventsCollector => {
			this.setSelection(selection);
			eventsCollector.emitOutgoingEvent(new SelectionChangedEvent(selection));
		});
	}

	public decorate(annotation: IAnnotation): void {
		this.executeCursorEdit(eventsCollector => {
			const store = StoreUtils.createStoreForLineNumber(this.selection.lineNumber, this.contentStore);
			const updated = Segment.update({ selection: this.selection, store: store.getTitleStore(), mode: TextSelectionMode.Editing }, annotation);
			if (updated) {
				eventsCollector.emitViewEvent(new viewEvents.ViewLinesChangedEvent(this.selection.lineNumber, 1));
			}
		});
	}

	public updateProperties(data: any) {
		this.executeCursorEdit(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				const store = StoreUtils.createStoreForLineNumber(this.selection.lineNumber, this.contentStore);
				EditOperation.addUpdateOperationForStore(
					store.getPropertiesStore(),
					data,
					transaction
				);
			}, this.contentStore.userId);
		});
	}

	public insert(text: string): void {
		this.executeCursorEdit(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				const lineNumber = this.selection.lineNumber;
				const titleStore = this.getTitleStore();
				this._insert(eventsCollector, text, transaction, titleStore, this.selection, TextSelectionMode.Editing);
				// emit the line change event
				eventsCollector.emitViewEvent(new viewEvents.ViewLinesInsertedEvent(lineNumber, lineNumber));
			}, this.contentStore.userId);
		});
	}

	public type(text: string): void {
		this.executeCursorEdit(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				const titleStore = this.getTitleStore();
				this.onType(eventsCollector, titleStore, transaction, this.selection, text);
			}, this.contentStore.userId);
		});
	}

	public compositionType(text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): void {
		this.executeCursorEdit(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				const titleStore = this.getTitleStore();
				this.onType(eventsCollector, titleStore, transaction, this.selection, text);
			}, this.contentStore.userId);
		});
	}

	public backspace() {
		this.executeCursorEdit(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				const titleStore = this.getTitleStore();
				this.onBackspace(eventsCollector, titleStore, transaction, this.selection);
			}, this.contentStore.userId);
		});
	}

	public enter(): boolean {
		// We dont use executeCursorEdit because of some times user trigger this method
		// before the content store has any children
		this.withViewEventsCollector(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				let lineNumber: number;
				// create first child
				if (this.selection.lineNumber < 0) {
					let child: BlockStore = EditOperation.createBlockStore('text', transaction, this.contentStore);
					child = EditOperation.appendToParent(this.contentStore, child, transaction).child as BlockStore;
					lineNumber = 0;
				} else {
					let type = 'text';
					const lineStore = StoreUtils.createStoreForLineNumber(this.selection.lineNumber, this.contentStore);
					if (keepLineTypes.has(lineStore.getType() || '')) {
						// Some blocks required keep same styles in next line
						// Just like todo, list
						type = lineStore.getType()!;
					}
					let child: BlockStore = EditOperation.createBlockStore(type, transaction, this.contentStore);
					child = EditOperation.insertChildAfterTarget(
						this.contentStore, child, lineStore, transaction).child as BlockStore;
					lineNumber = StoreUtils.getLineNumberForStore(child, this.contentStore);
				}
				// emit the line change event
				eventsCollector.emitViewEvent(new viewEvents.ViewLinesInsertedEvent(lineNumber, lineNumber));
				this.setSelection({ startIndex: 0, endIndex: 0, lineNumber: lineNumber });
			}, this.contentStore.userId);
		});
		return true;
	}

	//#endregion

	/**
	 * The only way to set selection from outside is to use ViewController#select method
	 * setSelection is only works for internal usage
	 * @param selection
	 */
	private setSelection(selection: TextSelection) {
		if (selection.lineNumber < -1) {
			throw new BugIndicatingError('lineNumber should never be negative');
		}
		this.selection = Object.assign({}, this.selection);
		this.selection.startIndex = selection.startIndex;
		this.selection.endIndex = selection.endIndex;
		this.selection.lineNumber = selection.lineNumber ?? this.selection.lineNumber;
	}

	public getSelection() {
		return this.selection;
	}

	public isEmpty(lineNumber: number) {
		let titleStore: RecordStore;
		// header
		if (lineNumber === -1) {
			const pageStore = this.getPageStore();
			titleStore = pageStore.getTitleStore();
		} else {
			const store = StoreUtils.createStoreForLineNumber(lineNumber, this.contentStore);
			titleStore = store.getTitleStore();
		}
		const value: any[] = titleStore.getValue() || [];
		return value.length === 0;
	}

	private executeCursorEdit(callback: (eventsCollector: ViewEventsCollector) => void) {
		if (this.selection === null || this.selection.lineNumber < -1) {
			return;
		}
		const contents = this.contentStore.getValue() || [];
		if (this.selection.lineNumber >= contents.length) {
			// Bad case, should we throw a BugIndicatingError here?
			return;
		}
		const titleStore = this.getTitleStore();
		if (!titleStore.canEdit() || !titleStore.state.ready) {
			// we couldn't operate on it
			return;
		}
		this.withViewEventsCollector(callback);
	}

	private withViewEventsCollector<T>(callback: (eventsCollector: ViewEventsCollector) => T): T {
		try {
			const eventsCollector = this.eventDispatcher.beginEmitViewEvents();
			return callback(eventsCollector);
		} finally {
			this.eventDispatcher.endEmitViewEvents();
		}
	}

	private getTitleStore() {
		let titleStore: RecordStore;
		// header
		if (this.selection.lineNumber === -1) {
			const pageStore = this.getPageStore();
			titleStore = pageStore.getTitleStore();
		} else {
			const store = StoreUtils.createStoreForLineNumber(this.selection.lineNumber, this.contentStore);
			titleStore = store.getTitleStore();
		}
		return titleStore;
	}

	private getPageStore() {
		return this.contentStore.recordStoreParentStore as BlockStore;
	}

	//#region line handle

	/**
	 *
	 * @param eventsCollector
	 * @param store titleStore
	 * @param transaction
	 * @param selection
	 */
	private onBackspace(eventsCollector: ViewEventsCollector, store: RecordStore, transaction: Transaction, selection: TextSelection) {
		if (0 !== selection.startIndex || 0 !== selection.endIndex) {
			let newSelection: TextSelection;
			if (selection.startIndex === selection.endIndex) {
				newSelection = { startIndex: selection.startIndex - 1, endIndex: selection.endIndex, lineNumber: selection.lineNumber };
			} else {
				newSelection = selection;
			}
			this.delete(transaction, store, newSelection);
		} else {
			const blockStore = StoreUtils.getParentBlockStore(store);
			if (blockStore) {
				const record = blockStore.getValue();
				if (record) {
					if (textBasedTypes.has(record.type)) {
						EditOperation.turnInto(blockStore, BlockTypes.text as any, transaction);
						eventsCollector.emitViewEvent(new viewEvents.ViewLinesChangedEvent(selection.lineNumber, 1));
					} else {
						EditOperation.removeChild(this.contentStore, store, transaction);
						const deletedLineNumber = this.selection.lineNumber;
						const newLineNumber = this.selection.lineNumber - 1;
						if (this.selection.lineNumber > 0) {
							const prevStore = StoreUtils.createStoreForLineNumber(newLineNumber, this.contentStore);
							const content = collectValueFromSegment(prevStore.getTitleStore().getValue());
							this.setSelection({ startIndex: content.length, endIndex: content.length, lineNumber: newLineNumber });
						} else {
							// reset to uninitialized state, don't manually set it in other case, use setSelection instead
							this.selection.lineNumber = -1;
							this.selection.startIndex = -1;
							this.selection.endIndex = -1;
						}
						eventsCollector.emitViewEvent(new viewEvents.ViewLinesDeletedEvent(deletedLineNumber, deletedLineNumber));
					}
				}
			}
		}
	}

	private onType(eventsCollector: ViewEventsCollector, store: RecordStore, transaction: Transaction, selection: TextSelection, newValue: string) {
		const oldRecord = store.getValue();
		const content = segmentUtils.collectValueFromSegment(oldRecord);
		const diffResult = textChange(selection, content, newValue);

		let needChange = false;
		let startIndex = 0;
		let deleteFlag = false;

		for (const [op, txt] of diffResult) {
			switch (op) {
				case DIFF_INSERT:
					needChange = true;
					this._insert(
						eventsCollector,
						txt,
						transaction,
						store,
						{
							startIndex: startIndex,
							endIndex: startIndex,
							lineNumber: selection.lineNumber
						},
						TextSelectionMode.Editing
					);
					startIndex += txt.length;
					break;
				case DIFF_DELETE:
					needChange = true;
					deleteFlag = false;
					this.delete(
						transaction,
						store,
						{
							startIndex: startIndex,
							endIndex: startIndex + txt.length,
							lineNumber: selection.lineNumber
						},
					);
					break;
				default:
					if (DIFF_EQUAL === op) {
						startIndex += txt.length;
					}
			}
		}

		if (needChange) {

		}
		if (deleteFlag) {

		}
	}

	private _insert(eventsCollector: ViewEventsCollector, content: string, transaction: Transaction, store: RecordStore, selection: TextSelection, selectionMode: TextSelectionMode) {
		const userId = transaction.userId;
		if (TextSelectionMode.Editing !== selectionMode) {
			return;
		}

		this.delete(transaction, store, selection);

		if (content.length > 0) {
			const segment = segmentUtils.combineArray(content, []) as ISegment;

			const storeValue = store.getValue();

			const newSelection: TextSelection = {
				startIndex: selection.startIndex + content.length,
				endIndex: selection.endIndex + content.length,
				lineNumber: selection.lineNumber
			};

			this.setSelection(newSelection);

			EditOperation.addSetOperationForStore(
				store,
				segmentUtils.merge(storeValue, [segment], selection.startIndex),
				transaction
			);

			transaction.postSubmitActions.push(() => {
				const transaction = Transaction.create(userId);
				const contentChanged = Markdown.parse({
					delete: this.delete.bind(this),
					setSelection: this.setSelection.bind(this),
					store: store,
					transaction: transaction,
					selection: selection
				});
				if (contentChanged) {
					eventsCollector.emitViewEvent(new viewEvents.ViewLinesChangedEvent(selection.lineNumber, 1));
				}
				transaction.commit();
			});
		}
	}

	private delete(transaction: Transaction, store: RecordStore, selection: TextSelection) {
		if (selection.startIndex !== selection.endIndex) {
			const storeValue = store.getValue();
			const newRecord = segmentUtils.remove(storeValue, selection.startIndex, selection.endIndex);

			const newSelection: TextSelection = {
				startIndex: selection.startIndex,
				endIndex: selection.startIndex,
				lineNumber: selection.lineNumber
			};

			this.setSelection(newSelection);
			console.log('newSelection:', newSelection);


			EditOperation.addSetOperationForStore(store, newRecord, transaction);

			const rootStore = store.getRecordStoreAtRootPath();
			if ('block' === rootStore.table) {
				segmentUtils.slice(storeValue, selection.startIndex, selection.endIndex);
			}


		} else {
			this.setSelection(selection);
		}
	}

	//#endregion
}
