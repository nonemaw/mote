import * as dom from 'vs/base/browser/dom';
import { EditableHandler, EditableHandlerOptions } from 'mote/editor/browser/controller/editableHandler';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import BlockStore from 'mote/platform/store/common/blockStore';
import { segmentsToElement } from 'mote/editor/common/textSerialize';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IVisibleLine } from 'mote/editor/browser/view/viewLayer';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { IThemeService, Themable } from 'mote/platform/theme/common/themeService';
import { lightTextColor } from 'mote/platform/theme/common/themeColors';
import { IViewLineContributionDescription, ViewLineExtensionsRegistry } from 'mote/editor/browser/viewLineExtensions';

export class EmptyViewLine extends Disposable {

	private domNode: FastDomNode<HTMLElement> = createFastDomNode(document.createElement('div'));

	public readonly onClick = this._register(dom.createEventEmitter(this.domNode.domNode, 'click')).event;


	constructor(
		private readonly viewController: ViewController,
	) {
		super();
		this.domNode.setClassName('view-line');
		this.domNode.domNode.style.cursor = 'pointer';
		this.onClick((e) => this.viewController.enter());
	}

	renderLine() {
		this.domNode.domNode.innerText = 'Click to continue';
	}

	getDomNode() {
		return this.domNode.domNode;
	}
}

export class ViewLine implements IVisibleLine {
	public static readonly CLASS_NAME = 'view-line';

	private domNode: FastDomNode<HTMLElement> | null = null;

	constructor(
		private readonly viewContext: ViewContext,
		private readonly viewController: ViewController,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {

	}

	layoutLine(lineNumber: number): void {
		throw new Error('Method not implemented.');
	}

	onContentChanged(): void {
		throw new Error('Method not implemented.');
	}

	public getDomNode(): FastDomNode<HTMLElement> | null {
		return this.domNode;
	}

	public setDomNode(domNode: FastDomNode<HTMLElement>) {
		this.domNode = domNode;
	}

	public renderLine(lineNumber: number, store: BlockStore) {
		// TODO move this part to contrib, block should register by registry
		const type = store.getType() || 'text';
		const contributions = ViewLineExtensionsRegistry.getViewLineContributions();
		const contribution: IViewLineContributionDescription = contributions.get(type) || contributions.get('text')!;
		const viewBlock: ViewBlock = this.instantiationService.createInstance(
			contribution.ctor, lineNumber, this.viewContext, this.viewController, {});
		viewBlock.setValue(store);
		this.domNode = viewBlock.getDomNode();
		this.domNode.setClassName('view-line');
		this.domNode.setAttribute('data-index', lineNumber.toString());
		this.domNode.setAttribute('data-block-id', store.id);
		return true;
	}
}

abstract class BaseBlock extends Themable {
	private editableHandler: EditableHandler;

	constructor(
		lineNumber: number,
		viewContext: ViewContext,
		viewController: ViewController,
		protected readonly options: EditableHandlerOptions,
		@IThemeService themeService: IThemeService,
	) {
		super(themeService);
		this.editableHandler = this.renderPersisted(lineNumber, viewContext, viewController);
		this.editableHandler.editable.domNode.style.minHeight = '1em';

		const style = this.getStyle();
		if (style) {
			this.editableHandler.applyStyles(style);
		}
		this.editableHandler.style({ textFillColor: this.themeService.getColorTheme().getColor(lightTextColor)! });

		if (viewController.getSelection().lineNumber === lineNumber) {
			this.editableHandler.focusEditable();
		}
	}

	abstract renderPersisted(lineNumber: number, viewContext: ViewContext, viewController: ViewController): EditableHandler;

	protected getStyle(): void | CSSProperties {

	}

	setValue(store: BlockStore) {
		const html = segmentsToElement(store.getTitleStore().getValue()).join('');
		this.editableHandler.setValue(html);
		this.editableHandler.setEnabled(store.canEdit());
	}

	getDomNode() {
		return this.editableHandler.editable;
	}
}

export class ViewBlock extends BaseBlock {

	override renderPersisted(
		lineNumber: number,
		viewContext: ViewContext,
		viewController: ViewController,
	): EditableHandler {
		return new EditableHandler(lineNumber, viewContext, viewController, { placeholder: this.getPlaceholder(), forcePlaceholder: this.options?.forcePlaceholder });
	}

	getPlaceholder() {
		if (this.options) {
			return this.options.placeholder ?? 'Type to continue';
		}
		return 'Type to continue';
	}

	override getStyle(): CSSProperties {
		return {
			padding: '3px 2px',
		};
	}
}


