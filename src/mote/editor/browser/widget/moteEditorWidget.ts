import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import * as editorBrowser from 'mote/editor/browser/editorBrowser';
import * as editorCommon from 'mote/editor/common/editorCommon';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { IDimension } from 'vs/editor/common/core/dimension';
import { Emitter, Event, EventDeliveryQueue } from 'vs/base/common/event';
import BlockStore from 'mote/platform/store/common/blockStore';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { EditorView, IOverlayWidgetData } from 'mote/editor/browser/editorView';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { OutgoingViewEventKind } from 'mote/editor/common/viewEventDispatcher';
import { TextSelection } from 'mote/editor/common/core/rangeUtils';
import { EditorExtensionsRegistry, IEditorContributionDescription } from 'mote/editor/browser/editorExtensions';
import { EditorConfiguration, IEditorConstructionOptions } from 'mote/editor/browser/config/editorConfiguration';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';

let EDITOR_ID = 0;

export interface IMoteEditorWidgetOptions {
	/**
	 * Contributions to instantiate.
	 * Defaults to EditorExtensionsRegistry.getEditorContributions().
	 */
	contributions?: IEditorContributionDescription[];
}

class ModelData implements IDisposable {

	constructor(
		public readonly store: BlockStore,
		public readonly viewController: ViewController,
		public readonly view: EditorView,
		public readonly hasRealView: boolean,
		public readonly listenersToRemove: DisposableStore
	) {

	}

	dispose() {
		this.listenersToRemove.dispose();
	}
}

export class MoteEditorWidget extends Disposable implements editorBrowser.IMoteEditor {

	private readonly _deliveryQueue = new EventDeliveryQueue();

	private readonly _onDidDispose: Emitter<void> = this._register(new Emitter<void>());
	public readonly onDidDispose: Event<void> = this._onDidDispose.event;

	private readonly _onDidChangeSelection: Emitter<TextSelection> = this._register(new Emitter<TextSelection>({ deliveryQueue: this._deliveryQueue }));
	public readonly onDidChangeSelection: Event<TextSelection> = this._onDidChangeSelection.event;

	private readonly id: number;
	private readonly configuration: IEditorConfiguration;

	protected contributions: { [key: string]: editorCommon.IEditorContribution };

	private modelData: ModelData | null;

	private overlayWidgets: { [key: string]: IOverlayWidgetData };

	constructor(
		private readonly domElement: HTMLElement,
		options: Readonly<IEditorConstructionOptions>,
		moteEditorWidgetOptions: IMoteEditorWidgetOptions,
		@IInstantiationService private instantiationService: IInstantiationService,
	) {
		super();

		this.id = (++EDITOR_ID);
		this.modelData = null;
		this.overlayWidgets = {};
		this.contributions = {};

		this.configuration = this._register(this.createConfiguration());

		let contributions: IEditorContributionDescription[];
		if (Array.isArray(moteEditorWidgetOptions.contributions)) {
			contributions = moteEditorWidgetOptions.contributions;
		} else {
			contributions = EditorExtensionsRegistry.getEditorContributions();
		}

		for (const desc of contributions) {
			if (this.contributions[desc.id]) {
				onUnexpectedError(new Error(`Cannot have two contributions with the same id ${desc.id}`));
				continue;
			}
			try {
				const contribution = this.instantiationService.createInstance(desc.ctor, this);
				this.contributions[desc.id] = contribution;
			} catch (err) {
				onUnexpectedError(err);
			}
		}
	}

	setStore(store: BlockStore) {
		if (store === undefined) {
			return;
		}
		if (null === store && this.modelData === null) {
			return;
		}
		if (this.modelData && this.modelData.store === store) {
			// Current store is the new store
			return;
		}

		this.detachStore();
		this.attachStore(store);
	}

	getStore() {
		return this.modelData?.store || null;
	}

	private attachStore(store: BlockStore) {

		const viewController = new ViewController(this.configuration, store.getContentStore());

		const listenersToRemove = new DisposableStore();

		listenersToRemove.add(viewController.onEvent((e) => {
			switch (e.kind) {
				case OutgoingViewEventKind.SelectionChanged:
					this._onDidChangeSelection.fire(e.selection);
					break;
			}
		}));

		const [view, hasRealView] = this.createView(viewController, store);
		if (hasRealView) {
			this.domElement.appendChild(view.domNode.domNode);

			const keys = Object.keys(this.overlayWidgets);
			for (let i = 0, len = keys.length; i < len; i++) {
				const widgetId = keys[i];
				view.addOverlayWidget(this.overlayWidgets[widgetId]);
			}

			view.render(false, true);
		}

		this.modelData = new ModelData(store, viewController, view, hasRealView, listenersToRemove);
	}

	private detachStore() {
		if (!this.modelData) {
			return;
		}

		const removeDomNode = this.modelData.hasRealView ? this.modelData.view.domNode.domNode : null;

		if (removeDomNode && this.domElement.contains(removeDomNode)) {
			this.domElement.removeChild(removeDomNode);
		}

		this.modelData.dispose();
	}

	private createView(viewController: ViewController, pageStore: BlockStore): [EditorView, boolean] {

		const editorView = this.instantiationService.createInstance(
			EditorView, this.configuration, viewController, pageStore);
		return [editorView, true];
	}

	trigger(source: string | null | undefined, handlerId: string, payload: any): void {
		payload = payload || {};
		switch (handlerId) {
			case editorCommon.Handler.Decorate:
				this.modelData?.viewController.decorate(payload);
				return;
		}
	}

	getId(): string {
		return this.getEditorType() + ':' + this.id;
	}
	getEditorType(): string {
		return editorCommon.EditorType.IDocumentEditor;
	}

	public override dispose(): void {
		const keys = Object.keys(this.contributions);
		for (let i = 0, len = keys.length; i < len; i++) {
			const contributionId = keys[i];
			this.contributions[contributionId].dispose();
		}
		this.contributions = {};
		this.overlayWidgets = {};

		this._onDidDispose.fire();

		super.dispose();
	}

	addOverlayWidget(widget: editorBrowser.IOverlayWidget): void {
		const widgetData: IOverlayWidgetData = {
			widget: widget,
			position: widget.getPosition()
		};

		if (this.overlayWidgets.hasOwnProperty(widget.getId())) {
			console.warn('Overwriting an overlay widget with the same id.');
		}

		this.overlayWidgets[widget.getId()] = widgetData;
	}

	onHide(): void {
		throw new Error('Method not implemented.');
	}

	public getContribution<T extends editorCommon.IEditorContribution>(id: string): T | null {
		return <T>(this.contributions[id] || null);
	}

	layout(dimension?: IDimension | undefined): void {
		this.configuration.observeContainer(dimension);
		this.render(false);
	}
	focus(): void {
		throw new Error('Method not implemented.');
	}
	getSelection(): EditorSelection | null {
		throw new Error('Method not implemented.');
	}

	public render(forceRedraw: boolean = false): void {
		if (!this.modelData || !this.modelData.hasRealView) {
			return;
		}
		this.modelData.view.render(true, forceRedraw);
	}

	private createConfiguration() {
		return new EditorConfiguration({}, this.domElement);
	}
}
