import { IOverlayWidget, OverlayWidgetPositionPreference } from 'mote/editor/browser/editorBrowser';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { PartFingerprint, PartFingerprints, ViewPart } from 'mote/editor/browser/view/viewPart';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';

interface IWidgetData {
	widget: IOverlayWidget;
	preference: OverlayWidgetPositionPreference | null;
	domNode: FastDomNode<HTMLElement>;
}

interface IWidgetMap {
	[key: string]: IWidgetData;
}

export class ViewOverlayWidgets extends ViewPart {

	private widgets: IWidgetMap;
	private readonly domNode: FastDomNode<HTMLElement>;

	constructor(context: ViewContext) {
		super(context);

		this.widgets = {};

		this.domNode = createFastDomNode(document.createElement('div'));
		PartFingerprints.write(this.domNode, PartFingerprint.OverlayWidgets);
		this.domNode.setClassName('overlayWidgets');
	}

	public override dispose(): void {
		super.dispose();
		this.widgets = {};
	}

	public getDomNode(): FastDomNode<HTMLElement> {
		return this.domNode;
	}

	public addWidget(widget: IOverlayWidget): void {
		const domNode = createFastDomNode(widget.getDomNode());

		this.widgets[widget.getId()] = {
			widget: widget,
			preference: null,
			domNode: domNode
		};

		// This is sync because a widget wants to be in the dom
		domNode.setPosition('absolute');
		domNode.setAttribute('widgetId', widget.getId());
		this.domNode.appendChild(domNode);

		this.setShouldRender();
	}

	public setWidgetPosition(widget: IOverlayWidget, preference: OverlayWidgetPositionPreference | null): boolean {
		const widgetData = this.widgets[widget.getId()];
		if (widgetData.preference === preference) {
			return false;
		}

		widgetData.preference = preference;
		this.setShouldRender();

		return true;
	}

	public removeWidget(widget: IOverlayWidget): void {
		const widgetId = widget.getId();
		if (this.widgets.hasOwnProperty(widgetId)) {
			const widgetData = this.widgets[widgetId];
			const domNode = widgetData.domNode.domNode;
			delete this.widgets[widgetId];

			domNode.parentNode!.removeChild(domNode);
			this.setShouldRender();
		}
	}

	private renderWidget(widgetData: IWidgetData): void {
		const domNode = widgetData.domNode;

		if (widgetData.preference === null) {
			domNode.setTop('');
			return;
		}

		if (widgetData.preference === OverlayWidgetPositionPreference.TOP_RIGHT_CORNER) {
			domNode.setTop(0);
			domNode.setRight(50);
			//domNode.setRight((2 * this._verticalScrollbarWidth) + this._minimapWidth);
		} else if (widgetData.preference === OverlayWidgetPositionPreference.BOTTOM_RIGHT_CORNER) {
			//const widgetHeight = domNode.domNode.clientHeight;
			//domNode.setTop((this._editorHeight - widgetHeight - 2 * this._horizontalScrollbarHeight));
			//domNode.setRight((2 * this._verticalScrollbarWidth) + this._minimapWidth);
		} else if (widgetData.preference === OverlayWidgetPositionPreference.TOP_CENTER) {
			domNode.setTop(0);
			domNode.domNode.style.right = '50%';
		}
	}

	public prepareRender(): void {

	}
	public render(): void {
		const keys = Object.keys(this.widgets);
		for (let i = 0, len = keys.length; i < len; i++) {
			const widgetId = keys[i];
			this.renderWidget(this.widgets[widgetId]);
		}
	}

}
