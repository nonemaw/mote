import { registerIcon } from 'mote/platform/theme/common/iconRegistry';
import { ThemeIcon } from 'mote/platform/theme/common/themeService';
import { flatten } from "vs/base/common/arrays";
import { SetMap } from "vs/base/common/collections";
import { Emitter, Event } from "vs/base/common/event";
import { Disposable, IDisposable, toDisposable } from "vs/base/common/lifecycle";
import { getOrSet } from "vs/base/common/map";
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { SyncDescriptor } from "vs/platform/instantiation/common/descriptors";
import { createDecorator } from "vs/platform/instantiation/common/instantiation";
import { Registry } from "vs/platform/registry/common/platform";
import { IPaneComposite } from "./panecomposite";
import { Codicon } from 'vs/base/common/codicons';

export const defaultViewIcon = registerIcon('default-view-icon', Codicon.window, localize('defaultViewIcon', 'Default view icon.'));


export namespace Extensions {
	export const ViewContainersRegistry = 'workbench.registry.view.containers';
	export const ViewsRegistry = 'workbench.registry.view';
}

export const enum ViewContainerLocation {
	Sidebar,
	Panel,
	AuxiliaryBar
}

export const ViewContainerLocations = [ViewContainerLocation.Sidebar,/*ViewContainerLocation.Panel, ViewContainerLocation.AuxiliaryBar*/];


export function ViewContainerLocationToString(viewContainerLocation: ViewContainerLocation) {
	switch (viewContainerLocation) {
		case ViewContainerLocation.Sidebar: return 'sidebar';
		case ViewContainerLocation.Panel: return 'panel';
		case ViewContainerLocation.AuxiliaryBar: return 'auxiliarybar';
	}
}

type OpenCommandActionDescriptor = {
	readonly id: string;
	readonly title?: string;
	readonly mnemonicTitle?: string;
	readonly order?: number;
	//readonly keybindings?: IKeybindings & { when?: ContextKeyExpression };
};

interface ViewOrderDelegate {
	getOrder(group?: string): number | undefined;
}

export interface IViewContainerDescriptor {

	/**
	 * The id of the view container
	 */
	readonly id: string;

	/**
	 * The title of the view container
	 */
	readonly title: string;

	/**
	 * Icon representation of the View container
	 */
	readonly icon?: ThemeIcon | URI;

	/**
	 * Order of the view container.
	 */
	readonly order?: number;

	/**
	 * IViewPaneContainer Ctor to instantiate
	 */
	readonly ctorDescriptor: SyncDescriptor<IViewPaneContainer>;

	/**
	 * Descriptor for open view container command
	 * If not provided, view container info (id, title) is used.
	 *
	 * Note: To prevent registering open command, use `donotRegisterOpenCommand` flag while registering the view container
	 */
	readonly openCommandActionDescriptor?: OpenCommandActionDescriptor;

	/**
	 * Storage id to use to store the view container state.
	 * If not provided, it will be derived.
	 */
	readonly storageId?: string;

	/**
	 * If enabled, view container is not shown if it has no active views.
	 */
	readonly hideIfEmpty?: boolean;

	/**
	 * Id of the extension that contributed the view container
	 */
	readonly extensionId?: any;

	readonly alwaysUseContainerInfo?: boolean;

	readonly viewOrderDelegate?: ViewOrderDelegate;

	readonly rejectAddedViews?: boolean;

	requestedIndex?: number;
}

export interface ViewContainer extends IViewContainerDescriptor { }

export interface IViewContainersRegistry {
	/**
	 * An event that is triggered when a view container is registered.
	 */
	readonly onDidRegister: Event<{ viewContainer: ViewContainer; viewContainerLocation: ViewContainerLocation }>;

	/**
	 * An event that is triggered when a view container is deregistered.
	 */
	//readonly onDidDeregister: Event<{ viewContainer: ViewContainer; viewContainerLocation: ViewContainerLocation }>;

	/**
	 * All registered view containers
	 */
	readonly all: ViewContainer[];

	/**
	 * Registers a view container to given location.
	 * No op if a view container is already registered.
	 *
	 * @param viewContainerDescriptor descriptor of view container
	 * @param location location of the view container
	 *
	 * @returns the registered ViewContainer.
	 */
	registerViewContainer(viewContainerDescriptor: IViewContainerDescriptor, location: ViewContainerLocation, options?: { isDefault?: boolean; donotRegisterOpenCommand?: boolean }): ViewContainer;

