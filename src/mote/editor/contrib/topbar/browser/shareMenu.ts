import * as nls from 'vs/nls';
import * as dom from 'vs/base/browser/dom';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import { Color } from 'vs/base/common/color';
import { Emitter, Event } from 'vs/base/common/event';
import { IThemable } from 'vs/base/common/styler';
import { Disposable } from 'vs/base/common/lifecycle';
import { registerIcon } from 'mote/platform/theme/common/iconRegistry';
import { Codicon } from 'vs/base/common/codicons';
import { IThemeService, ThemeIcon } from 'mote/platform/theme/common/themeService';
import { ItemContainer } from 'mote/base/browser/ui/item/itemContainer';
import { attachItemContainerStyler, attachSwitchButtonStyler } from 'mote/platform/theme/common/styler';
import { Button, SwitchButton } from 'mote/base/browser/ui/button/button';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { IMoteEditor } from 'mote/editor/browser/editorBrowser';

const shareWebIcon = registerIcon('share-to-web', Codicon.globe, nls.localize('shareToWeb', 'Line decoration for inserts in the diff editor.'));


class ShareSwitcher extends Disposable {

	private swicther!: SwitchButton;

	private _onDidSwitch = this._register(new Emitter<boolean>());
	public onDidSwitch: Event<boolean> = this._onDidSwitch.event;

	constructor(parent: HTMLElement, private readonly themeService: IThemeService, title: string, subTitle?: string) {
		super();
		const button = new Button(parent);

		const switcherContaier = document.createElement('div');
		setStyles(switcherContaier, this.getSwitcherContainerStyle());

		this.createIcon(switcherContaier);
		this.createDescription(switcherContaier, title, subTitle);
		this.createSwitcher(switcherContaier);

		button.element.appendChild(switcherContaier);
		parent.appendChild(button.element);
	}

	private createSwitcher(parent: HTMLElement) {
		const container = document.createElement('div');
		this.swicther = new SwitchButton(container);
		setStyles(container, this.getSwitcherStyle());
		this._register(attachSwitchButtonStyler(this.swicther, this.themeService));

		this.swicther.onDidSwitch(() => {
			this._onDidSwitch.fire(this.swicther.turnOn);
		});

		parent.appendChild(container);
	}

	private createIcon(parent: HTMLElement,) {
		const iconContainer = document.createElement('div');
		setStyles(iconContainer, this.getIconContainerStyle());

		const icon = document.createElement('div');
		icon.className = ThemeIcon.asClassName(shareWebIcon);
		icon.style.fontSize = '26px';

		iconContainer.appendChild(icon);
		parent.appendChild(iconContainer);
	}

	private createDescription(parent: HTMLElement, title: string, subTitle?: string) {
		const container = document.createElement('div');

		const titleContainer = new ItemContainer();
		this._register(attachItemContainerStyler(titleContainer, this.themeService));
		titleContainer.getContainer().innerText = title;
		container.appendChild(titleContainer.getContainer());

		if (subTitle) {
			const subtitleContainer = new ItemContainer({ isSmall: true });
			this._register(attachItemContainerStyler(subtitleContainer, this.themeService));
			subtitleContainer.getContainer().innerText = subTitle;
			container.appendChild(subtitleContainer.getContainer());
		}

		parent.appendChild(container);
	}

	private getSwitcherStyle(): CSSProperties {
		return {
			display: 'flex',
			alignItems: 'center',
			flexShrink: 0,
			marginLeft: '8px'
		};
	}

	private getSwitcherContainerStyle() {
		return {
			display: 'flex',
			alignItems: 'center',
			minHeight: '52px',
			paddingTop: '8px',
			paddingBottom: '8px',
			paddingLeft: '14px',
			paddingRight: '14px'
		};
	}

	private getIconContainerStyle() {
		return {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			width: '32px',
			height: '32px',
			marginRight: '12px'
		};
	}
}

interface IMenuStyles {
	shadowColor?: Color;
	borderColor?: Color;
	foregroundColor?: Color;
	backgroundColor?: Color;
	dividerColor?: Color;
}

export class ShareMenu extends Disposable implements IThemable {

	private _onDidBlur = this._register(new Emitter<void>());
	readonly onDidBlur = this._onDidBlur.event;

	private focusTracker: dom.IFocusTracker;

	private container: HTMLElement;
	private footer!: HTMLElement;

	constructor(parent: HTMLElement, private readonly editor: IMoteEditor, themeService: IThemeService,) {
		super();
		this.container = document.createElement('div');
		parent.appendChild(this.container);

		this.focusTracker = this._register(dom.trackFocus(this.container));
		this._register(this.focusTracker.onDidBlur(() => {
			if (dom.getActiveElement() === this.container || !dom.isAncestor(dom.getActiveElement(), this.container)) {
				this._onDidBlur.fire();
			}
		}));

		const swicther = new ShareSwitcher(this.container, themeService, 'Share to Web', 'Anyone with the link can view');
		swicther.onDidSwitch((turnOn) => {
			//editor.trigger()
		});

		this.createFooter(this.container);
	}

	private createFooter(parent: HTMLElement) {
		const footer = document.createElement('div');
		this.footer = footer;
		setStyles(footer, this.getFooterStyle());

		const copyLinkbtn = new Button(footer);
		copyLinkbtn.element.innerText = 'Copy Link';
		setStyles(copyLinkbtn.element, this.getCopyLinkStyle());

		const pageLink = `https://moteapp.io/page/${this.editor.getStore()!.id}`;

		copyLinkbtn.onDidClick(() => {
			navigator.clipboard.writeText(pageLink);
		});

		parent.appendChild(footer);
	}

	private getCopyLinkStyle(): CSSProperties {
		return {
			height: '24px',
			lineHeight: 1.2,
			paddingLeft: '8px',
			paddingRight: '8px',
			display: 'inline-flex',
			alignItems: 'center',
		};
	}

	private getFooterStyle(): CSSProperties {
		return {
			display: 'flex',
			padding: '4px',
			flexDirection: 'row-reverse',
			boxShadow: `rgb(55 53 47 / 9%) 0px -1px 0px`
		};
	}

	style(style: IMenuStyles) {
		const container = this.container;

		const fgColor = style.foregroundColor ? `${style.foregroundColor}` : '';
		const bgColor = style.backgroundColor ? `${style.backgroundColor}` : '';
		const border = style.borderColor ? `1px solid ${style.borderColor}` : '';
		const borderRadius = '5px';
		const shadow = style.shadowColor ? `0 2px 8px ${style.shadowColor}` : '';

		const dividerColor = style.dividerColor ? `${style.dividerColor}` : 'rgb(55 53 47 / 9%)';

		container.style.outline = border;
		container.style.borderRadius = borderRadius;
		container.style.color = fgColor;
		container.style.backgroundColor = bgColor;
		container.style.boxShadow = shadow;

		this.footer.style.boxShadow = `${dividerColor} 0px -1px 0px`;
	}
}
