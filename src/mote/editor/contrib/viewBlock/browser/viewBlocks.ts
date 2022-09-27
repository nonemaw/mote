import * as nls from 'vs/nls';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { CheckBox } from 'mote/base/browser/ui/checkbox/checkbox';
import fonts from 'mote/base/browser/ui/fonts';
import { EditableHandler } from 'mote/editor/browser/controller/editableHandler';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { registerViewLineContribution } from 'mote/editor/browser/viewLineExtensions';
import { BaseBlock } from 'mote/editor/contrib/viewBlock/browser/baseBlock';
import { CodeBlock } from 'mote/editor/contrib/viewBlock/browser/codeBlock';
import BlockStore from 'mote/platform/store/common/blockStore';
import { BlockTypes } from 'mote/platform/store/common/record';
import { registerIcon } from 'mote/platform/theme/common/iconRegistry';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { Codicon } from 'vs/base/common/codicons';
import { ThemeIcon } from 'mote/platform/theme/common/themeService';
import { ImageBlock } from 'mote/editor/contrib/viewBlock/browser/imageBlock';

const bulleteIcon = registerIcon('bullete', Codicon.circleFilled, nls.localize('diffInsertIcon', 'Line decoration for inserts in the diff editor.'));


export class ViewBlock extends BaseBlock {

	public static readonly ID = BlockTypes.text;

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

class HeaderBlock extends ViewBlock {
	public static override readonly ID = BlockTypes.header;

	override getStyle(): CSSProperties {
		return Object.assign({
			display: 'flex',
			width: '100%',
			fontWeight: fonts.fontWeight.semibold,
			fontSize: '1.875em',
			lineHeight: 1.3,
			marginTop: '2em',
		}, {});
	}

	override getPlaceholder() {
		return 'Heading 1';
	}
}

class Heading2Block extends ViewBlock {

	public static override readonly ID = BlockTypes.heading2;

	override getStyle(): CSSProperties {
		return Object.assign({
			display: 'flex',
			width: '100%',
			fontWeight: fonts.fontWeight.semibold,
			fontSize: '1.5em',
			lineHeight: 1.3,
			marginTop: '1.4em',
		}, {});
	}

	override getPlaceholder() {
		return 'Heading 2';
	}
}

class Heading3Block extends ViewBlock {
	public static override readonly ID = BlockTypes.heading3;
	override getStyle(): CSSProperties {
		return Object.assign({
			display: 'flex',
			width: '100%',
			fontWeight: fonts.fontWeight.semibold,
			fontSize: '1.25em',
			lineHeight: 1.3,
			marginTop: '1em',
		}, {});
	}

	override getPlaceholder() {
		return 'Heading 3';
	}
}

class QuoteBlock extends ViewBlock {

	public static override readonly ID = BlockTypes.quote;

	private container!: FastDomNode<HTMLDivElement>;

	override renderPersisted(
		lineNumber: number,
		viewContext: ViewContext,
		viewController: ViewController
	) {
		const editableHandler = super.renderPersisted(lineNumber, viewContext, viewController);
		this.container = createFastDomNode(document.createElement('div'));
		this.container.domNode.style.padding = '3px 2px';
		this.container.appendChild(editableHandler.editable);
		return editableHandler;
	}

	override getPlaceholder() {
		if (this.options) {
			return this.options.placeholder ?? 'Quote';
		}
		return 'Quote';
	}

	override getDomNode() {
		return this.container;
	}

	override getStyle() {
		return Object.assign({
			borderLeft: '3px solid currentColor',
			paddingLeft: '0.9em',
			paddingRight: '0.9em'
		}, {});
	}
}

class TodoBlock extends ViewBlock {

	public static override readonly ID = BlockTypes.todo;

	private container!: FastDomNode<HTMLDivElement>;

	private checkbox!: CheckBox;