	/**
	 * Deregisters the given view container
	 * No op if the view container is not registered
	 */
	deregisterViewContainer(viewContainer: ViewContainer): void;

	/**
	 * Returns the view container with given id.
	 *
	 * @returns the view container with given id.
	 */
	get(id: string): ViewContainer | undefined;

	/**
	 * Returns all view containers in the given location
	 */
	getViewContainers(location: ViewContainerLocation): ViewContainer[];

	/**
	 * Returns the view container location
	 */
	getViewContainerLocation(container: ViewContainer): ViewContainerLocation;

	/**
	 * Return the default view container from the given location
	 */
	getDefaultViewContainer(location: ViewContainerLocation): ViewContainer | undefined;
}

export interface IView {

	readonly id: string;

	focus(): void;

	isVisible(): boolean;

	isBodyVisible(): boolean;

	setExpanded(expanded: boolean): boolean;

	//getProgressIndicator(): IProgressIndicator | undefined;
}

export const IViewsService = createDecorator<IViewsService>('viewsService');
export interface IViewsService {

	readonly _serviceBrand: undefined;

	// View Container APIs
	//readonly onDidChangeViewContainerVisibility: Event<{ id: string; visible: boolean; location: ViewContainerLocation }>;
	isViewContainerVisible(id: string): boolean;
	openViewContainer(id: string, focus?: boolean): Promise<IPaneComposite | null>;
	closeViewContainer(id: string): void;
	//getVisibleViewContainer(location: ViewContainerLocation): ViewContainer | null;
	//getActiveViewPaneContainerWithId(viewContainerId: string): IViewPaneContainer | null;

	// View APIs
	//readonly onDidChangeViewVisibility: Event<{ id: string; visible: boolean }>;
	isViewVisible(id: string): boolean;
	openView<T extends IView>(id: string, focus?: boolean): Promise<T | null>;
	closeView(id: string): void;
	//getActiveViewWithId<T extends IView>(id: string): T | null;
	//getViewWithId<T extends IView>(id: string): T | null;
	//getViewProgressIndicator(id: string): IProgressIndicator | undefined;
}

export interface IViewPaneContainer {
	getView(viewId: string): IView | undefined;
}

interface RelaxedViewContainer extends ViewContainer {

	openCommandActionDescriptor?: OpenCommandActionDescriptor;
}

class ViewContainersRegistryImpl extends Disposable implements IViewContainersRegistry {

	private readonly _onDidRegister = this._register(new Emitter<{ viewContainer: ViewContainer; viewContainerLocation: ViewContainerLocation }>());
	readonly onDidRegister: Event<{ viewContainer: ViewContainer; viewContainerLocation: ViewContainerLocation }> = this._onDidRegister.event;

	private readonly _onDidDeregister = this._register(new Emitter<{ viewContainer: ViewContainer; viewContainerLocation: ViewContainerLocation }>());
	readonly onDidDeregister: Event<{ viewContainer: ViewContainer; viewContainerLocation: ViewContainerLocation }> = this._onDidDeregister.event;

	private readonly viewContainers: Map<ViewContainerLocation, ViewContainer[]> = new Map<ViewContainerLocation, ViewContainer[]>();
	private readonly defaultViewContainers: ViewContainer[] = [];

	get all(): ViewContainer[] {
		return flatten([...this.viewContainers.values()]);
	}

	registerViewContainer(viewContainerDescriptor: IViewContainerDescriptor, viewContainerLocation: ViewContainerLocation, options?: { isDefault?: boolean | undefined; donotRegisterOpenCommand?: boolean | undefined }): ViewContainer {
		const existing = this.get(viewContainerDescriptor.id);
		if (existing) {
			return existing;
		}

		const viewContainer: RelaxedViewContainer = viewContainerDescriptor;
		viewContainer.openCommandActionDescriptor = options?.donotRegisterOpenCommand ? undefined : (viewContainer.openCommandActionDescriptor ?? { id: viewContainer.id });
		const viewContainers = getOrSet(this.viewContainers, viewContainerLocation, []);
		viewContainers.push(viewContainer);
		if (options?.isDefault) {
			this.defaultViewContainers.push(viewContainer);
		}
		this._onDidRegister.fire({ viewContainer, viewContainerLocation });
		return viewContainer;
	}

