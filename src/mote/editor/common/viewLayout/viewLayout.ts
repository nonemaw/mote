import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { ConfigurationChangedEvent, EditorOption } from 'mote/editor/common/config/editorOptions';
import { ScrollType } from 'mote/editor/common/editorCommon';
import { IViewLayout, Viewport } from 'mote/editor/common/viewlayout';
import { LinesLayout } from 'mote/editor/common/viewLayout/linesLayout';
import { FastDomNode } from 'vs/base/browser/fastDomNode';
import { Event } from 'vs/base/common/event';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { INewScrollPosition, IScrollPosition, Scrollable, ScrollEvent } from 'vs/base/common/scrollable';

class EditorScrollDimensions {

	public readonly width: number;
	public readonly contentWidth: number;
	public readonly scrollWidth: number;

	public readonly height: number;
	public readonly contentHeight: number;
	public readonly scrollHeight: number;

	constructor(
		width: number,
		contentWidth: number,
		height: number,
		contentHeight: number,
	) {
		width = width | 0;
		contentWidth = contentWidth | 0;
		height = height | 0;
		contentHeight = contentHeight | 0;

		if (width < 0) {
			width = 0;
		}
		if (contentWidth < 0) {
			contentWidth = 0;
		}

		if (height < 0) {
			height = 0;
		}
		if (contentHeight < 0) {
			contentHeight = 0;
		}

		this.width = width;
		this.contentWidth = contentWidth;
		this.scrollWidth = Math.max(width, contentWidth);

		this.height = height;
		this.contentHeight = contentHeight;
		this.scrollHeight = Math.max(height, contentHeight);
	}

	public equals(other: EditorScrollDimensions): boolean {
		return (
			this.width === other.width
			&& this.contentWidth === other.contentWidth
			&& this.height === other.height
			&& this.contentHeight === other.contentHeight
		);
	}
}

class EditorScrollable extends Disposable {

	private readonly _scrollable: Scrollable;
	private _dimensions: EditorScrollDimensions;

	public readonly onDidScroll: Event<ScrollEvent>;

	//private readonly _onDidContentSizeChange = this._register(new Emitter<ContentSizeChangedEvent>());
	//public readonly onDidContentSizeChange: Event<ContentSizeChangedEvent> = this._onDidContentSizeChange.event;

	constructor(smoothScrollDuration: number, scheduleAtNextAnimationFrame: (callback: () => void) => IDisposable) {
		super();
		this._dimensions = new EditorScrollDimensions(0, 0, 0, 0);
		this._scrollable = this._register(new Scrollable({
			forceIntegerValues: true,
			smoothScrollDuration,
			scheduleAtNextAnimationFrame
		}));
		this.onDidScroll = this._scrollable.onScroll;
	}

	public getScrollable(): Scrollable {
		return this._scrollable;
	}

	public setSmoothScrollDuration(smoothScrollDuration: number): void {
		this._scrollable.setSmoothScrollDuration(smoothScrollDuration);
	}

	public validateScrollPosition(scrollPosition: INewScrollPosition): IScrollPosition {
		return this._scrollable.validateScrollPosition(scrollPosition);
	}

	public getScrollDimensions(): EditorScrollDimensions {
		return this._dimensions;
	}

	public setScrollDimensions(dimensions: EditorScrollDimensions): void {
		if (this._dimensions.equals(dimensions)) {
			return;
		}

		const oldDimensions = this._dimensions;
		this._dimensions = dimensions;

		this._scrollable.setScrollDimensions({
			width: dimensions.width,
			scrollWidth: dimensions.scrollWidth,
			height: dimensions.height,
			scrollHeight: dimensions.scrollHeight
		}, true);

		const contentWidthChanged = (oldDimensions.contentWidth !== dimensions.contentWidth);
		const contentHeightChanged = (oldDimensions.contentHeight !== dimensions.contentHeight);
		if (contentWidthChanged || contentHeightChanged) {
			/*
			this._onDidContentSizeChange.fire(new ContentSizeChangedEvent(
				oldDimensions.contentWidth, oldDimensions.contentHeight,
				dimensions.contentWidth, dimensions.contentHeight
			));
			*/
		}
	}

	public getFutureScrollPosition(): IScrollPosition {
		return this._scrollable.getFutureScrollPosition();
	}

	public getCurrentScrollPosition(): IScrollPosition {
		return this._scrollable.getCurrentScrollPosition();
	}

	public setScrollPositionNow(update: INewScrollPosition): void {
		this._scrollable.setScrollPositionNow(update);
	}

	public setScrollPositionSmooth(update: INewScrollPosition): void {
		this._scrollable.setScrollPositionSmooth(update);
	}
}

export class ViewLayout extends Disposable implements IViewLayout {

	private readonly scrollable: EditorScrollable;
	private linesLayout!: LinesLayout;

	public readonly onDidScroll: Event<ScrollEvent>;

