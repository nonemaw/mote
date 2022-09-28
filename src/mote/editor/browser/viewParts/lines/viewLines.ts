import 'vs/css!./viewLines';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { IVisibleLinesHost } from 'mote/editor/browser/view/viewLayer';
import { ViewPart } from 'mote/editor/browser/view/viewPart';
import { ViewLine } from 'mote/editor/browser/viewParts/lines/viewLine';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { ViewportData } from 'mote/editor/common/viewLayout/viewLinesViewportData';
import { clearNode } from 'vs/base/browser/dom';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';
import { ConfigurationChangedEvent } from 'mote/editor/common/config/editorOptions';

export class ViewLines extends ViewPart implements IVisibleLinesHost<ViewLine> {

	private domNode: FastDomNode<HTMLElement>;

	private readonly viewController: ViewController;
	private lines: ViewLine[] = [];

	// config
	private canUseLayerHinting: boolean = true;

	constructor(
		context: ViewContext,

		private readonly linesContent: FastDomNode<HTMLElement>,
		@IInstantiationService private instantiationService: IInstantiationService,
	) {
		super(context);
		this.viewController = context.controller;

		this.domNode = createFastDomNode(document.createElement('div'));
		this.domNode.setClassName('view-lines');
		this.domNode.setAttribute('data-root', '');
		this.domNode.domNode.style.lineHeight = '1.5';
		this.domNode.domNode.style.fontSize = '16px';

		this._register(this.context.contentStore.onDidUpdate(() => {
			this.renderLines({});
		}));
	}

	public getDomNode(): FastDomNode<HTMLElement> {
		return this.domNode;
	}

	public createVisibleLine(): ViewLine {
		return this.instantiationService.createInstance(ViewLine, this.context, this.viewController);
	}

	public prepareRender(): void {

	}
	public render(): void {
		throw new Error('Method not implemented.');
	}

	public renderLines(viewportData: ViewportData) {
		// (1) render lines - ensures lines are in the DOM
		const pageIds: string[] = this.context.contentStore.getValue() || [];
		clearNode(this.domNode.domNode);
		pageIds.forEach((pageId, idx) => {
			const blockStore = StoreUtils.createStoreForPageId(pageId, this.context.contentStore);
			const viewLine = this.createVisibleLine();
			this.lines[idx] = viewLine;
			viewLine.renderLine(idx, blockStore);
			if (viewLine.getDomNode()) {
				this.domNode.appendChild(viewLine.getDomNode()!);
			}
			this._register(blockStore.onDidUpdate((e) => {
				const viewLineNode = this.lines[idx].getDomNode()!.domNode;

				const viewLine = this.createVisibleLine();
				this.lines[idx] = viewLine;
				viewLine.renderLine(idx, blockStore);

				const childNode = viewLine.getDomNode();
				if (childNode) {
					this.domNode.domNode.replaceChild(childNode.domNode, viewLineNode);
				}
			}));

		});

		// (2) compute horizontal scroll position:
		//  - this must happen after the lines are in the DOM since it might need a line that rendered just now
		//  - it might change `scrollWidth` and `scrollLeft`

		// (3) handle scrolling
		this.linesContent.setLayerHinting(this.canUseLayerHinting);
		this.linesContent.setContain('strict');
		const adjustedScrollTop = this.context.viewLayout.getCurrentScrollTop();
		this.linesContent.setTop(-adjustedScrollTop);

		// TODO fixme, use it to let viewlayout know the content change
		this.context.viewLayout.onConfigurationChanged(new ConfigurationChangedEvent([]));
	}

	//#region view events handler

	public override onLinesInserted(e: viewEvents.ViewLinesInsertedEvent): boolean {
		return true;
	}

	public override onLinesDeleted(e: viewEvents.ViewLinesDeletedEvent): boolean {
		return true;
	}

	public override onLinesChanged(e: viewEvents.ViewLinesChangedEvent): boolean {
		return true;
	}

	public override onScrollChanged(e: viewEvents.ViewScrollChangedEvent): boolean {
		const adjustedScrollTop = this.context.viewLayout.getCurrentScrollTop();
		this.linesContent.setTop(-adjustedScrollTop);
		return false;
	}

	//#endregion
}
