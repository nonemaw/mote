import { setStyles } from 'mote/base/browser/jsx/createElement';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { EditableHandlerOptions } from 'mote/editor/browser/controller/editableHandler';
import { IViewLineContribution } from 'mote/editor/browser/editorBrowser';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import BlockStore from 'mote/platform/store/common/blockStore';
import { IThemeService, Themable, ThemeIcon } from 'mote/platform/theme/common/themeService';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { SVGIcon } from 'mote/base/browser/ui/icon/svgicon';
import { buttonHoverBackground, imageBlockBackground, mediumIconColor, mediumTextColor, outlineButtonBorder } from 'mote/platform/theme/common/themeColors';
import { Button } from 'mote/base/browser/ui/button/button';
import { IContextMenuService, IContextViewService } from 'mote/platform/contextview/browser/contextView';
import { ContextViewHelper } from 'mote/platform/contextview/browser/contextViewHelper';
import { TabsWidget } from 'mote/base/browser/ui/tab/tabsWidget';
import { addDisposableListener, clearNode, EventType, triggerUpload } from 'vs/base/browser/dom';
import { IRemoteService } from 'mote/platform/remote/common/remote';
import { registerIcon } from 'mote/platform/theme/common/iconRegistry';
import { Codicon } from 'vs/base/common/codicons';
import { IAction } from 'vs/base/common/actions';
import { BlockTypes } from 'mote/platform/store/common/record';
import { isLocalUser } from 'mote/platform/user/common/user';

const menuIcon = registerIcon('menu-icon', Codicon.kebabHorizontal, '');

interface IUpdateState {
	dataUrl?: string;
	imgUrl?: string;
	fileName?: string;
}

export class ImageBlock extends Themable implements IViewLineContribution {

	public static ID: string = BlockTypes.image;

	private fileUploadState: IUpdateState = {};

	private domNode: FastDomNode<HTMLElement>;
	private contextViewHelper: ContextViewHelper;
	private store: BlockStore | undefined;

	constructor(
		private readonly lineNumber: number,
		viewContext: ViewContext,
		private readonly viewController: ViewController,
		protected readonly options: EditableHandlerOptions,
		@IThemeService themeService: IThemeService,
		@IContextViewService contextViewService: IContextViewService,
		@IContextMenuService private readonly menuService: IContextMenuService,
		@IRemoteService private readonly remoteService: IRemoteService,
	) {
		super(themeService);
		this.domNode = createFastDomNode(document.createElement('div'));
		this.createPlaceholder(this.domNode.domNode);

		this.contextViewHelper = new ContextViewHelper(contextViewService, themeService);
	}

	setValue(store: BlockStore): void {
		this.store = store;
		const source = this.getSource(store);
		if (source) {
			this.createImage(this.domNode.domNode, source);
		}
	}
	getDomNode(): FastDomNode<HTMLElement> {
		return this.domNode;
	}

	private createMenu(parent: HTMLElement) {
		const menuContainer = document.createElement('div');
		setStyles(menuContainer, this.getMenuStyle());
		parent.appendChild(menuContainer);

		const icon = document.createElement('div');
		icon.className = ThemeIcon.asClassName(menuIcon);
		const menuButton = new Button(menuContainer);
		menuButton.element.appendChild(icon);
		setStyles(menuButton.element, this.getMenuButtonStyle());

		const deleteAction: IAction = {
			id: 'image.delete', label: 'Delete', run: () => {
				this.viewController.select({ startIndex: 0, endIndex: 0, lineNumber: this.lineNumber });
				this.viewController.backspace();
			},
			tooltip: '',
			class: undefined,
			enabled: true,
			dispose: () => { }
		};

		menuButton.onDidClick((e) => {
			e.preventDefault();
			e.stopPropagation();
			this.menuService.showContextMenu({
				getAnchor: () => menuContainer,
				getActions: () => [deleteAction],
			});
		});

		return menuContainer;
	}

	private getMenuButtonStyle(): CSSProperties {
		return {
			height: '25px',
			width: '25px',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: '3px',
		};
	}

	private getMenuStyle(): CSSProperties {
		return {
			position: 'absolute',
			top: '5px',
			right: '5px',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'flex-end',
			height: '25px',
			opacity: '0'
		};
	}

	private createImage(parent: HTMLElement, source: string) {
		clearNode(parent);
		const imgContaier = document.createElement('div');
		imgContaier.style.position = 'relative';

		const img = document.createElement('img');
		img.src = source;
		img.style.width = '100%';
		img.style.height = '100%';

		imgContaier.appendChild(img);
		parent.appendChild(imgContaier);

		const menu = this.createMenu(imgContaier);
		menu.style.background = this.getColor(buttonHoverBackground)!;
		this.registerHoverListener(imgContaier, menu);
	}

	private createPlaceholder(parent: HTMLElement) {
		clearNode(parent);
		const button = new Button(parent, {
			buttonBackground: this.getColor(imageBlockBackground) as any
		});
		button.style({ buttonHoverBackground: this.getColor(buttonHoverBackground) as any });
		button.onDidClick(() => this.showUploadMenu());

		const container = button.element;
		container.style.display = 'flex';
		container.style.position = 'relative';
		container.style.transition = 'background 20ms ease-in 0s';

		const placeholderContainer = document.createElement('div');
		setStyles(placeholderContainer, this.getPlaceholderContainerStyle());

		const imageIcon = new SVGIcon('picture');
		imageIcon.style({
			iconFill: this.themeService.getColorTheme().getColor(mediumIconColor),
			width: '25px',
			height: '25px'
		});
		imageIcon.element.style.marginRight = '12px';

		const placeholder = document.createElement('div');
		placeholder.innerText = 'Add an image';

		placeholderContainer.appendChild(imageIcon.element);
		placeholderContainer.appendChild(placeholder);

		container.appendChild(placeholderContainer);
		parent.appendChild(container);

		const menu = this.createMenu(container);
		this.registerHoverListener(container, menu);
	}