	deregisterViewContainer(viewContainer: ViewContainer): void {
		for (const viewContainerLocation of this.viewContainers.keys()) {
			const viewContainers = this.viewContainers.get(viewContainerLocation)!;
			const index = viewContainers?.indexOf(viewContainer);
			if (index !== -1) {
				viewContainers?.splice(index, 1);
				if (viewContainers.length === 0) {
					this.viewContainers.delete(viewContainerLocation);
				}
				this._onDidDeregister.fire({ viewContainer, viewContainerLocation });
				return;
			}
		}
	}

	get(id: string): ViewContainer | undefined {
		return this.all.filter(viewContainer => viewContainer.id === id)[0];
	}

	getViewContainers(location: ViewContainerLocation): ViewContainer[] {
		return [...(this.viewContainers.get(location) || [])];
	}

	getViewContainerLocation(container: ViewContainer): ViewContainerLocation {
		return [...this.viewContainers.keys()].filter(location => this.getViewContainers(location).filter(viewContainer => viewContainer?.id === container.id).length > 0)[0];
	}

	getDefaultViewContainer(location: ViewContainerLocation): ViewContainer | undefined {
		return this.defaultViewContainers.find(viewContainer => this.getViewContainerLocation(viewContainer) === location);
	}

}

export interface IViewContentDescriptor {
	readonly content: string;
	//readonly when?: ContextKeyExpression | 'default';
	readonly group?: string;
	readonly order?: number;
	//readonly precondition?: ContextKeyExpression | undefined;
}

export interface IViewDescriptor {

	readonly type?: string;

	readonly id: string;

	readonly name: string;

	readonly ctorDescriptor: SyncDescriptor<IView>;

	readonly when?: any;

	readonly order?: number;

	readonly weight?: number;

	readonly collapsed?: boolean;

	readonly canToggleVisibility?: boolean;

	readonly canMoveView?: boolean;

	readonly containerIcon?: ThemeIcon | URI;

	readonly containerTitle?: string;

	// Applies only to newly created views
	readonly hideByDefault?: boolean;

	readonly workspace?: boolean;

	//readonly focusCommand?: { id: string; keybindings?: IKeybindings };

	// For contributed remote explorer views
	readonly group?: string;

	readonly remoteAuthority?: string | string[];

	readonly openCommandActionDescriptor?: OpenCommandActionDescriptor;
}


export interface IViewsRegistry {

	readonly onViewsRegistered: Event<{ views: IViewDescriptor[]; viewContainer: ViewContainer }[]>;

	readonly onViewsDeregistered: Event<{ views: IViewDescriptor[]; viewContainer: ViewContainer }>;

	getViews(viewContainer: ViewContainer): IViewDescriptor[];

	getView(id: string): IViewDescriptor | null;

	registerViews(views: IViewDescriptor[], viewContainer: ViewContainer): void;

	deregisterViews(views: IViewDescriptor[], viewContainer: ViewContainer): void;

	getViewContainer(id: string): ViewContainer | null;

	readonly onDidChangeViewWelcomeContent: Event<string>;
	registerViewWelcomeContent(id: string, viewContent: IViewContentDescriptor): IDisposable;
	registerViewWelcomeContent2<TKey>(id: string, viewContentMap: Map<TKey, IViewContentDescriptor>): Map<TKey, IDisposable>;
	getViewWelcomeContent(id: string): IViewContentDescriptor[];
}

export interface IViewDescriptorRef {
	viewDescriptor: IViewDescriptor;
	index: number;
}

export interface IAddedViewDescriptorRef extends IViewDescriptorRef {
	collapsed: boolean;
	size?: number;
}

export interface IAddedViewDescriptorState {
	viewDescriptor: IViewDescriptor;
	collapsed?: boolean;
	visible?: boolean;
}

export interface IViewContainerModel {

	readonly viewContainer: ViewContainer;

	readonly title: string;
	readonly icon: ThemeIcon | URI | undefined;
	readonly keybindingId: string | undefined;
	readonly onDidChangeContainerInfo: Event<{ title?: boolean; icon?: boolean; keybindingId?: boolean }>;

	readonly allViewDescriptors: ReadonlyArray<IViewDescriptor>;
	readonly onDidChangeAllViewDescriptors: Event<{ added: ReadonlyArray<IViewDescriptor>; removed: ReadonlyArray<IViewDescriptor> }>;

