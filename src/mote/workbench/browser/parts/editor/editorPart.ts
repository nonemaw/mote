import { IWorkbenchLayoutService, Parts } from 'mote/workbench/services/layout/browser/layoutService';
import { $, Dimension } from 'vs/base/browser/dom';
import { Emitter } from 'vs/base/common/event';
import { Part } from 'mote/workbench/browser/part';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IEditorPane } from 'mote/workbench/common/editor';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { assertIsDefined } from 'vs/base/common/types';
import { ThemedStyles } from 'mote/base/common/themes';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ILogService } from 'vs/platform/log/common/log';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { EmptyHolder } from './emptyHolder';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { EditorPanes } from 'mote/workbench/browser/parts/editor/editorPanes';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { IEditorResolverService } from 'mote/workbench/services/editor/common/editorResolverService';
import { editorBackground } from 'mote/platform/theme/common/themeColors';

export class EditorPart extends Part implements IEditorService {

	declare readonly _serviceBrand: undefined;

	get minimumWidth(): number {
		return 400;
	}

	get maximumWidth(): number {
		return Number.POSITIVE_INFINITY;
	}

	get minimumHeight(): number {
		return 400;
	}

	get maximumHeight(): number {
		return Number.POSITIVE_INFINITY;
	}



	//#region Events

	private readonly _onDidLayout = this._register(new Emitter<Dimension>());
	readonly onDidLayout = this._onDidLayout.event;

	private container: HTMLElement | undefined;

	private editorPanes: EditorPanes;

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ILogService logService: ILogService,
		@IEditorResolverService private readonly editorResolverService: IEditorResolverService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(Parts.EDITOR_PART, { hasTitle: false }, themeService, layoutService);
		this.container = document.createElement('div');
		this.editorPanes = this._register(this.instantiationService.createInstance(EditorPanes, this.container));
	}

	async openEditorWithResource(editor: IResourceEditorInput): Promise<IEditorPane | undefined> {
		const input = await this.editorResolverService.resolveEditor(editor);
		return this.openEditor(input);
	}

	openEditor(editor: EditorInput): Promise<IEditorPane | undefined> {
		return this.editorPanes.openEditor(editor, {});
	}

	closeEditor(editor?: EditorInput | undefined): Promise<boolean> {
		this.editorPanes.closeEditor(editor);
		return Promise.resolve(true);
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


	override createContentArea(parent: HTMLElement) {
		// Container
		this.element = parent;
		this.element.style.backgroundColor = this.getColor(editorBackground) || '';

		this.container!.classList.add('content');
		parent.appendChild(this.container!);

		new EmptyHolder(this.container!);

		return this.container;
	}

	createCover(parent: HTMLElement) {
		const coverDomNode = $('');
		coverDomNode.style.height = '100px';
		parent.append(coverDomNode);
	}

	override updateStyles(): void {
		// Part container
		const container = assertIsDefined(this.getContainer());

		container.style.height = '100%';
	}

	override layout(width: number, height: number, top: number, left: number): void {

		// Layout contents
		const contentAreaSize = super.layoutContents(width, height).contentSize;

		// Layout editor container
		this.doLayout(Dimension.lift(contentAreaSize), top, left);
	}

	private doLayout(dimension: Dimension, top: number, left: number): void {
		this.editorPanes.layout(dimension);
	}

	toJSON(): object {
		return {
			type: Parts.EDITOR_PART
		};
	}
}

registerSingleton(IEditorService, EditorPart);
