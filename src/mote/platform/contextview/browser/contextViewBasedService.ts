import { IContextMenuDelegate } from 'mote/base/browser/contextmenu';
import { IMenuLike } from 'mote/base/browser/ui/menu/menu';
import { attachMenuStyler } from 'mote/platform/theme/common/styler';
import { contextViewBackground, regularTextColor } from 'mote/platform/theme/common/themeColors';
import { IThemeService, Themable } from 'mote/platform/theme/common/themeService';
import { $, addDisposableListener, EventType, isHTMLElement } from 'vs/base/browser/dom';
import { StandardMouseEvent } from 'vs/base/browser/mouseEvent';
import { IMenuOptions } from 'vs/base/browser/ui/menu/menu';
import { ActionRunner, IAction, IRunEvent } from 'vs/base/common/actions';
import { Emitter } from 'vs/base/common/event';
import { combinedDisposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { IContextMenuService, IContextViewService } from './contextView';

export interface IContextViewHandlerOptions {
	blockMouse: boolean;
}


/**
 * @deprecated use ContextViewHelper
 */
export abstract class BrowserContextViewBasedService extends Themable implements IContextMenuService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidShowContextMenu = new Emitter<void>();
	readonly onDidShowContextMenu = this._onDidShowContextMenu.event;

	private readonly _onDidHideContextMenu = new Emitter<void>();
	readonly onDidHideContextMenu = this._onDidHideContextMenu.event;

	private focusToReturn: HTMLElement | null = null;
	private block: HTMLElement | null = null;

	private options: IContextViewHandlerOptions = { blockMouse: true };

	constructor(
		@IThemeService themeService: IThemeService,
		@IContextViewService private readonly contextViewService: IContextViewService,
	) {
		super(themeService);
	}

	configure(options: IContextViewHandlerOptions): void {
		this.options = options;
	}

	showContextMenu(delegate: IContextMenuDelegate): void {
		const actions = delegate.getActions();
		if (!actions.length) {
			return; // Don't render an empty context menu
		}

		this.focusToReturn = document.activeElement as HTMLElement;

		const shadowRootElement = isHTMLElement(delegate.domForShadowRoot) ? delegate.domForShadowRoot : undefined;
		this.contextViewService.showContextView({
			getAnchor: () => delegate.getAnchor(),
			render: (container) => this.renderMenu(container, delegate),
			onHide: (didCancel) => {
				this._onDidHideContextMenu.fire();
			}
		}, shadowRootElement, !!shadowRootElement);

		this._onDidShowContextMenu.fire();
	}

	hideContextMenu() {
		this.contextViewService.hideContextView(false);
	}

	abstract createMenu(container: HTMLElement, actions: ReadonlyArray<IAction>, options: IMenuOptions): IMenuLike;

	private renderMenu(container: HTMLElement, delegate: IContextMenuDelegate): IDisposable {
		const actions = delegate.getActions();

		const className = delegate.getMenuClassName ? delegate.getMenuClassName() : '';

		if (className) {
			container.className += ' ' + className;
		}

		// Render invisible div to block mouse interaction in the rest of the UI
		if (this.options.blockMouse) {
			this.block = container.appendChild($('.context-view-block'));
			this.block.style.position = 'fixed';
			this.block.style.cursor = 'initial';
			this.block.style.left = '0';
			this.block.style.top = '0';
			this.block.style.width = '100%';
			this.block.style.height = '100%';
			this.block.style.zIndex = '-1';

			// TODO@Steven: this is never getting disposed
			addDisposableListener(this.block, EventType.MOUSE_DOWN, e => e.stopPropagation());
		}

		const menuDisposables = new DisposableStore();

		const actionRunner = delegate.actionRunner || new ActionRunner();
		actionRunner.onBeforeRun(this.onActionRun, this, menuDisposables);
		actionRunner.onDidRun(this.onDidActionRun, this, menuDisposables);

		const menu = this.createMenu(container, actions, { actionRunner: actionRunner });

		menuDisposables.add(attachMenuStyler(menu, this.themeService));

		// TODO fixme later, use auto detch instead of force style
		const menuContainer = menu.getContainer();
		menuContainer.style.color = this.getColor(regularTextColor)!;//'rgb(204, 204, 204)';
		menuContainer.style.backgroundColor = this.getColor(contextViewBackground)!;//'rgb(48, 48, 49)';
		menuContainer.style.boxShadow = 'rgb(0 0 0 / 36%) 0px 2px 8px';

		menu.onDidCancel(() => this.contextViewService.hideContextView(true), null, menuDisposables);
		menu.onDidBlur(() => this.contextViewService.hideContextView(true), null, menuDisposables);

		menuDisposables.add(addDisposableListener(window, EventType.BLUR, () => this.contextViewService.hideContextView(true)));
		menuDisposables.add(addDisposableListener(window, EventType.MOUSE_DOWN, (e: MouseEvent) => {
			if (e.defaultPrevented) {
				return;
			}

			const event = new StandardMouseEvent(e);
			let element: HTMLElement | null = event.target;

			// Don't do anything as we are likely creating a context menu
			if (event.rightButton) {
				return;
			}

			while (element) {
				if (element === container) {
					return;
				}

				element = element.parentElement;
			}

			this.contextViewService.hideContextView(true);
		}));

		return combinedDisposable(menuDisposables, menu);
	}

	private onActionRun(e: IRunEvent): void {
		this.contextViewService.hideContextView(false);

		// Restore focus here
		if (this.focusToReturn) {
			this.focusToReturn.focus();
		}
	}

	private onDidActionRun(e: IRunEvent): void {
	}
}
