import { ViewPaneContainer } from 'mote/workbench/browser/parts/views/viewPaneContainer';
import { IViewContainersRegistry, IViewDescriptor, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation, Extensions as ViewExtensions, ViewContainerLocationToString } from "mote/workbench/common/views";
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { generateUuid } from 'vs/base/common/uuid';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { registerSingleton } from "vs/platform/instantiation/common/extensions";
import { IInstantiationService } from "vs/platform/instantiation/common/instantiation";
import { Registry } from "vs/platform/registry/common/platform";
import { ViewContainerModel } from "../common/viewContainerModel";

interface ICachedViewContainerInfo {
	containerId: string;
}

export class ViewDescriptorService extends Disposable implements IViewDescriptorService {
	declare readonly _serviceBrand: undefined;

	private static readonly COMMON_CONTAINER_ID_PREFIX = 'workbench.views.service';

	private readonly _onDidChangeContainer: Emitter<{ views: IViewDescriptor[]; from: ViewContainer; to: ViewContainer }> = this._register(new Emitter<{ views: IViewDescriptor[]; from: ViewContainer; to: ViewContainer }>());
	readonly onDidChangeContainer: Event<{ views: IViewDescriptor[]; from: ViewContainer; to: ViewContainer }> = this._onDidChangeContainer.event;

	private readonly _onDidChangeLocation: Emitter<{ views: IViewDescriptor[]; from: ViewContainerLocation; to: ViewContainerLocation }> = this._register(new Emitter<{ views: IViewDescriptor[]; from: ViewContainerLocation; to: ViewContainerLocation }>());
	readonly onDidChangeLocation: Event<{ views: IViewDescriptor[]; from: ViewContainerLocation; to: ViewContainerLocation }> = this._onDidChangeLocation.event;

	private readonly _onDidChangeContainerLocation: Emitter<{ viewContainer: ViewContainer; from: ViewContainerLocation; to: ViewContainerLocation }> = this._register(new Emitter<{ viewContainer: ViewContainer; from: ViewContainerLocation; to: ViewContainerLocation }>());
	readonly onDidChangeContainerLocation: Event<{ viewContainer: ViewContainer; from: ViewContainerLocation; to: ViewContainerLocation }> = this._onDidChangeContainerLocation.event;

	private readonly viewContainerModels: Map<ViewContainer, { viewContainerModel: ViewContainerModel; disposable: IDisposable }>;

	private readonly viewsRegistry: IViewsRegistry;
	private readonly viewContainersRegistry: IViewContainersRegistry;

	private cachedViewInfo: Map<string, ICachedViewContainerInfo>;
	private cachedViewContainerInfo: Map<string, ViewContainerLocation>;

	private readonly _onDidChangeViewContainers = this._register(new Emitter<{ added: ReadonlyArray<{ container: ViewContainer; location: ViewContainerLocation }>; removed: ReadonlyArray<{ container: ViewContainer; location: ViewContainerLocation }> }>());
	readonly onDidChangeViewContainers = this._onDidChangeViewContainers.event;
	get viewContainers(): ReadonlyArray<ViewContainer> { return this.viewContainersRegistry.all; }

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		this.viewContainerModels = new Map<ViewContainer, { viewContainerModel: ViewContainerModel; disposable: IDisposable }>();

		this.cachedViewContainerInfo = new Map();
		this.cachedViewInfo = new Map();

