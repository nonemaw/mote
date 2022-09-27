import * as dom from 'vs/base/browser/dom';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { PartFingerprint, PartFingerprints, ViewPart } from 'mote/editor/browser/view/viewPart';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { IOverviewRulerLayoutInfo, SmoothScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { INewScrollPosition, ScrollbarVisibility } from 'vs/base/common/scrollable';
import { ScrollableElementCreationOptions } from 'vs/base/browser/ui/scrollbar/scrollableElementOptions';
import { EditorOption } from 'mote/editor/common/config/editorOptions';
import { ScrollType } from 'mote/editor/common/editorCommon';

export class EditorScrollbar extends ViewPart {


	private readonly scrollbar: SmoothScrollableElement;
	private readonly scrollbarDomNode: FastDomNode<HTMLElement>;

	constructor(
		context: ViewContext,
		linesContent: FastDomNode<HTMLElement>,
		viewDomNode: FastDomNode<HTMLElement>,
		overflowGuardDomNode: FastDomNode<HTMLElement>
	) {
		super(context);

		const scrollbarOptions: ScrollableElementCreationOptions = {
			listenOnDomNode: viewDomNode.domNode,
			className: 'editor-scrollable',
			useShadows: false,
			lazyRender: true,

			vertical: ScrollbarVisibility.Auto,
		};

		this.scrollbar = this._register(new SmoothScrollableElement(linesContent.domNode, scrollbarOptions, context.viewLayout.getScrollable()));
		PartFingerprints.write(this.scrollbar.getDomNode(), PartFingerprint.ScrollableElement);
		this.scrollbarDomNode = createFastDomNode(this.scrollbar.getDomNode());
		this.setLayout();

		const onBrowserDesperateReveal = (domNode: HTMLElement, lookAtScrollTop: boolean, lookAtScrollLeft: boolean) => {
			const newScrollPosition: INewScrollPosition = {};
			console.log('on scroll');
			if (lookAtScrollTop) {
				const deltaTop = domNode.scrollTop;
				if (deltaTop) {
					newScrollPosition.scrollTop = this.context.viewLayout.getCurrentScrollTop() + deltaTop;
					domNode.scrollTop = 0;
				}
			}

			if (lookAtScrollLeft) {
				const deltaLeft = domNode.scrollLeft;
				if (deltaLeft) {
					newScrollPosition.scrollLeft = this.context.viewLayout.getCurrentScrollLeft() + deltaLeft;
					domNode.scrollLeft = 0;
				}
			}

			this.context.viewLayout.setScrollPosition(newScrollPosition, ScrollType.Immediate);
		};

		// I've seen this happen both on the view dom node & on the lines content dom node.
		this._register(dom.addDisposableListener(viewDomNode.domNode, 'scroll', (e: Event) => onBrowserDesperateReveal(viewDomNode.domNode, true, true)));
		this._register(dom.addDisposableListener(linesContent.domNode, 'scroll', (e: Event) => onBrowserDesperateReveal(linesContent.domNode, true, false)));
		this._register(dom.addDisposableListener(overflowGuardDomNode.domNode, 'scroll', (e) => onBrowserDesperateReveal(overflowGuardDomNode.domNode, true, false)));
		this._register(dom.addDisposableListener(this.scrollbarDomNode.domNode, 'scroll', (e) => onBrowserDesperateReveal(this.scrollbarDomNode.domNode, true, false)));
	}

	public getOverviewRulerLayoutInfo(): IOverviewRulerLayoutInfo {
		return this.scrollbar.getOverviewRulerLayoutInfo();
	}

	public getDomNode(): FastDomNode<HTMLElement> {
		return this.scrollbarDomNode;
	}

	public override onScrollChanged(e: viewEvents.ViewScrollChangedEvent): boolean {
		return true;
	}

	public prepareRender(): void {

	}
	public render(): void {
		this.scrollbar.renderNow();
	}

	private setLayout() {
		const options = this.context.configuration.options;
		const layoutInfo = options.get(EditorOption.LayoutInfo);
		this.scrollbarDomNode.setHeight(layoutInfo.height);
	}
}
