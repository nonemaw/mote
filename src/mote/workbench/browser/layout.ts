/* eslint-disable code-no-unexternalized-strings */
import { Disposable } from "vs/base/common/lifecycle";
import { IWorkbenchLayoutService, Parts } from "mote/workbench/services/layout/browser/layoutService";
import { Dimension, getClientArea, IDimension, position, size } from "vs/base/browser/dom";
import { Part } from "./part";
import { Emitter } from "vs/base/common/event";
import { ILogService } from "vs/platform/log/common/log";
import { ServicesAccessor } from "vs/platform/instantiation/common/instantiation";
import { IPaneCompositePartService } from "../services/panecomposite/browser/panecomposite";
import { DeferredPromise, Promises } from "vs/base/common/async";
import { IViewDescriptorService, ViewContainerLocation } from "../common/views";
import { ISerializableView, ISerializedGrid, ISerializedLeafNode, ISerializedNode, Orientation, SerializableGrid } from "vs/base/browser/ui/grid/grid";
import { mark } from "vs/base/common/performance";

export abstract class Layout extends Disposable implements IWorkbenchLayoutService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidLayout = this._register(new Emitter<IDimension>());
	readonly onDidLayout = this._onDidLayout.event;

	//#region Properties

	readonly hasContainer = true;
	readonly container = document.createElement('div');

	private _dimension!: IDimension;
	get dimension(): IDimension { return this._dimension; }

	offset?: { top: number } | undefined;

	//#endregion

	private readonly parts = new Map<string, Part>();

	private initialized = false;
	private workbenchGrid!: SerializableGrid<ISerializableView>;

	private activityBarPartView!: ISerializableView;

	protected logService!: ILogService;

	//#region workbench services
	private paneCompositeService!: IPaneCompositePartService;
	private viewDescriptorService!: IViewDescriptorService;

	//#endregion

	private disposed = false;

	constructor(
		protected readonly parent: HTMLElement
	) {
		super();
	}

	isVisible(part: Parts): boolean {
		if (this.initialized) {

		}
		return true;
	}

	setPartHidden(hidden: boolean, part: Parts.SIDEBAR_PART | Parts.EDITOR_PART): void {
		//throw new Error("Method not implemented.");
	}

	protected initLayout(accessor: ServicesAccessor): void {
		this.logService.debug("[Layout] initLayout");
		// Services
		//const themeService = accessor.get(IThemeService);

		this.paneCompositeService = accessor.get(IPaneCompositePartService);
		this.viewDescriptorService = accessor.get(IViewDescriptorService);
	}


	focus(): void {
		throw new Error("Method not implemented.");
	}

	registerPart(part: Part): void {
		this.parts.set(part.getId(), part);
	}

	protected getPart(key: Parts): Part {
		const part = this.parts.get(key);
		if (!part) {
			throw new Error(`Unknown part ${key}`);
		}

		return part;
	}

	protected createWorkbenchLayout(): void {
		const sideBar = this.getPart(Parts.SIDEBAR_PART);
		const editorPart = this.getPart(Parts.EDITOR_PART);
		const activityBar = this.getPart(Parts.ACTIVITYBAR_PART);

		this.activityBarPartView = activityBar;

		const viewMap: { [key: string]: Part } = {
			[Parts.ACTIVITYBAR_PART]: activityBar,
			[Parts.SIDEBAR_PART]: sideBar,
			[Parts.EDITOR_PART]: editorPart,
		};

		const fromJSON = ({ type }: { type: Parts }) => viewMap[type];
		const workbenchGrid = SerializableGrid.deserialize(
			this.createGridDescriptor(),
			{ fromJSON },
			{ proportionalLayout: false }
		);

		this.container.prepend(workbenchGrid.element);
		this.container.setAttribute('role', 'application');
		this.container.classList.add('workbench');
		this.workbenchGrid = workbenchGrid;
	}

	private getClientArea(): Dimension {
		return getClientArea(this.parent);
	}

	layout(): void {
		if (!this.disposed) {
			this._dimension = this.getClientArea();

			position(this.container, 0, 0, 0, 0, 'relative');
			size(this.container, this._dimension.width, this._dimension.height);

			// Layout the grid widget
			this.workbenchGrid.layout(this._dimension.width, this._dimension.height);
			this.initialized = true;

			// Emit as event
			this._onDidLayout.fire(this._dimension);
		}
	}

	private readonly whenReadyPromise = new DeferredPromise<void>();
	protected readonly whenReady = this.whenReadyPromise.p;

	private readonly whenRestoredPromise = new DeferredPromise<void>();
	readonly whenRestored = this.whenRestoredPromise.p;
	private restored = false;

	isRestored(): boolean {
		return this.restored;
	}

	protected restoreParts(): void {

		// distinguish long running restore operations that
		// are required for the layout to be ready from those
		// that are needed to signal restoring is done
		const layoutReadyPromises: Promise<unknown>[] = [];
		const layoutRestoredPromises: Promise<unknown>[] = [];

		// Restore editors
		layoutReadyPromises.push((async () => {
			mark('code/willRestoreEditors');

		})());

		// Restore Sidebar
		layoutReadyPromises.push((async () => {
			let viewlet = null;// await this.paneCompositeService.openPaneComposite(FILES_VIEWLET_ID, ViewContainerLocation.Sidebar);
			if (!viewlet) {
				viewlet = await this.paneCompositeService.openPaneComposite(
					this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Sidebar)?.id, ViewContainerLocation.Sidebar); // fallback to default viewlet as needed
			}

			this.logService.debug("[Layout] did restore SideBar viewlet", viewlet);
		})());

		// Await for promises that we recorded to update
		// our ready and restored states properly.
		Promises.settled(layoutReadyPromises).finally(() => {
			this.whenReadyPromise.complete();

			Promises.settled(layoutRestoredPromises).finally(() => {
				this.restored = true;
				this.whenRestoredPromise.complete();
			});
		});
	}

	private createGridDescriptor(): ISerializedGrid {

		const width = 1080;
		const height = 800;
		const sideBarSize = 200;
		//const panelSize = 300;

		const titleBarHeight = 0;
		const middleSectionHeight = height - titleBarHeight;
		const activityBarWidth = this.activityBarPartView.minimumWidth;

		const activityBarNode: ISerializedLeafNode = {
			type: 'leaf',
			data: { type: Parts.ACTIVITYBAR_PART },
			size: activityBarWidth,
			visible: true,
		};

		const sideBarNode: ISerializedLeafNode = {
			type: 'leaf',
			data: { type: Parts.SIDEBAR_PART },
			size: sideBarSize,
			visible: true
		};

		const editorNode: ISerializedLeafNode = {
			type: 'leaf',
			data: { type: Parts.EDITOR_PART },
			size: 1080, // Update based on sibling sizes
			visible: true
		};

		const middleSection: ISerializedNode[] = [activityBarNode, sideBarNode, editorNode];

		const result: ISerializedGrid = {
			root: {
				type: 'branch',
				size: width,
				data: [
					{
						type: 'branch',
						data: middleSection,
						size: middleSectionHeight
					}
				]
			},
			orientation: Orientation.VERTICAL,
			width,
			height
		};

		return result;
	}
}