	override renderPersisted(
		lineNumber: number,
		viewContext: ViewContext,
		viewController: ViewController
	) {
		const editableHandler = super.renderPersisted(lineNumber, viewContext, viewController);
		editableHandler.editable.domNode.style.width = '100%';

		this.container = createFastDomNode(document.createElement('div'));
		this.container.domNode.style.padding = '3px 2px';
		this.container.domNode.style.display = 'flex';

		this.checkbox = new CheckBox(this.container.domNode);
		this._register(this.checkbox.onDidClick(() => {
			const checked = this.checkbox.hasChecked();
			viewController.select({ startIndex: 0, endIndex: 0, lineNumber: lineNumber });
			viewController.updateProperties({ checked: checked ? 'true' : 'false' });
		}));

		this.container.appendChild(editableHandler.editable);
		return editableHandler;
	}

	override getPlaceholder() {
		if (this.options) {
			return this.options.placeholder ?? 'Todo';
		}
		return 'Todo';
	}

	override setValue(store: BlockStore): void {
		super.setValue(store);

		const properties = store.getProperties();
		const checked = properties.checked === 'true';
		this.checkbox.checked(checked);
	}

	override getDomNode() {
		return this.container;
	}
}

class BulletedListBlock extends ViewBlock {

	public static override readonly ID = BlockTypes.bulletedList;

	private container!: FastDomNode<HTMLDivElement>;

	override renderPersisted(
		lineNumber: number,
		viewContext: ViewContext,
		viewController: ViewController
	) {
		const editableHandler = super.renderPersisted(lineNumber, viewContext, viewController);
		editableHandler.editable.domNode.style.width = '100%';

		this.container = createFastDomNode(document.createElement('div'));

		const listContainer = createFastDomNode(document.createElement('div'));
		listContainer.domNode.style.display = 'flex';
		listContainer.domNode.style.alignItems = 'flex-start';
		listContainer.domNode.style.paddingLeft = '2px';

		const dataContainer = createFastDomNode(document.createElement('div'));
		dataContainer.domNode.style.width = '100%';
		dataContainer.appendChild(editableHandler.editable);

		this.createBullete(listContainer);
		listContainer.appendChild(dataContainer);
		this.container.appendChild(listContainer);
		return editableHandler;
	}

	private createBullete(parent: FastDomNode<HTMLElement>) {
		const bullete = createFastDomNode(document.createElement('div'));
		//bullete.domNode.style.fontSize = '1.5em';
		bullete.domNode.style.lineHeight = '1';
		bullete.setClassName(ThemeIcon.asClassName(bulleteIcon));

		const bulleteContainer = createFastDomNode(document.createElement('div'));
		bulleteContainer.setWidth(24);
		bulleteContainer.domNode.style.display = 'flex';
		bulleteContainer.domNode.style.alignItems = 'center';
		bulleteContainer.domNode.style.justifyContent = 'center';
		bulleteContainer.domNode.style.minHeight = 'calc(1.5em + 6px)';

		bulleteContainer.appendChild(bullete);
		parent.appendChild(bulleteContainer);
	}

	override getPlaceholder() {
		if (this.options) {
			return this.options.placeholder ?? 'List';
		}
		return 'List';
	}

	override getDomNode() {
		return this.container;
	}
}

registerViewLineContribution(ViewBlock.ID, ViewBlock);
registerViewLineContribution(HeaderBlock.ID, HeaderBlock);
registerViewLineContribution(Heading2Block.ID, Heading2Block);
registerViewLineContribution(Heading3Block.ID, Heading3Block);
registerViewLineContribution(QuoteBlock.ID, QuoteBlock);
registerViewLineContribution(TodoBlock.ID, TodoBlock);
registerViewLineContribution(BulletedListBlock.ID, BulletedListBlock);
registerViewLineContribution(CodeBlock.ID, CodeBlock);
registerViewLineContribution(ImageBlock.ID, ImageBlock);