	readonly activeViewDescriptors: ReadonlyArray<IViewDescriptor>;
	readonly onDidChangeActiveViewDescriptors: Event<{ added: ReadonlyArray<IViewDescriptor>; removed: ReadonlyArray<IViewDescriptor> }>;

	readonly visibleViewDescriptors: ReadonlyArray<IViewDescriptor>;
	readonly onDidAddVisibleViewDescriptors: Event<IAddedViewDescriptorRef[]>;
	readonly onDidRemoveVisibleViewDescriptors: Event<IViewDescriptorRef[]>;
	readonly onDidMoveVisibleViewDescriptors: Event<{ from: IViewDescriptorRef; to: IViewDescriptorRef }>;

	isVisible(id: string): boolean;
	setVisible(id: string, visible: boolean): void;

	isCollapsed(id: string): boolean;
	setCollapsed(id: string, collapsed: boolean): void;

	getSize(id: string): number | undefined;
	setSizes(newSizes: readonly { id: string; size: number }[]): void;

	move(from: string, to: string): void;
}

export enum ViewContentGroups {
	Open = '2_open',
	Debug = '4_debug',
	SCM = '5_scm',
	More = '9_more'
}

function compareViewContentDescriptors(a: IViewContentDescriptor, b: IViewContentDescriptor): number {
	const aGroup = a.group ?? ViewContentGroups.More;
	const bGroup = b.group ?? ViewContentGroups.More;
	if (aGroup !== bGroup) {
		return aGroup.localeCompare(bGroup);
	}
	return (a.order ?? 5) - (b.order ?? 5);
}

class ViewsRegistry extends Disposable implements IViewsRegistry {

	private readonly _onViewsRegistered = this._register(new Emitter<{ views: IViewDescriptor[]; viewContainer: ViewContainer }[]>());
	readonly onViewsRegistered = this._onViewsRegistered.event;

	private readonly _onViewsDeregistered: Emitter<{ views: IViewDescriptor[]; viewContainer: ViewContainer }> = this._register(new Emitter<{ views: IViewDescriptor[]; viewContainer: ViewContainer }>());
	readonly onViewsDeregistered: Event<{ views: IViewDescriptor[]; viewContainer: ViewContainer }> = this._onViewsDeregistered.event;

	private readonly _onDidChangeContainer: Emitter<{ views: IViewDescriptor[]; from: ViewContainer; to: ViewContainer }> = this._register(new Emitter<{ views: IViewDescriptor[]; from: ViewContainer; to: ViewContainer }>());
	readonly onDidChangeContainer: Event<{ views: IViewDescriptor[]; from: ViewContainer; to: ViewContainer }> = this._onDidChangeContainer.event;

	private readonly _onDidChangeViewWelcomeContent: Emitter<string> = this._register(new Emitter<string>());
	readonly onDidChangeViewWelcomeContent: Event<string> = this._onDidChangeViewWelcomeContent.event;


	private _viewContainers: ViewContainer[] = [];
	private _views: Map<ViewContainer, IViewDescriptor[]> = new Map<ViewContainer, IViewDescriptor[]>();
	private _viewWelcomeContents = new SetMap<string, IViewContentDescriptor>();

	registerViews(views: IViewDescriptor[], viewContainer: ViewContainer): void {
		this.registerViews2([{ views, viewContainer }]);
	}

	registerViews2(views: { views: IViewDescriptor[]; viewContainer: ViewContainer }[]): void {
		views.forEach(({ views, viewContainer }) => this.addViews(views, viewContainer));
		this._onViewsRegistered.fire(views);
	}

	deregisterViews(viewDescriptors: IViewDescriptor[], viewContainer: ViewContainer): void {
		const views = this.removeViews(viewDescriptors, viewContainer);
		if (views.length) {
			this._onViewsDeregistered.fire({ views, viewContainer });
		}
	}

	moveViews(viewsToMove: IViewDescriptor[], viewContainer: ViewContainer): void {
		for (const container of this._views.keys()) {
			if (container !== viewContainer) {
				const views = this.removeViews(viewsToMove, container);
				if (views.length) {
					this.addViews(views, viewContainer);
					this._onDidChangeContainer.fire({ views, from: container, to: viewContainer });
				}
			}
		}
	}

	getViews(loc: ViewContainer): IViewDescriptor[] {
		return this._views.get(loc) || [];
	}