	private registerHoverListener(domNode: HTMLElement, overlay: HTMLElement) {
		this._register(addDisposableListener(domNode, EventType.MOUSE_OVER, e => {
			overlay.style.opacity = '1';
		}));

		this._register(addDisposableListener(domNode, EventType.MOUSE_OUT, e => {
			overlay.style.opacity = '0';
		}));
	}

	private showUploadMenu() {
		const uploadTab = { id: 'upload', label: 'Upload', render: this.renderUploadTab.bind(this) };
		const embedLinkTab = { id: 'embedLink', label: 'Embed Link', render: this.renderEmbedLinkTab.bind(this) };
		this.contextViewHelper.showContextView({
			getAnchor: () => this.domNode.domNode,
			getWidget: (parent) => {
				const widget = new TabsWidget(parent);
				widget.addTabs([uploadTab, embedLinkTab]);
				return widget;
			},
			debug: false,
		});
	}

	private async handleUpload() {
		const files = await triggerUpload(false);
		if (files) {
			const reader = new FileReader();
			reader.readAsDataURL(files[0]);
			reader.onload = () => {
				this.fileUploadState.dataUrl = reader.result?.toString();
				this.contextViewHelper.hideContextView();
				this.createImage(this.domNode.domNode, this.fileUploadState.dataUrl!);
				this.viewController.select({ startIndex: 0, endIndex: 0, lineNumber: this.lineNumber });
				this.viewController.updateProperties({ source: this.fileUploadState.dataUrl! });
			};
			if (this.store && this.store.canEdit() && !isLocalUser(this.store?.userId)) {
				const imgFile = files[0];
				const result = await this.remoteService.uploadFile(imgFile);
				this.fileUploadState.imgUrl = result.url;
				this.fileUploadState.fileName = result.filename;
				this.createImage(this.domNode.domNode, this.fileUploadState.imgUrl!);
				this.viewController.select({ startIndex: 0, endIndex: 0, lineNumber: this.lineNumber });
				this.viewController.updateProperties({ source: result.url });
			}
		}
	}

	private handleEmbed(source: string) {
		this.contextViewHelper.hideContextView();
		this.createImage(this.domNode.domNode, source);
		this.viewController.select({ startIndex: 0, endIndex: 0, lineNumber: this.lineNumber });
		this.viewController.updateProperties({ source: source });
	}

	private renderUploadTab(parent: HTMLElement) {
		const container = document.createElement('div');
		container.style.width = '500px';
		container.style.paddingTop = '16px';
		parent.appendChild(container);

		const uploadBtnContainer = document.createElement('div');
		setStyles(uploadBtnContainer, this.getUploadImageBtnContainerStyle());

		const uploadButton = new Button(uploadBtnContainer);
		uploadButton.element.innerText = 'Upload Image';
		uploadButton.style({ buttonBorderColor: this.getColor(outlineButtonBorder) as any });
		setStyles(uploadButton.element, this.getUploadImageButtonStyle());
		uploadButton.onDidClick(() => this.handleUpload());

		const tipsContainer = document.createElement('div');
		setStyles(tipsContainer, this.getUploadTipsStyle());
		const tips = document.createElement('div');
		tips.innerText = 'The maximum size per file is 1MB.';
		tipsContainer.appendChild(tips);

		container.appendChild(uploadBtnContainer);
		container.appendChild(tipsContainer);
	}

	private renderEmbedLinkTab(parent: HTMLElement) {
		const container = document.createElement('div');
		container.style.width = '500px';
		container.style.paddingTop = '16px';

		const inputContainer = document.createElement('div');
		setStyles(inputContainer, this.getUploadImageBtnContainerStyle());
		const input = document.createElement('input');
		setStyles(input, this.getUploadImageButtonStyle());
		input.style.border = '1px solid #d9d9d9';
		input.placeholder = 'Paste your link here';

		const buttonContainer = document.createElement('div');
		setStyles(buttonContainer, this.getUploadTipsStyle());
		const confirmButton = new Button(buttonContainer);
		confirmButton.element.innerText = 'Embed Link';
		setStyles(confirmButton.element, this.getUploadImageButtonStyle());
		confirmButton.element.style.width = '';
		confirmButton.onDidClick(() => {
			this.handleEmbed(input.value);
		});

		inputContainer.appendChild(input);
		container.appendChild(inputContainer);
		container.appendChild(buttonContainer);

		parent.appendChild(container);
	}

	private getUploadTipsStyle(): CSSProperties {
		return {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			lineHeight: '120%',
			paddingTop: '4px',
			paddingBottom: '4px',
			marginTop: '4px',
			marginBottom: '6px'
		};
	}

	private getUploadImageBtnContainerStyle(): CSSProperties {
		return {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		};
	}

	private getUploadImageButtonStyle(): CSSProperties {
		return {
			padding: '0 12px',
			height: '32px',
			lineHeight: 1.2,
			borderRadius: '3px',
			width: '90%',
			display: 'inline-flex',
			alignItems: 'center',
			justifyContent: 'center',
		};
	}

	private getPlaceholderContainerStyle(): CSSProperties {
		return {
			padding: '12px 36px 12px 12px',
			display: 'flex',
			alignItems: 'center',
			textAlign: 'left',
			width: '100%',
			overflow: 'hidden',
			color: this.getColor(mediumTextColor)!
		};
	}

	private getSource(store: BlockStore) {
		const properties = store.getProperties();
		const source = properties.source;
		return source;
	}

}
