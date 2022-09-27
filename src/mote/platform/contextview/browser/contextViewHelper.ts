import { Event } from 'vs/base/common/event';
import { AnchorAlignment, AnchorAxisAlignment, AnchorPosition, IAnchor, IContextViewProvider } from 'mote/base/browser/ui/contextview/contextview';
import { attachMenuStyler } from 'mote/platform/theme/common/styler';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { IThemable } from 'vs/base/common/styler';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { StandardMouseEvent } from 'vs/base/browser/mouseEvent';

export interface IDelegate {
	getAnchor(): HTMLElement | IAnchor;
	getWidget(container: HTMLElement): IWidget;
	anchorAlignment?: AnchorAlignment; // default: left
	anchorPosition?: AnchorPosition; // default: below
	anchorAxisAlignment?: AnchorAxisAlignment; // default: vertical,
	debug?: boolean;
}

interface IWidget extends IThemable {
	onDidBlur?: Event<void>;
}

export class ContextViewHelper {

	constructor(
		private readonly contextViewProvider: IContextViewProvider,
		private readonly themeService: IThemeService,
	) {

	}

	showContextView(delegate: IDelegate) {
		this.contextViewProvider.showContextView({
			...delegate,
			render: (container: HTMLElement) => {
				const widgetDisposables = new DisposableStore();
				const widget = delegate.getWidget(container);

				widgetDisposables.add(attachMenuStyler(widget, this.themeService));

				if (widget.onDidBlur) {
					widget.onDidBlur(() => this.contextViewProvider.hideContextView(), null, widgetDisposables);
				}

				if (!delegate.debug) {
					widgetDisposables.add(addDisposableListener(window, EventType.BLUR, () => this.contextViewProvider.hideContextView()));
					widgetDisposables.add(addDisposableListener(window, EventType.MOUSE_DOWN, (e: MouseEvent) => {
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

						this.contextViewProvider.hideContextView();
					}));
				}

				return widgetDisposables;
			}
		});
	}

	hideContextView() {
		this.contextViewProvider.hideContextView();
	}
}
