import * as dom from 'vs/base/browser/dom';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { PartFingerprint, PartFingerprints, ViewPart } from 'mote/editor/browser/view/viewPart';
import { ViewLines } from 'mote/editor/browser/viewParts/lines/viewLines';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ViewportData } from 'mote/editor/common/viewLayout/viewLinesViewportData';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import BlockStore from 'mote/platform/store/common/blockStore';
import { ViewOverlayWidgets } from 'mote/editor/browser/viewParts/overlayWidgets/overlayWidgets';
import { IOverlayWidget, IOverlayWidgetPosition } from 'mote/editor/browser/editorBrowser';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { EditorOption } from 'mote/editor/common/config/editorOptions';
import { EditorScrollbar } from 'mote/editor/browser/viewParts/editorScrollbar/editorScrollbar';
import { ViewLayout } from 'mote/editor/common/viewLayout/viewLayout';
import { ViewLineExtensionsRegistry } from 'mote/editor/browser/viewLineExtensions';
import { TemplatePicker } from 'mote/editor/browser/viewParts/templatePicker/templatePicker';

export interface IOverlayWidgetData {
	widget: IOverlayWidget;
	position: IOverlayWidgetPosition | null;
}


export class EditorView extends ViewEventHandler {

	private readonly context: ViewContext;

	// These are parts, but we must do some API related calls on them, so we keep a reference
	private readonly viewParts: ViewPart[];
	private readonly overlayWidgets: ViewOverlayWidgets;
	private readonly templatePicker: TemplatePicker;
	private readonly viewLines: ViewLines;
	private readonly scrollbar: EditorScrollbar;

	// Dom nodes
	public readonly domNode: FastDomNode<HTMLElement>;
	private readonly overflowGuardContainer: FastDomNode<HTMLElement>;
	private readonly linesContent: FastDomNode<HTMLElement>;
	private readonly headerContainer!: FastDomNode<HTMLElement>;

	constructor(
		configuration: IEditorConfiguration,
		viewController: ViewController,
		private readonly pageStore: BlockStore,
		@IInstantiationService private instantiationService: IInstantiationService,
	) {
		super();

		this.headerContainer = createFastDomNode<HTMLDivElement>(dom.$(''));

		// These two dom nodes must be constructed up front, since references are needed in the layout provider (scrolling & co.)
		this.linesContent = createFastDomNode(document.createElement('div'));
		this.linesContent.setClassName('lines-content' + ' monaco-editor-background');
		// Make sure content is in the center
		this.linesContent.domNode.style.display = 'flex';
		this.linesContent.domNode.style.flexDirection = 'column';
		this.linesContent.domNode.style.alignItems = 'center';
		this.linesContent.domNode.style.position = 'relative';

		const contentStore = pageStore.getContentStore();
		const viewLayout = this._register(this.createViewLayout(configuration, 0));
		viewController.setViewLayout(viewLayout);
		this.context = new ViewContext(configuration, contentStore, viewLayout, viewController);

		// Ensure the view is the first event handler in order to update the layout
		this.context.addEventHandler(this);

		this.viewParts = [];

		this.domNode = createFastDomNode(document.createElement('div'));

		this.overflowGuardContainer = createFastDomNode(document.createElement('div'));
		PartFingerprints.write(this.overflowGuardContainer, PartFingerprint.OverflowGuard);
		this.overflowGuardContainer.setClassName('overflow-guard');

		this.scrollbar = new EditorScrollbar(this.context, this.linesContent, this.domNode, this.overflowGuardContainer);
		this.viewParts.push(this.scrollbar);

		this.templatePicker = this.instantiationService.createInstance(TemplatePicker, this.context, this.linesContent);
		this.viewParts.push(this.templatePicker);

		this.viewLines = this.instantiationService.createInstance(ViewLines, this.context, this.linesContent);

		// Overlay widgets
		this.overlayWidgets = new ViewOverlayWidgets(this.context);
		this.viewParts.push(this.overlayWidgets);

		// -------------- Wire dom nodes up
		this.createHeader(this.linesContent, viewController);
		this.linesContent.appendChild(this.templatePicker.getDomNode());
		this.linesContent.appendChild(this.viewLines.getDomNode());

		this.overflowGuardContainer.appendChild(this.scrollbar.getDomNode());
		this.overflowGuardContainer.appendChild(this.overlayWidgets.getDomNode());

		this.domNode.appendChild(this.overflowGuardContainer);

		this.applyLayout();
	}

	createHeader(parent: FastDomNode<HTMLElement>, viewController: ViewController,) {
		this.createCover(parent);
		const headerDomNode = createFastDomNode(dom.$('div'));
		headerDomNode.setClassName('editor-header view-line');
		const headerContainer = this.headerContainer;

		headerContainer.domNode.style.paddingLeft = this.getSafePaddingLeftCSS(96);
		headerContainer.domNode.style.paddingRight = this.getSafePaddingRightCSS(96);

		const viewLineContrib = ViewLineExtensionsRegistry.getViewLineContribution('text')!;
		const headerHandler = this.instantiationService.createInstance(viewLineContrib.ctor, -1, this.context, viewController, {
			placeholder: 'Untitled', forcePlaceholder: true
		});
		headerHandler.setValue(this.pageStore);
		headerContainer.appendChild(headerHandler.getDomNode());

		this._register(this.pageStore.onDidUpdate(() => {
			headerHandler.setValue(this.pageStore);
		}));

		headerDomNode.appendChild(headerContainer);
		setStyles(headerDomNode.domNode, this.getTitleStyle());
		parent.appendChild(headerDomNode);
	}