		this.viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);
		this.viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

		// Register all containers that were registered before this ctor
		this.viewContainers.forEach(viewContainer => this.onDidRegisterViewContainer(viewContainer));

		this._register(this.viewsRegistry.onViewsRegistered(views => this.onDidRegisterViews(views)));
		this._register(this.viewsRegistry.onViewsDeregistered(({ views, viewContainer }) => this.onDidDeregisterViews(views, viewContainer)));
		this._register(this.viewContainersRegistry.onDidRegister(({ viewContainer }) => {
			this.onDidRegisterViewContainer(viewContainer);
			this._onDidChangeViewContainers.fire({ added: [{ container: viewContainer, location: this.getViewContainerLocation(viewContainer) }], removed: [] });
		}));
	}

	getDefaultViewContainer(location: ViewContainerLocation): ViewContainer | undefined {
		return this.viewContainersRegistry.getDefaultViewContainer(location);
	}

	getViewContainerById(id: string): ViewContainer | null {
		return this.viewContainersRegistry.get(id) || null;
	}

	getViewContainerLocation(viewContainer: ViewContainer): ViewContainerLocation {
		const location = this.cachedViewContainerInfo.get(viewContainer.id);
		return location !== undefined ? location : this.getDefaultViewContainerLocation(viewContainer);
	}

	getDefaultViewContainerLocation(viewContainer: ViewContainer): ViewContainerLocation {
		return this.viewContainersRegistry.getViewContainerLocation(viewContainer);
	}

	getViewContainersByLocation(location: ViewContainerLocation): ViewContainer[] {
		return this.viewContainers.filter(v => this.getViewContainerLocation(v) === location);
	}

	getViewContainerModel(container: ViewContainer): ViewContainerModel {
		return this.getOrRegisterViewContainerModel(container);
	}

	getViewDescriptorById(viewId: string): IViewDescriptor | null {
		return this.viewsRegistry.getView(viewId);
	}

	getDefaultContainerById(viewId: string): ViewContainer | null {
		return this.viewsRegistry.getViewContainer(viewId) ?? null;
	}

	private getViewsByContainer(viewContainer: ViewContainer): IViewDescriptor[] {
		const views = this.viewsRegistry.getViews(viewContainer);
		const result = views.filter(viewDescriptor => {
			const cachedContainer = this.cachedViewInfo.get(viewDescriptor.id)?.containerId || viewContainer.id;
			return cachedContainer === viewContainer.id;
		});

		for (const [viewId, containerInfo] of this.cachedViewInfo.entries()) {
			if (!containerInfo || containerInfo.containerId !== viewContainer.id) {
				continue;
			}

			if (this.viewsRegistry.getViewContainer(viewId) === viewContainer) {
				continue;
			}

			const viewDescriptor = this.getViewDescriptorById(viewId);
			if (viewDescriptor) {
				result.push(viewDescriptor);
			}
		}

		return result;
	}

	private onDidRegisterViews(views: { views: IViewDescriptor[]; viewContainer: ViewContainer }[]): void {
		views.forEach(({ views, viewContainer }) => {
			// When views are registered, we need to regroup them based on the cache
			const regroupedViews = this.regroupViews(viewContainer.id, views);

			// Once they are grouped, try registering them which occurs
			// if the container has already been registered within this service
			// or we can generate the container from the source view id
			this.registerGroupedViews(regroupedViews);
		});
	}

	private registerGroupedViews(groupedViews: Map<string, { cachedContainerInfo?: ICachedViewContainerInfo; views: IViewDescriptor[] }>): void {
		// Register views that have already been registered to their correct view containers
		for (const containerId of groupedViews.keys()) {
			const viewContainer = this.viewContainersRegistry.get(containerId);
			const containerData = groupedViews.get(containerId)!;

			// The container has not been registered yet
			if (!viewContainer || !this.viewContainerModels.has(viewContainer)) {
				if (containerData.cachedContainerInfo && this.isGeneratedContainerId(containerData.cachedContainerInfo.containerId)) {
					if (!this.viewContainersRegistry.get(containerId)) {
						this.registerGeneratedViewContainer(this.cachedViewContainerInfo.get(containerId)!, containerId);
					}
				}

				// Registration of a generated container handles registration of its views
				continue;
			}

			// Filter out views that have already been added to the view container model
			// This is needed when statically-registered views are moved to
			// other statically registered containers as they will both try to add on startup
			const viewsToAdd = containerData.views.filter(view => this.getViewContainerModel(viewContainer).allViewDescriptors.filter(vd => vd.id === view.id).length === 0);
			this.addViews(viewContainer, viewsToAdd);
		}
	}

	private deregisterGroupedViews(groupedViews: Map<string, { cachedContainerInfo?: ICachedViewContainerInfo; views: IViewDescriptor[] }>): void {
		// Register views that have already been registered to their correct view containers
		for (const viewContainerId of groupedViews.keys()) {
			const viewContainer = this.viewContainersRegistry.get(viewContainerId);

			// The container has not been registered yet
			if (!viewContainer || !this.viewContainerModels.has(viewContainer)) {
				continue;
			}

			this.removeViews(viewContainer, groupedViews.get(viewContainerId)!.views);
		}
	}

	private removeViews(container: ViewContainer, views: IViewDescriptor[]): void {
		// Remove the views
		this.getViewContainerModel(container).remove(views);
	}

	// Generated Container Id Format
	// {Common Prefix}.{Location}.{Uniqueness Id}
	// Old Format (deprecated)
	// {Common Prefix}.{Uniqueness Id}.{Source View Id}
	private generateContainerId(location: ViewContainerLocation): string {
		return `${ViewDescriptorService.COMMON_CONTAINER_ID_PREFIX}.${ViewContainerLocationToString(location as any)}.${generateUuid()}`;
	}

	private registerGeneratedViewContainer(location: ViewContainerLocation, existingId?: string): ViewContainer {
		const id = existingId || this.generateContainerId(location);

		const container = this.viewContainersRegistry.registerViewContainer({
			id,
			ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [id, { mergeViewWithContainerWhenSingleView: true, donotShowContainerTitleWhenMergedWithContainer: true }]),
			title: id, // we don't want to see this so using id
			//icon: location === ViewContainerLocation.Sidebar ? defaultViewIcon : undefined,
			//storageId: getViewContainerStorageId(id),
			hideIfEmpty: true
		}, location, { donotRegisterOpenCommand: true });

		const cachedInfo = this.cachedViewContainerInfo.get(container.id);
		if (cachedInfo !== location) {
			this.cachedViewContainerInfo.set(container.id, location);
		}

		return container;
	}

	private regroupViews(containerId: string, views: IViewDescriptor[]): Map<string, { cachedContainerInfo?: ICachedViewContainerInfo; views: IViewDescriptor[] }> {
		const ret = new Map<string, { cachedContainerInfo?: ICachedViewContainerInfo; views: IViewDescriptor[] }>();

		views.forEach(viewDescriptor => {
			const containerInfo = this.cachedViewInfo.get(viewDescriptor.id);
			const correctContainerId = containerInfo?.containerId || containerId;

			const containerData = ret.get(correctContainerId) || { cachedContainerInfo: containerInfo, views: [] };
			containerData.views.push(viewDescriptor);
			ret.set(correctContainerId, containerData);
		});

		return ret;
	}

	private isGeneratedContainerId(id: string): boolean {
		return id.startsWith(ViewDescriptorService.COMMON_CONTAINER_ID_PREFIX);
	}

	private onDidDeregisterViews(views: IViewDescriptor[], viewContainer: ViewContainer): void {
		// When views are registered, we need to regroup them based on the cache
		const regroupedViews = this.regroupViews(viewContainer.id, views);
		this.deregisterGroupedViews(regroupedViews);
	}

	private onDidRegisterViewContainer(viewContainer: ViewContainer): void {
		this.getOrRegisterViewContainerModel(viewContainer);
	}

	private getOrRegisterViewContainerModel(viewContainer: ViewContainer): ViewContainerModel {
		let viewContainerModel = this.viewContainerModels.get(viewContainer)?.viewContainerModel;

		if (!viewContainerModel) {
			const disposables = new DisposableStore();
			viewContainerModel = disposables.add(this.instantiationService.createInstance(ViewContainerModel, viewContainer));

			//this.onDidChangeActiveViews({ added: viewContainerModel.activeViewDescriptors, removed: [] });
			//viewContainerModel.onDidChangeActiveViewDescriptors(changed => this.onDidChangeActiveViews(changed), this, disposables);

			this.viewContainerModels.set(viewContainer, { viewContainerModel: viewContainerModel, disposable: disposables });

			// Add views that were registered prior to this view container
			let viewsToRegister = this.getViewsByContainer(viewContainer)
			viewsToRegister = viewsToRegister.filter(view => {
				const container = this.getDefaultContainerById(view.id);
				console.log(container, viewContainer);
				return container !== viewContainer;
			});
			if (viewsToRegister.length) {
				this.addViews(viewContainer, viewsToRegister);
			}
		}

		return viewContainerModel;
	}

	private addViews(container: ViewContainer, views: IViewDescriptor[]): void {
		this.getViewContainerModel(container).add(views.map(view => {
			return {
				viewDescriptor: view,
				//collapsed: visibilityState === ViewVisibilityState.Default ? undefined : false,
				//visible: visibilityState === ViewVisibilityState.Default ? undefined : true
			};
		}));
	}

	isViewContainerRemovedPermanently(viewContainerId: string): boolean {
		return this.isGeneratedContainerId(viewContainerId) && !this.cachedViewContainerInfo.has(viewContainerId);
	}
}

registerSingleton(IViewDescriptorService, ViewDescriptorService);