	getView(id: string): IViewDescriptor | null {
		for (const viewContainer of this._viewContainers) {
			const viewDescriptor = (this._views.get(viewContainer) || []).filter(v => v.id === id)[0];
			if (viewDescriptor) {
				return viewDescriptor;
			}
		}
		return null;
	}

	getViewContainer(viewId: string): ViewContainer | null {
		for (const viewContainer of this._viewContainers) {
			const viewDescriptor = (this._views.get(viewContainer) || []).filter(v => v.id === viewId)[0];
			if (viewDescriptor) {
				return viewContainer;
			}
		}
		return null;
	}

	registerViewWelcomeContent(id: string, viewContent: IViewContentDescriptor): IDisposable {
		this._viewWelcomeContents.add(id, viewContent);
		this._onDidChangeViewWelcomeContent.fire(id);

		return toDisposable(() => {
			this._viewWelcomeContents.delete(id, viewContent);
			this._onDidChangeViewWelcomeContent.fire(id);
		});
	}

	registerViewWelcomeContent2<TKey>(id: string, viewContentMap: Map<TKey, IViewContentDescriptor>): Map<TKey, IDisposable> {
		const disposables = new Map<TKey, IDisposable>();

		for (const [key, content] of viewContentMap) {
			this._viewWelcomeContents.add(id, content);

			disposables.set(key, toDisposable(() => {
				this._viewWelcomeContents.delete(id, content);
				this._onDidChangeViewWelcomeContent.fire(id);
			}));
		}
		this._onDidChangeViewWelcomeContent.fire(id);

		return disposables;
	}

	getViewWelcomeContent(id: string): IViewContentDescriptor[] {
		const result: IViewContentDescriptor[] = [];
		this._viewWelcomeContents.forEach(id, descriptor => result.push(descriptor));
		return result.sort(compareViewContentDescriptors);
	}

	private addViews(viewDescriptors: IViewDescriptor[], viewContainer: ViewContainer): void {
		let views = this._views.get(viewContainer);
		if (!views) {
			views = [];
			this._views.set(viewContainer, views);
			this._viewContainers.push(viewContainer);
		}
		for (const viewDescriptor of viewDescriptors) {
			if (this.getView(viewDescriptor.id) !== null) {
				//throw new Error(localize('duplicateId', "A view with id '{0}' is already registered", viewDescriptor.id));
			}
			views.push(viewDescriptor);
		}
	}

	private removeViews(viewDescriptors: IViewDescriptor[], viewContainer: ViewContainer): IViewDescriptor[] {
		const views = this._views.get(viewContainer);
		if (!views) {
			return [];
		}
		const viewsToDeregister: IViewDescriptor[] = [];
		const remaningViews: IViewDescriptor[] = [];
		for (const view of views) {
			if (!viewDescriptors.includes(view)) {
				remaningViews.push(view);
			} else {
				viewsToDeregister.push(view);
			}
		}
		if (viewsToDeregister.length) {
			if (remaningViews.length) {
				this._views.set(viewContainer, remaningViews);
			} else {
				this._views.delete(viewContainer);
				this._viewContainers.splice(this._viewContainers.indexOf(viewContainer), 1);
			}
		}
		return viewsToDeregister;
	}
}


Registry.add(Extensions.ViewsRegistry, new ViewsRegistry());

export const IViewDescriptorService = createDecorator<IViewDescriptorService>('viewDescriptorService');

export interface IViewDescriptorService {
	readonly _serviceBrand: undefined;

	// ViewContainers
	readonly viewContainers: ReadonlyArray<ViewContainer>;
	readonly onDidChangeViewContainers: Event<{ added: ReadonlyArray<{ container: ViewContainer; location: ViewContainerLocation }>; removed: ReadonlyArray<{ container: ViewContainer; location: ViewContainerLocation }> }>;


	getDefaultViewContainer(location: ViewContainerLocation): ViewContainer | undefined;
	getViewContainerById(id: string): ViewContainer | null;
	isViewContainerRemovedPermanently(id: string): boolean;
	getViewContainerLocation(viewContainer: ViewContainer): ViewContainerLocation | null;
	getViewContainersByLocation(location: ViewContainerLocation): ViewContainer[];
	getViewContainerModel(viewContainer: ViewContainer): IViewContainerModel;
}

Registry.add(Extensions.ViewContainersRegistry, new ViewContainersRegistryImpl());