	constructor(
		private readonly configuration: IEditorConfiguration,
		private readonly viewLineDomProvider: () => FastDomNode<HTMLElement>,
		scheduleAtNextAnimationFrame: (callback: () => void) => IDisposable
	) {
		super();

		const options = this.configuration.options;
		const layoutInfo = options.get(EditorOption.LayoutInfo);
		this.scrollable = this._register(new EditorScrollable(0, scheduleAtNextAnimationFrame));
		this.scrollable.setScrollDimensions(new EditorScrollDimensions(
			layoutInfo.width,
			0,
			layoutInfo.height,
			0
		));
		this.onDidScroll = this.scrollable.onDidScroll;

		this.updateHeight();
	}

	getScrollable(): Scrollable {
		return this.scrollable.getScrollable();
	}

	//#region view event handler

	public onConfigurationChanged(e: ConfigurationChangedEvent): void {
		const options = this.configuration.options;
		if (e.hasChanged(EditorOption.LayoutInfo)) {
			const layoutInfo = options.get(EditorOption.LayoutInfo);
			const width = layoutInfo.width;
			const height = layoutInfo.height;
			const scrollDimensions = this.scrollable.getScrollDimensions();
			const contentWidth = scrollDimensions.contentWidth;
			this.scrollable.setScrollDimensions(new EditorScrollDimensions(
				width,
				scrollDimensions.contentWidth,
				height,
				this._getContentHeight(width, height, contentWidth)
			));
		} else {
			this.updateHeight();
		}
	}

	//#endregion

	private _getContentHeight(width: number, height: number, contentWidth: number): number {
		const viewLinesDom = this.viewLineDomProvider();
		if (viewLinesDom) {
			if (!this.linesLayout) {
				this.linesLayout = new LinesLayout(viewLinesDom.domNode);
				this._register(this.linesLayout.onDidChange(() => this.updateHeight()));
			}
			return viewLinesDom.domNode.clientHeight + 300;
		}
		return height + 200;
	}

	private updateHeight() {
		const scrollDimensions = this.scrollable.getScrollDimensions();
		const width = scrollDimensions.width;
		const height = scrollDimensions.height;
		const contentWidth = scrollDimensions.contentWidth;
		this.scrollable.setScrollDimensions(new EditorScrollDimensions(
			width,
			scrollDimensions.contentWidth,
			height,
			this._getContentHeight(width, height, contentWidth)
		));
	}

	//#region layout

	public getCurrentViewport(): Viewport {
		const scrollDimensions = this.scrollable.getScrollDimensions();
		const currentScrollPosition = this.scrollable.getCurrentScrollPosition();
		return new Viewport(
			currentScrollPosition.scrollTop,
			currentScrollPosition.scrollLeft,
			scrollDimensions.width,
			scrollDimensions.height
		);
	}

	public getFutureViewport(): Viewport {
		const scrollDimensions = this.scrollable.getScrollDimensions();
		const currentScrollPosition = this.scrollable.getFutureScrollPosition();
		return new Viewport(
			currentScrollPosition.scrollTop,
			currentScrollPosition.scrollLeft,
			scrollDimensions.width,
			scrollDimensions.height
		);
	}

	//#endregion

	//#region scroll

	public getContentWidth(): number {
		const scrollDimensions = this.scrollable.getScrollDimensions();
		return scrollDimensions.contentWidth;
	}
	public getScrollWidth(): number {
		const scrollDimensions = this.scrollable.getScrollDimensions();
		return scrollDimensions.scrollWidth;
	}
	public getContentHeight(): number {
		const scrollDimensions = this.scrollable.getScrollDimensions();
		return scrollDimensions.contentHeight;
	}
	public getScrollHeight(): number {
		const scrollDimensions = this.scrollable.getScrollDimensions();
		return scrollDimensions.scrollHeight;
	}

	public getCurrentScrollLeft(): number {
		const currentScrollPosition = this.scrollable.getCurrentScrollPosition();
		return currentScrollPosition.scrollLeft;
	}
	public getCurrentScrollTop(): number {
		const currentScrollPosition = this.scrollable.getCurrentScrollPosition();
		return currentScrollPosition.scrollTop;
	}

	public validateScrollPosition(scrollPosition: INewScrollPosition): IScrollPosition {
		return this.scrollable.validateScrollPosition(scrollPosition);
	}

	public setScrollPosition(position: INewScrollPosition, type: ScrollType): void {
		if (type === ScrollType.Immediate) {
			this.scrollable.setScrollPositionNow(position);
		} else {
			this.scrollable.setScrollPositionSmooth(position);
		}
	}

	public deltaScrollNow(deltaScrollLeft: number, deltaScrollTop: number): void {
		const currentScrollPosition = this.scrollable.getCurrentScrollPosition();
		this.scrollable.setScrollPositionNow({
			scrollLeft: currentScrollPosition.scrollLeft + deltaScrollLeft,
			scrollTop: currentScrollPosition.scrollTop + deltaScrollTop
		});
	}
	//#endregion
}