	createCover(parent: FastDomNode<HTMLElement>) {
		const coverDomNode = createFastDomNode(dom.$(''));
		coverDomNode.domNode.style.height = '100px';
		parent.appendChild(coverDomNode);
	}

	//#region event handlers

	public override handleEvents(events: viewEvents.ViewEvent[]): void {
		super.handleEvents(events);
		this.scheduleRender();
	}

	public override onConfigurationChanged(e: viewEvents.ViewConfigurationChangedEvent): boolean {
		//this.domNode.setClassName(this._getEditorClassName());
		this.applyLayout();
		return false;
	}

	//#endregion

	public render(now: boolean, everything: boolean): void {
		if (everything) {
			// Force everything to render...
			this.viewLines.forceShouldRender();
			for (const viewPart of this.viewParts) {
				viewPart.forceShouldRender();
			}
		}
		if (now) {
			this.flushAccumulatedAndRenderNow();
		} else {
			this.scheduleRender();
		}
	}

	// Actual mutable state
	private renderAnimationFrame: IDisposable | null = null;

	private scheduleRender(): void {
		if (this.renderAnimationFrame === null) {
			this.renderAnimationFrame = dom.runAtThisOrScheduleAtNextAnimationFrame(this.onRenderScheduled.bind(this), 100);
		}
	}

	private onRenderScheduled(): void {
		this.renderAnimationFrame = null;
		this.flushAccumulatedAndRenderNow();
	}

	private flushAccumulatedAndRenderNow(): void {
		this.renderNow();
	}

	private renderNow(): void {
		safeInvokeNoArg(() => this.actualRender());
	}

	private actualRender(): void {
		if (!dom.isInDOM(this.domNode.domNode)) {
			return;
		}

		let viewPartsToRender = this.getViewPartsToRender();


		if (!this.viewLines.shouldRender() && viewPartsToRender.length === 0) {
			// Nothing to render
			return;
		}

		const viewportData = new ViewportData();

		if (this.viewLines.shouldRender()) {
			this.viewLines.renderLines(viewportData);
			this.viewLines.onDidRender();

			// Rendering of viewLines might cause scroll events to occur, so collect view parts to render again
			viewPartsToRender = this.getViewPartsToRender();
		}

		// Render the rest of the parts
		for (const viewPart of viewPartsToRender) {
			viewPart.prepareRender();
		}

		for (const viewPart of viewPartsToRender) {
			viewPart.render();
			viewPart.onDidRender();
		}
	}

	private getViewPartsToRender(): ViewPart[] {
		const result: ViewPart[] = [];
		let resultLen = 0;
		for (const viewPart of this.viewParts) {
			if (viewPart.shouldRender()) {
				result[resultLen++] = viewPart;
			}
		}
		return result;
	}

	getSafePaddingLeftCSS(padding: number) {
		return `calc(${padding}px + env(safe-area-inset-left))`;
	}

	getSafePaddingRightCSS(padding: number) {
		return `calc(${padding}px + env(safe-area-inset-right))`;
	}

	getTitleStyle(): CSSProperties {
		return {
			fontWeight: 700,
			lineHeight: 1.2,
			fontSize: '40px',
			cursor: 'text',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center'
		};
	}

	public addOverlayWidget(widgetData: IOverlayWidgetData): void {
		this.overlayWidgets.addWidget(widgetData.widget);
		this.layoutOverlayWidget(widgetData);
		this.scheduleRender();
	}

	public layoutOverlayWidget(widgetData: IOverlayWidgetData): void {
		const newPreference = widgetData.position ? widgetData.position.preference : null;
		const shouldRender = this.overlayWidgets.setWidgetPosition(widgetData.widget, newPreference);
		if (shouldRender) {
			this.scheduleRender();
		}
	}

	private applyLayout() {
		const options = this.context.configuration.options;
		const layoutInfo = options.get(EditorOption.LayoutInfo);

		this.domNode.setWidth(layoutInfo.width);
		this.domNode.setHeight(layoutInfo.height);

		this.overflowGuardContainer.setWidth(layoutInfo.width);
		this.overflowGuardContainer.setHeight(layoutInfo.height);

		this.linesContent.setHeight(1000000);

		const padding = layoutInfo.width < 600 ? 24 : 96;
		const paddingLeft = this.getSafePaddingLeftCSS(padding);
		const paddingRight = this.getSafePaddingRightCSS(padding);

		this.headerContainer.domNode.style.paddingLeft = paddingLeft;
		this.headerContainer.domNode.style.paddingRight = paddingRight;

		this.templatePicker.getDomNode().domNode.style.paddingLeft = paddingLeft;
		this.templatePicker.getDomNode().domNode.style.paddingRight = paddingRight;

		this.viewLines.getDomNode().domNode.style.paddingLeft = paddingLeft;
		this.viewLines.getDomNode().domNode.style.paddingRight = paddingRight;

		let width: number;

		if (layoutInfo.width > 1500) {
			width = 900;
		} else if (layoutInfo.width > 1200) {
			width = 720;
		} else {
			width = layoutInfo.width - padding * 2 - 1;
		}

		this.headerContainer.setWidth(width);
		this.templatePicker.getDomNode().setWidth(width);
		this.viewLines.getDomNode().setWidth(width);

	}

	private createViewLayout(configuration: IEditorConfiguration, lineCount: number) {
		return new ViewLayout(configuration, () => this.viewLines && this.viewLines.getDomNode(), dom.scheduleAtNextAnimationFrame);
	}
}

function safeInvokeNoArg(func: Function): any {
	try {
		return func();
	} catch (e) {
		onUnexpectedError(e);
	}
}
