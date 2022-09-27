import 'vs/css!./media/prism';
import * as nls from 'vs/nls';
import { Prism } from 'mote/base/browser/prism/prism.all';
import { EditableHandler, EditableHandlerOptions } from 'mote/editor/browser/controller/editableHandler';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { BaseBlock } from 'mote/editor/contrib/viewBlock/browser/baseBlock';
import { BlockTypes } from 'mote/platform/store/common/record';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { ThemedStyles } from 'mote/base/common/themes';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import BlockStore from 'mote/platform/store/common/blockStore';
import { collectValueFromSegment } from 'mote/editor/common/segmentUtils';
import { Button } from 'mote/base/browser/ui/button/button';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { mediumTextColor } from 'mote/platform/theme/common/themeColors';
import { IThemable } from 'vs/base/common/styler';
import { registerIcon } from 'mote/platform/theme/common/iconRegistry';
import { Codicon } from 'vs/base/common/codicons';
import { IThemeService, ThemeIcon } from 'mote/platform/theme/common/themeService';
import { flattenNode } from 'mote/editor/common/htmlElementUtils';
import { TextSelection } from 'mote/editor/common/core/selectionUtils';

const defaultLanguage = 'JavaScript';

const moreLanguageIcon = registerIcon('more-language', Codicon.chevronDown, nls.localize('moreLanguage', 'Line decoration for inserts in the diff editor.'));


export class CodeBlock extends BaseBlock implements IThemable {

	public static readonly ID = BlockTypes.code;

	private container!: FastDomNode<HTMLElement>;
	private languagePickerContainer!: HTMLElement;

	constructor(
		lineNumber: number,
		viewContext: ViewContext,
		viewController: ViewController,
		options: EditableHandlerOptions,
		@IThemeService themeService: IThemeService,
		//@IQuickInputService private readonly quickInputService: IQuickInputService,
	) {
		super(lineNumber, viewContext, viewController, options, themeService);
	}

	renderPersisted(lineNumber: number, viewContext: ViewContext, viewController: ViewController): EditableHandler {
		this.container = createFastDomNode(document.createElement('div'));
		this.container.domNode.style.display = 'flex';

		const blockContainer = createFastDomNode(document.createElement('div'));
		setStyles(blockContainer.domNode, this.getContainerStyle());
		this.registerHoverListener(blockContainer.domNode);

		const codeContainer = createFastDomNode(document.createElement('div'));
		codeContainer.setClassName('line-numbers');


		const editableHandler = this.createEditableHandler(lineNumber, viewContext, viewController);
		codeContainer.appendChild(editableHandler.editable);
		blockContainer.appendChild(codeContainer);

		this.createLanguagePicker(blockContainer.domNode);
		this.container.appendChild(blockContainer);
		return editableHandler;
	}

	private registerHoverListener(container: HTMLElement) {
		this._register(addDisposableListener(container, EventType.MOUSE_OVER, e => {
			this.languagePickerContainer.style.opacity = '1';
		}));

		this._register(addDisposableListener(container, EventType.MOUSE_OUT, e => {
			this.languagePickerContainer.style.opacity = '0';
		}));
	}

	private createEditableHandler(lineNumber: number, viewContext: ViewContext, viewController: ViewController) {
		const editableHandler = new EditableHandler(lineNumber, viewContext, {
			type: viewController.type.bind(viewController),
			compositionType: viewController.compositionType.bind(viewController),
			backspace: viewController.backspace.bind(viewController),
			// prevent default enter behavior
			enter: () => this.handleEnter(viewController),
			select: (e) => this.handleSelect(viewController, e),
			isEmpty: viewController.isEmpty.bind(viewController),
			getSelection: viewController.getSelection.bind(viewController),
		}, {});
		setStyles(editableHandler.editable.domNode, this.getContentEditableStyle());

		return editableHandler;
	}

	private handleSelect(viewController: ViewController, selection: TextSelection) {
		viewController.select(selection);
	}

	private handleEnter(viewController: ViewController) {
		viewController.insert('\n');
		return false;
	}

	private createLanguagePicker(parent: HTMLElement) {
		const pickerContainer = document.createElement('div');
		this.languagePickerContainer = pickerContainer;
		setStyles(pickerContainer, this.getLanguageSelectorStyle());

		const moreIconEle = document.createElement('div');
		moreIconEle.className = ThemeIcon.asClassName(moreLanguageIcon);

		const button = new Button(pickerContainer);
		setStyles(button.element, this.getPickerButtonStyle());
		button.element.appendChild(document.createTextNode(defaultLanguage));
		button.element.appendChild(moreIconEle);

		parent.appendChild(pickerContainer);
	}

	private getPickerButtonStyle(): CSSProperties {
		return {
			paddingLeft: '5px',
			paddingRight: '5px',
			height: '20px',
			alignItems: 'center',
			borderRadius: '3px',
			display: 'inline-flex'
		};
	}

	override setValue(store: BlockStore) {
		const code = collectValueFromSegment(store.getTitleStore().getValue());
		const highlightHtml = Prism.highlight(code, Prism.languages['javascript'], 'javascript');
		const flattenHtml = this.flattenHtml(highlightHtml);
		this.editableHandler.setValue(flattenHtml);
		this.editableHandler.setEnabled(store.canEdit());
	}

	private flattenHtml(html: string) {
		let result = '';
		const testNode = document.createElement('div');
		testNode.innerHTML = html;
		const nodes = flattenNode(testNode);
		let lastData;
		for (const node of nodes) {
			const data = node.data;
			if (node.parentNode !== testNode) {
				const className = (node.parentNode! as any).className;
				result += `<span class="${className}" >${data}</span>`;
			} else {
				lastData = data;
				result += `<span >${data}</span>`;
			}
		}
		if (lastData === '\n') {
			result += `<div style="min-height: 1em" ></siv>`;
		}
		return result;
	}

	style() {

	}

	private getLanguageSelectorStyle(): CSSProperties {
		return {
			position: 'absolute',
			top: '8px',
			left: '8px',
			color: this.getColor(mediumTextColor)!,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'flex-end',
			transition: 'opacity 300ms ease-in',
			opacity: '0',
			fontSize: '12px'
		};
	}

	private getContentEditableStyle(): CSSProperties {
		return {
			flexGrow: 1,
			flexShrink: 1,
			textAlign: 'left',
			fontSize: '85%',
			tabSize: 2,
			padding: '34px 16px 32px 32px',
			minHeight: '1em',
			whiteSpace: 'pre',
			color: ThemedStyles.regularTextColor.light
		};
	}

	private getContainerStyle(): CSSProperties {
		return {
			flexGrow: '1px',
			borderRadius: '3px',
			textAlign: 'left',
			position: 'relative',
			background: ThemedStyles.codeBlockBackground.light,
			minWidth: '0px',
			width: '100%'
		};
	}

	override getDomNode() {
		return this.container;
	}
}
