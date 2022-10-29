import RecordStore from 'mote/platform/store/common/recordStore';
import { IEditorOptions, IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { EditorPane } from 'mote/workbench/browser/parts/editor/editorPane';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { DocumentEditorInput } from 'mote/workbench/contrib/documentEditor/browser/documentEditorInput';
import { Dimension, $, } from 'vs/base/browser/dom';
import { BugIndicatingError } from 'vs/base/common/errors';
import { Disposable, IDisposable, } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IQuickMenuService } from 'mote/workbench/services/quickmenu/browser/quickmenu';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';
import { TextSelectionMode } from 'mote/editor/common/core/selectionUtils';
import { IAction } from 'vs/base/common/actions';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { ThemedStyles } from 'mote/base/common/themes';
import { IEditorResolverService } from 'mote/workbench/services/editor/common/editorResolverService';
import { MoteEditorWidget } from 'mote/editor/browser/widget/moteEditorWidget';
import { assertIsDefined } from 'vs/base/common/types';
import { TextSelection } from 'mote/editor/common/core/rangeUtils';
import { IMoteEditor } from 'mote/editor/browser/editorBrowser';


export class DocumentEditor extends EditorPane {

	static ID = 'documentEditor';

	//private editorContainer!: HTMLElement;
	private onChangeListener: IDisposable | undefined = undefined;

	private editorControl: IMoteEditor | undefined = undefined;

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IQuickMenuService private quickMenuService: IQuickMenuService,
	) {
		super(DocumentEditor.ID, themeService);
	}

	protected createEditor(parent: HTMLElement): void {
		// Create editor control
		//this.editorContainer = parent;
		this.editorControl = this._register(this.instantiationService.createInstance(
			MoteEditorWidget, parent, {}, {}));
	}

	createCover(parent: HTMLElement) {
		const coverDomNode = $('');
		coverDomNode.style.height = '100px';
		parent.append(coverDomNode);
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined) {
		if (!(input instanceof DocumentEditorInput)) {
			throw new BugIndicatingError('ONLY DocumentEditorInput is supported');
		}

		await super.setInput(input, options);

		const control = assertIsDefined(this.editorControl);
		control.setStore(input.pageStore);

		if (this.onChangeListener) {
			this.onChangeListener.dispose();
		}

		this.onChangeListener = this._register(control.onDidChangeSelection((e) => this.showQuickMenu(e, input.pageStore.getContentStore())));
	}

	private showQuickMenu(e: TextSelection, contentStore: RecordStore) {
		if (e.startIndex === e.endIndex) {
			return;
		}
		if (e.lineNumber < 0) {
			return;
		}
		const control = assertIsDefined(this.editorControl);
		const actions: IAction[] = [];
		actions.push({
			id: 'quick.link',
			label: 'Link',
			tooltip: 'Add link',
			run: () => control.trigger('quickmenu', 'decorate', ['a', 'https://moteapp.io/page/b95227c3-e623-4b8c-a4a1-b843b139a4d1']),
			enabled: true,
			class: '',
			dispose: () => { }
		});
		actions.push({
			id: 'quick.bold',
			label: 'B',
			tooltip: 'Bold',
			run: () => control.trigger('quickmenu', 'decorate', ['b']),
			enabled: true,
			class: '',
			dispose: () => { }
		});

		actions.push({
			id: 'quick.italic',
			label: 'I',
			tooltip: 'Italic',
			run: () => control.trigger('quickmenu', 'decorate', ['i']),
			enabled: true,
			class: 'italic',
			dispose: () => { }
		});
		actions.push({
			id: 'quick.underline',
			label: 'U',
			tooltip: 'Underline',
			run: () => control.trigger('quickmenu', 'decorate', ['_']),
			enabled: true,
			class: 'underline',
			dispose: () => { }
		});

		actions.push({
			id: 'quick.strikethrough',
			label: 'ab',
			tooltip: 'Strike-through',
			run: () => control.trigger('quickmenu', 'decorate', ['s']),
			enabled: true,
			class: 'line-through',
			dispose: () => { }
		});

		actions.push({
			id: 'quick.code',
			label: '< >',
			tooltip: 'Mark as code',
			run: () => control.trigger('quickmenu', 'decorate', ['c']),
			enabled: true,
			class: '',
			dispose: () => { }
		});

		this.quickMenuService.showQuickMenu({
			getActions: () => actions,
			state: {
				selection: e,
				store: StoreUtils.createStoreForLineNumber(e.lineNumber, contentStore).getTitleStore(),
				mode: TextSelectionMode.Editing
			}
		});
	}

	getTitleStyle(): CSSProperties {
		return {
			color: ThemedStyles.regularTextColor.dark,
			fontWeight: 700,
			lineHeight: 1.2,
			fontSize: '40px',
			cursor: 'text',
			display: 'flex',
			alignItems: 'center',
		};
	}

	getSafePaddingLeftCSS(padding: number) {
		return `calc(${padding}px + env(safe-area-inset-left))`;
	}

	getSafePaddingRightCSS(padding: number) {
		return `calc(${padding}px + env(safe-area-inset-right))`;
	}

	layout(dimension: Dimension): void {
		this.editorControl?.layout(dimension);
	}
}


export class DocumentEditorResolverContribution extends Disposable {
	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
	) {
		super();


		editorResolverService.registerEditor(
			'page',
			{
				id: DocumentEditorInput.ID
			},
			(editor) => this.createDocumentEditorInput(editor)
		);
	}

	private async createDocumentEditorInput(input: IResourceEditorInput): Promise<DocumentEditorInput> {
		return Promise.resolve(new DocumentEditorInput(input.store));
	}
}
