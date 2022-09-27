import { IMenuLikeStyles } from 'mote/base/browser/ui/menu/menu';
import { Lodash } from 'mote/base/common/lodash';
import * as dom from 'vs/base/browser/dom';
import { createStyleSheet, isInShadowDOM } from 'vs/base/browser/dom';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { Widget } from 'vs/base/browser/ui/widget';
import { Action } from 'vs/base/common/actions';
import { IThemable } from 'vs/base/common/styler';

interface ITabItem {
	id: string;
	label?: string;
	render(parent: HTMLElement): void;
}

interface ITabsWidgetOptions {
	orientation?: ActionsOrientation;
}

export class TabsWidget extends Widget implements IThemable {

	static globalStyleSheet: HTMLStyleElement;

	private domNode!: HTMLElement;
	private bodyDomNode!: HTMLElement;

	private switcherBar!: ActionBar;

	private target: string | undefined;
	private tabs: ITabItem[] | undefined;

	protected styleSheet: HTMLStyleElement | undefined;

	constructor(parent: HTMLElement, options?: ITabsWidgetOptions) {
		super();
		this.create(parent);
	}

	public addTabs(tabs: ITabItem[]) {
		const actions = tabs.map((tab) => {
			return new Action(tab.id, tab.label, '', true, () => this.updateTarget(tab.id));
		});
		this.tabs = tabs;
		this.target = tabs[0].id;
		tabs[0].render(this.bodyDomNode);
		this.switcherBar.push(actions);
	}

	private create(parent: HTMLElement) {
		this.domNode = dom.append(parent, dom.$('.tabs-widget'));
		this.switcherBar = this._register(new ActionBar(this.domNode, {
			orientation: ActionsOrientation.HORIZONTAL,
		}));
		this.switcherBar.domNode.style.padding = '15px 5px';
		this.bodyDomNode = dom.append(this.domNode, dom.$('.tabs-widget-body'));
		this.bodyDomNode.style.borderTop = '1px solid #37352f26';
	}

	private updateTarget(target: string) {
		if (this.target && target === this.target) {
			return;
		}
		this.target = target;
		const idx = Lodash.findIndex(this.tabs!, (tab) => tab.id === target);
		const currentTab = this.tabs![idx];

		dom.clearNode(this.bodyDomNode);

		currentTab.render(this.bodyDomNode);
	}

	style(style: IMenuLikeStyles) {
		const container = this.domNode;

		const fgColor = style.foregroundColor ? `${style.foregroundColor}` : '';
		const bgColor = style.backgroundColor ? `${style.backgroundColor}` : '';
		const border = style.borderColor ? `1px solid ${style.borderColor}` : '';
		const borderRadius = '5px';
		const shadow = style.shadowColor ? `0 2px 8px ${style.shadowColor}` : '';

		//const dividerColor = style.dividerColor ? `${style.dividerColor}` : 'rgb(55 53 47 / 9%)';

		container.style.outline = border;
		container.style.borderRadius = borderRadius;
		container.style.color = fgColor;
		container.style.backgroundColor = bgColor;
		container.style.boxShadow = shadow;

		this.initializeOrUpdateStyleSheet(container, style);

	}

	private initializeOrUpdateStyleSheet(container: HTMLElement, style: IMenuLikeStyles): void {
		if (!this.styleSheet) {
			if (isInShadowDOM(container)) {
				this.styleSheet = createStyleSheet(container);
			} else {
				if (!TabsWidget.globalStyleSheet) {
					TabsWidget.globalStyleSheet = createStyleSheet();
				}
				this.styleSheet = TabsWidget.globalStyleSheet;
			}
		}
		this.styleSheet.textContent = getTabsWidgetCSS(style, isInShadowDOM(container));
	}
}

function getTabsWidgetCSS(style: IMenuLikeStyles, isForShadowDom: boolean): string {
	const result = /* css */`
.tabs-widget .monaco-action-bar .action-item.disabled .action-label:hover {
	color: var(--mote-disabledForeground);
}
.tabs-widget .monaco-action-bar .action-label:hover {
	background: var(--mote-button-hoverBackground);
}
	`;
	return result;
}
