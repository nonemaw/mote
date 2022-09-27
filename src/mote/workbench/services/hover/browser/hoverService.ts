import 'vs/css!./media/hover';
import { IHoverService, IHoverOptions, IHoverWidget } from 'mote/workbench/services/hover/browser/hover';
import { DisposableStore, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { HoverWidget } from 'mote/workbench/services/hover/browser/hoverWidget';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IContextViewService } from 'mote/platform/contextview/browser/contextView';
import { IContextViewProvider, IDelegate } from 'vs/base/browser/ui/contextview/contextview';
import { registerThemingParticipant } from 'mote/platform/theme/common/themeService';
import { editorHoverBackground } from 'mote/platform/theme/common/themeColors';

export class HoverService implements IHoverService {

	declare readonly _serviceBrand: undefined;

	private _currentHoverOptions: IHoverOptions | undefined;

	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IContextViewService private readonly _contextViewService: IContextViewService,
	) {

	}

	showHover(options: IHoverOptions, focus?: boolean): IHoverWidget | undefined {
		if (this._currentHoverOptions === options) {
			return undefined;
		}
		this._currentHoverOptions = options;

		const hoverDisposables = new DisposableStore();
		const hover = this._instantiationService.createInstance(HoverWidget, options);
		hover.onDispose(() => {
			this._currentHoverOptions = undefined;
			hoverDisposables.dispose();
		});
		const provider = this._contextViewService as IContextViewProvider;
		provider.showContextView(new HoverContextViewDelegate(hover, focus));
		if ('targetElements' in options.target) {
			for (const element of options.target.targetElements) {
				hoverDisposables.add(addDisposableListener(element, EventType.CLICK, () => this.hideHover()));
			}
		} else {
			hoverDisposables.add(addDisposableListener(options.target, EventType.CLICK, () => this.hideHover()));
		}
		if (options.hideOnKeyDown) {
			const focusedElement = document.activeElement;
			if (focusedElement) {
				hoverDisposables.add(addDisposableListener(focusedElement, EventType.KEY_DOWN, () => this.hideHover()));
			}
		}

		if ('IntersectionObserver' in window) {
			const observer = new IntersectionObserver(e => this._intersectionChange(e, hover), { threshold: 0 });
			const firstTargetElement = 'targetElements' in options.target ? options.target.targetElements[0] : options.target;
			observer.observe(firstTargetElement);
			hoverDisposables.add(toDisposable(() => observer.disconnect()));
		}

		return hover;
	}

	hideHover(): void {
		if (!this._currentHoverOptions) {
			return;
		}
		this._currentHoverOptions = undefined;
	}

	private _intersectionChange(entries: IntersectionObserverEntry[], hover: IDisposable): void {
		const entry = entries[entries.length - 1];
		if (!entry.isIntersecting) {
			hover.dispose();
		}
	}
}

class HoverContextViewDelegate implements IDelegate {

	get anchorPosition() {
		return this._hover.anchor;
	}

	constructor(
		private readonly _hover: HoverWidget,
		private readonly _focus: boolean = false
	) {
	}

	render(container: HTMLElement) {
		this._hover.render(container);
		if (this._focus) {
			this._hover.focus();
		}
		return this._hover;
	}

	getAnchor() {
		return {
			x: this._hover.x,
			y: this._hover.y
		};
	}

	layout() {
		this._hover.layout();
	}
}

registerSingleton(IHoverService, HoverService, true);

registerThemingParticipant((theme, collector) => {
	const hoverBackground = theme.getColor(editorHoverBackground);
	if (hoverBackground) {
		collector.addRule(`.workbench .workbench-hover { background-color: ${hoverBackground}; }`);
		collector.addRule(`.workbench .workbench-hover-pointer:after { background-color: ${hoverBackground}; }`);
	}
});
