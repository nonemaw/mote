import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IQuickMenuDelegate, IQuickMenuService } from './quickmenu';
import { RangeUtils } from 'mote/editor/common/core/rangeUtils';
import { IAction } from 'vs/base/common/actions';
import { IMenuOptions } from 'vs/base/browser/ui/menu/menu';
import { IMenuLike } from 'mote/base/browser/ui/menu/menu';
import { QuickMenu, QuickMenuHeight } from 'mote/base/browser/ui/menu/quickMenu';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { IHoverService, IHoverTarget } from 'mote/workbench/services/hover/browser/hover';
import { IHoverDelegate, IHoverDelegateOptions, IHoverDelegateTarget } from 'vs/base/browser/ui/iconLabel/iconHoverDelegate';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ContextViewService } from 'mote/platform/contextview/browser/contextViewService';
import { HoverPosition } from 'vs/base/browser/ui/hover/hoverWidget';
import { ContextViewHelper } from 'mote/platform/contextview/browser/contextViewHelper';


export class QuickMenuService implements IQuickMenuService {

	declare readonly _serviceBrand: undefined;

	private hoverDelegate: IHoverDelegate;

	private contextViewHelper: ContextViewHelper;

	constructor(
		@IThemeService themeService: IThemeService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IHoverService hoverService: IHoverService
	) {
		// We need show tooltip, and tooltop is based on the ContextViewService;
		// ContextViewService just allowed to show one context view in same time.
		// It's why we need to create a self owned contextViewService
		const contextViewService = instantiationService.createInstance(ContextViewService);

		this.contextViewHelper = new ContextViewHelper(contextViewService, themeService);

		this.hoverDelegate = new class implements IHoverDelegate {

			readonly placement = 'element';

			private _lastHoverHideTime: number = 0;

			showHover(options: IHoverDelegateOptions, focus?: boolean) {
				let target: HTMLElement;
				if (options.target.hasOwnProperty('targetElements')) {
					target = (options.target as any as IHoverDelegateTarget).targetElements[0];
				} else {
					target = options.target as HTMLElement;
				}
				const rect = target.getBoundingClientRect();
				const width = rect.right - rect.left;
				const height = rect.bottom - rect.top;
				options.hoverPosition = HoverPosition.ABOVE;
				options.showPointer = false;
				const hoverOptions = options as any;
				const hoverTarget: IHoverTarget = {
					x: rect.left - width / 4, y: rect.top - height + 20, targetElements: [target],
					dispose: () => { }
				};
				return hoverService.showHover({ ...hoverOptions, target: hoverTarget }, focus);
			}

			get delay(): number {
				return Date.now() - this._lastHoverHideTime < 200
					? 0  // show instantly when a hover was recently shown
					: 200;
			}

			onDidHideHover() {
				this._lastHoverHideTime = Date.now();
			}
		};
	}

	createMenu(container: HTMLElement, actions: readonly IAction[], options: IMenuOptions): IMenuLike {
		return new QuickMenu(container, actions, { ...options, hoverDelegate: this.hoverDelegate });
	}

	showQuickMenu(delegate: IQuickMenuDelegate): void {
		this.contextViewHelper.showContextView({
			getAnchor: () => this.getAnchor(),
			getWidget: (parent) => {
				const widget = this.createMenu(parent, delegate.getActions(), {});
				return widget;
			},
			debug: false,
		});
	}

	private getAnchor() {
		const range = RangeUtils.get();
		let left = 0, top = 0;
		const rect = RangeUtils.getRect(range!);
		if (rect) {
			left = rect.left;
			top = rect.top - QuickMenuHeight - 15;
		}

		return {
			y: top,
			x: left
		};
	}
}


registerSingleton(IQuickMenuService, QuickMenuService);
