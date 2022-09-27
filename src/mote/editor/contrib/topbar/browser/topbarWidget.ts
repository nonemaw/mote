import { setStyles } from 'mote/base/browser/jsx/createElement';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { Button } from 'mote/base/browser/ui/button/button';
import { IContextViewProvider, AnchorAlignment } from 'mote/base/browser/ui/contextview/contextview';
import { IntlProvider } from 'mote/base/common/i18n';
import { IMoteEditor, IOverlayWidget, IOverlayWidgetPosition, OverlayWidgetPositionPreference } from 'mote/editor/browser/editorBrowser';
import { ShareMenu } from 'mote/editor/contrib/topbar/browser/shareMenu';
import { ContextViewHelper } from 'mote/platform/contextview/browser/contextViewHelper';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { Widget } from 'vs/base/browser/ui/widget';
import { Emitter } from 'vs/base/common/event';

export const TopbarDefaultHeight = 45;
export const TopbarDesktopHeight = 37;
export const TopbarTransitionDuration = 700;


export class TopbarWidget extends Widget implements IOverlayWidget {

	private static readonly ID = 'editor.contrib.topbarWidget';

	private readonly _onDidShareBtnClick: Emitter<void> = this._register(new Emitter<void>());
	public readonly onDidShareBtnClick = this._onDidShareBtnClick.event;

	private domNode: HTMLElement;
	private contextViewHelper: ContextViewHelper;

	private shareButton!: Button;

	constructor(
		private readonly editor: IMoteEditor,
		readonly themeService: IThemeService,
		readonly contextViewProvider: IContextViewProvider,
	) {
		super();

		this.domNode = document.createElement('div');
		this.contextViewHelper = new ContextViewHelper(contextViewProvider, themeService);

		this.createDefaultTopbar(this.domNode);

		editor.addOverlayWidget(this);
	}

	private createDefaultTopbar(parent: HTMLElement) {
		const container = document.createElement('div');
		setStyles(container, this.getContainerStyle());

		const shareLabel = this.formatMessage('topbar.share.label', 'Share');
		const shareTooltip = this.formatMessage('topbar.share.tooltip', 'Share your page to the web');
		this.shareButton = this.createButton(shareLabel, shareTooltip, container, () => this.showShareMenu());

		parent.appendChild(container);
	}

	private showShareMenu() {
		this.contextViewHelper.showContextView({
			getAnchor: () => this.shareButton.element,
			anchorAlignment: AnchorAlignment.LEFT,
			getWidget: (container) => new ShareMenu(container, this.editor, this.themeService)
		});
	}

	private formatMessage(id: string, defaultMessage: string) {
		return IntlProvider.formatMessage({ id, defaultMessage });
	}

	private createButton(label: string, tooltip: string, parent: HTMLElement, listener: () => any) {
		const button = new Button(parent, {
			style: {
				paddingLeft: '8px',
				paddingRight: '8px',
				height: '28px',
				borderRadius: '3px',
				display: 'inline-flex',
				alignItems: 'center',
				lineHeight: 1.2
			}
		});
		button.element.innerText = label;
		button.element.title = tooltip;

		button.onDidClick(listener);
		return button;
	}

	getTopbarHeight() {
		return TopbarDefaultHeight;
	}

	getId(): string {
		return TopbarWidget.ID;
	}

	getDomNode(): HTMLElement {
		return this.domNode;
	}
	getPosition(): IOverlayWidgetPosition | null {
		return { preference: OverlayWidgetPositionPreference.TOP_RIGHT_CORNER };
	}

	private getContainerStyle(): CSSProperties {
		return {
			display: 'flex',
			justifyContent: 'space-between',
			alignItems: 'center',
			//position: "absolute",
			overflow: 'hidden',
			height: `${this.getTopbarHeight()}px`,
			left: 0,
			right: 0,
			bottom: 0,
			paddingLeft: '10px',
			paddingRight: '10px'
		};
	}
}
