import { IAddedViewDescriptorRef, IAddedViewDescriptorState, IViewContainerModel, IViewDescriptor, IViewDescriptorRef, ViewContainer } from "mote/workbench/common/views";
import { IStringDictionary } from 'vs/base/common/collections';
import { Emitter, Event } from "vs/base/common/event";
import { Disposable } from "vs/base/common/lifecycle";
import { isUndefined } from 'vs/base/common/types';
import { IInstantiationService } from "vs/platform/instantiation/common/instantiation";
import { Registry } from 'vs/platform/registry/common/platform';
import { IStorageService, IStorageValueChangeEvent, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';

interface IViewDescriptorState {
	visibleGlobal: boolean | undefined;
	visibleWorkspace: boolean | undefined;
	collapsed: boolean | undefined;
	active: boolean;
	order?: number;
	size?: number;
}

interface IStoredWorkspaceViewState {
	collapsed: boolean;
	isHidden: boolean;
	size?: number;
	order?: number;
}

interface IStoredGlobalViewState {
	id: string;
	isHidden: boolean;
	order?: number;
}

export function getViewsStateStorageId(viewContainerStorageId: string): string { return `${viewContainerStorageId}.hidden`; }

class ViewDescriptorsState extends Disposable {

	private readonly workspaceViewsStateStorageId: string;
	private readonly globalViewsStateStorageId: string;
	private readonly state: Map<string, IViewDescriptorState>;

	private _onDidChangeStoredState = this._register(new Emitter<{ id: string; visible: boolean }[]>());
	readonly onDidChangeStoredState = this._onDidChangeStoredState.event;

	constructor(
		viewContainerStorageId: string,
		viewContainerName: string,
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();

		this.globalViewsStateStorageId = getViewsStateStorageId(viewContainerStorageId);
		this.workspaceViewsStateStorageId = viewContainerStorageId;
		this._register(this.storageService.onDidChangeValue(e => this.onDidStorageChange(e)));

		this.state = this.initialize();

		/*
		Registry.as<IProfileStorageRegistry>(Extensions.ProfileStorageRegistry)
			.registerKeys([{
				key: this.globalViewsStateStorageId,
				description: localize('globalViewsStateStorageId', "Views visibility customizations in {0} view container", viewContainerName),
			}]);
			*/
	}

	set(id: string, state: IViewDescriptorState): void {
		this.state.set(id, state);
	}

	get(id: string): IViewDescriptorState | undefined {
		return this.state.get(id);
	}

	updateState(viewDescriptors: ReadonlyArray<IViewDescriptor>): void {
		this.updateWorkspaceState(viewDescriptors);
		this.updateGlobalState(viewDescriptors);
	}

	private updateWorkspaceState(viewDescriptors: ReadonlyArray<IViewDescriptor>): void {
		const storedViewsStates = this.getStoredWorkspaceState();
		for (const viewDescriptor of viewDescriptors) {
			const viewState = this.get(viewDescriptor.id);
			if (viewState) {
				storedViewsStates[viewDescriptor.id] = {
					collapsed: !!viewState.collapsed,
					isHidden: !viewState.visibleWorkspace,
					size: viewState.size,
					order: viewDescriptor.workspace && viewState ? viewState.order : undefined
				};
			}
		}

		if (Object.keys(storedViewsStates).length > 0) {
			this.storageService.store(this.workspaceViewsStateStorageId, JSON.stringify(storedViewsStates), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		} else {
			this.storageService.remove(this.workspaceViewsStateStorageId, StorageScope.WORKSPACE);
		}
	}

	private updateGlobalState(viewDescriptors: ReadonlyArray<IViewDescriptor>): void {
		const storedGlobalState = this.getStoredGlobalState();
		for (const viewDescriptor of viewDescriptors) {
			const state = this.get(viewDescriptor.id);
			storedGlobalState.set(viewDescriptor.id, {
				id: viewDescriptor.id,
				isHidden: state && viewDescriptor.canToggleVisibility ? !state.visibleGlobal : false,
				order: !viewDescriptor.workspace && state ? state.order : undefined
			});
		}
		this.setStoredGlobalState(storedGlobalState);
	}

	private onDidStorageChange(e: IStorageValueChangeEvent): void {
		if (e.key === this.globalViewsStateStorageId && e.scope === StorageScope.PROFILE
			&& this.globalViewsStatesValue !== this.getStoredGlobalViewsStatesValue() /* This checks if current window changed the value or not */) {
			this._globalViewsStatesValue = undefined;
			const storedViewsVisibilityStates = this.getStoredGlobalState();
			const storedWorkspaceViewsStates = this.getStoredWorkspaceState();
			const changedStates: { id: string; visible: boolean }[] = [];
			for (const [id, storedState] of storedViewsVisibilityStates) {
				const state = this.get(id);
				if (state) {
					if (state.visibleGlobal !== !storedState.isHidden) {
						changedStates.push({ id, visible: !storedState.isHidden });
					}
				} else {
					const workspaceViewState = <IStoredWorkspaceViewState | undefined>storedWorkspaceViewsStates[id];
					this.set(id, {
						active: false,
						visibleGlobal: !storedState.isHidden,
						visibleWorkspace: isUndefined(workspaceViewState?.isHidden) ? undefined : !workspaceViewState?.isHidden,
						collapsed: workspaceViewState?.collapsed,
						order: workspaceViewState?.order,
						size: workspaceViewState?.size,
					});
				}
			}
			if (changedStates.length) {
				this._onDidChangeStoredState.fire(changedStates);
			}
		}
	}

	private initialize(): Map<string, IViewDescriptorState> {
		const viewStates = new Map<string, IViewDescriptorState>();
		const workspaceViewsStates = this.getStoredWorkspaceState();
		for (const id of Object.keys(workspaceViewsStates)) {
			const workspaceViewState = workspaceViewsStates[id];
			viewStates.set(id, {
				active: false,
				visibleGlobal: undefined,
				visibleWorkspace: isUndefined(workspaceViewState.isHidden) ? undefined : !workspaceViewState.isHidden,
				collapsed: workspaceViewState.collapsed,
				order: workspaceViewState.order,
				size: workspaceViewState.size,
			});
		}

		// Migrate to `viewletStateStorageId`
		const value = this.storageService.get(this.globalViewsStateStorageId, StorageScope.WORKSPACE, '[]');
		const { state: workspaceVisibilityStates } = this.parseStoredGlobalState(value);
		if (workspaceVisibilityStates.size > 0) {
			for (const { id, isHidden } of workspaceVisibilityStates.values()) {
				const viewState = viewStates.get(id);
				// Not migrated to `viewletStateStorageId`
				if (viewState) {
					if (isUndefined(viewState.visibleWorkspace)) {
						viewState.visibleWorkspace = !isHidden;
					}
				} else {
					viewStates.set(id, {
						active: false,
						collapsed: undefined,
						visibleGlobal: undefined,
						visibleWorkspace: !isHidden,
					});
				}
			}
			this.storageService.remove(this.globalViewsStateStorageId, StorageScope.WORKSPACE);
		}

		const { state, hasDuplicates } = this.parseStoredGlobalState(this.globalViewsStatesValue);
		if (hasDuplicates) {
			this.setStoredGlobalState(state);
		}
		for (const { id, isHidden, order } of state.values()) {
			const viewState = viewStates.get(id);
			if (viewState) {
				viewState.visibleGlobal = !isHidden;
				if (!isUndefined(order)) {
					viewState.order = order;
				}
			} else {
				viewStates.set(id, {
					active: false,
					visibleGlobal: !isHidden,
					order,
					collapsed: undefined,
					visibleWorkspace: undefined,
				});
			}
		}
		return viewStates;
	}

	private getStoredWorkspaceState(): IStringDictionary<IStoredWorkspaceViewState> {
		return JSON.parse(this.storageService.get(this.workspaceViewsStateStorageId, StorageScope.WORKSPACE, '{}'));
	}

	private getStoredGlobalState(): Map<string, IStoredGlobalViewState> {
		return this.parseStoredGlobalState(this.globalViewsStatesValue).state;
	}

	private setStoredGlobalState(storedGlobalState: Map<string, IStoredGlobalViewState>): void {
		this.globalViewsStatesValue = JSON.stringify([...storedGlobalState.values()]);
	}

	private parseStoredGlobalState(value: string): { state: Map<string, IStoredGlobalViewState>; hasDuplicates: boolean } {
		const storedValue = <Array<string | IStoredGlobalViewState>>JSON.parse(value);
		let hasDuplicates = false;
		const state = storedValue.reduce((result, storedState) => {
			if (typeof storedState === 'string' /* migration */) {
				hasDuplicates = hasDuplicates || result.has(storedState);
				result.set(storedState, { id: storedState, isHidden: true });
			} else {
				hasDuplicates = hasDuplicates || result.has(storedState.id);
				result.set(storedState.id, storedState);
			}
			return result;
		}, new Map<string, IStoredGlobalViewState>());
		return { state, hasDuplicates };
	}

	private _globalViewsStatesValue: string | undefined;
	private get globalViewsStatesValue(): string {
		if (!this._globalViewsStatesValue) {
			this._globalViewsStatesValue = this.getStoredGlobalViewsStatesValue();
		}

		return this._globalViewsStatesValue;
	}

	private set globalViewsStatesValue(globalViewsStatesValue: string) {
		if (this.globalViewsStatesValue !== globalViewsStatesValue) {
			this._globalViewsStatesValue = globalViewsStatesValue;
			this.setStoredGlobalViewsStatesValue(globalViewsStatesValue);
		}
	}

	private getStoredGlobalViewsStatesValue(): string {
		return this.storageService.get(this.globalViewsStateStorageId, StorageScope.PROFILE, '[]');
	}

	private setStoredGlobalViewsStatesValue(value: string): void {
		this.storageService.store(this.globalViewsStateStorageId, value, StorageScope.PROFILE, StorageTarget.USER);
	}

}

interface IViewDescriptorItem {
	viewDescriptor: IViewDescriptor;
	state: IViewDescriptorState;
}

export class ViewContainerModel extends Disposable implements IViewContainerModel {

	private viewDescriptorItems: IViewDescriptorItem[] = [];
	private viewDescriptorsState: ViewDescriptorsState;

	// Container Info
	private _title!: string;
	get title(): string { return this._title; }

	private _keybindingId: string | undefined;
	get keybindingId(): string | undefined { return this._keybindingId; }

	private _onDidChangeContainerInfo = this._register(new Emitter<{ title?: boolean; icon?: boolean; keybindingId?: boolean }>());
	readonly onDidChangeContainerInfo = this._onDidChangeContainerInfo.event;

	// All View Descriptors
	get allViewDescriptors(): ReadonlyArray<IViewDescriptor> { return this.viewDescriptorItems.map(item => item.viewDescriptor); }
	private _onDidChangeAllViewDescriptors = this._register(new Emitter<{ added: ReadonlyArray<IViewDescriptor>; removed: ReadonlyArray<IViewDescriptor> }>());
	readonly onDidChangeAllViewDescriptors = this._onDidChangeAllViewDescriptors.event;

	// Active View Descriptors
	get activeViewDescriptors(): ReadonlyArray<IViewDescriptor> { return this.viewDescriptorItems.filter(item => item.state.active).map(item => item.viewDescriptor); }
	private _onDidChangeActiveViewDescriptors = this._register(new Emitter<{ added: ReadonlyArray<IViewDescriptor>; removed: ReadonlyArray<IViewDescriptor> }>());
	readonly onDidChangeActiveViewDescriptors = this._onDidChangeActiveViewDescriptors.event;

	// Visible View Descriptors
	get visibleViewDescriptors(): ReadonlyArray<IViewDescriptor> { return this.viewDescriptorItems.filter(item => this.isViewDescriptorVisible(item)).map(item => item.viewDescriptor); }

	private _onDidAddVisibleViewDescriptors = this._register(new Emitter<IAddedViewDescriptorRef[]>());
	readonly onDidAddVisibleViewDescriptors: Event<IAddedViewDescriptorRef[]> = this._onDidAddVisibleViewDescriptors.event;

	private _onDidRemoveVisibleViewDescriptors = this._register(new Emitter<IViewDescriptorRef[]>());
	readonly onDidRemoveVisibleViewDescriptors: Event<IViewDescriptorRef[]> = this._onDidRemoveVisibleViewDescriptors.event;

	private _onDidMoveVisibleViewDescriptors = this._register(new Emitter<{ from: IViewDescriptorRef; to: IViewDescriptorRef }>());
	readonly onDidMoveVisibleViewDescriptors: Event<{ from: IViewDescriptorRef; to: IViewDescriptorRef }> = this._onDidMoveVisibleViewDescriptors.event;


	constructor(
		readonly viewContainer: ViewContainer,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		//this.viewDescriptorsState = this._register(instantiationService.createInstance(ViewDescriptorsState, viewContainer.storageId || `${viewContainer.id}.state`, viewContainer.title));

	}
	isCollapsed(id: string): boolean {
		return !!this.find(id).viewDescriptorItem.state.collapsed;
	}
	setCollapsed(id: string, collapsed: boolean): void {
		const { viewDescriptorItem } = this.find(id);
		if (viewDescriptorItem.state.collapsed !== collapsed) {
			viewDescriptorItem.state.collapsed = collapsed;
		}
		//this.viewDescriptorsState.updateState(this.allViewDescriptors);
	}
	getSize(id: string): number | undefined {
		return this.find(id).viewDescriptorItem.state.size;
	}
	setSizes(newSizes: readonly { id: string; size: number; }[]): void {
		throw new Error("Method not implemented.");
	}
	move(from: string, to: string): void {
		throw new Error("Method not implemented.");
	}

	add(addedViewDescriptorStates: IAddedViewDescriptorState[]): void {

		const addedItems: IViewDescriptorItem[] = [];
		for (const addedViewDescriptorState of addedViewDescriptorStates) {
			const viewDescriptor = addedViewDescriptorState.viewDescriptor;

			const state: IViewDescriptorState = { visibleGlobal: true, visibleWorkspace: true, collapsed: false, active: true };
			addedItems.push({ viewDescriptor, state });
		}
		this.viewDescriptorItems.push(...addedItems);
		this.viewDescriptorItems.sort(this.compareViewDescriptors.bind(this));
		this._onDidChangeAllViewDescriptors.fire({ added: addedItems.map(({ viewDescriptor }) => viewDescriptor), removed: [] });

		const addedActiveItems: { viewDescriptorItem: IViewDescriptorItem; visible: boolean }[] = [];
		for (const viewDescriptorItem of addedItems) {
			if (viewDescriptorItem.state.active) {
				addedActiveItems.push({ viewDescriptorItem, visible: this.isViewDescriptorVisible(viewDescriptorItem) });
			}
		}
		if (addedActiveItems.length) {
			this._onDidChangeActiveViewDescriptors.fire(({ added: addedActiveItems.map(({ viewDescriptorItem }) => viewDescriptorItem.viewDescriptor), removed: [] }));
		}

		const addedVisibleDescriptors: IAddedViewDescriptorRef[] = [];
		for (const { viewDescriptorItem, visible } of addedActiveItems) {
			if (visible && this.isViewDescriptorVisible(viewDescriptorItem)) {
				const { visibleIndex } = this.find(viewDescriptorItem.viewDescriptor.id);
				addedVisibleDescriptors.push({ index: visibleIndex, viewDescriptor: viewDescriptorItem.viewDescriptor, size: viewDescriptorItem.state.size, collapsed: !!viewDescriptorItem.state.collapsed });
			}
		}
		this.broadCastAddedVisibleViewDescriptors(addedVisibleDescriptors);
	}

	remove(viewDescriptors: IViewDescriptor[]): void {
		const removed: IViewDescriptor[] = [];
		const removedItems: IViewDescriptorItem[] = [];
		const removedActiveDescriptors: IViewDescriptor[] = [];
		const removedVisibleDescriptors: IViewDescriptorRef[] = [];

		for (const viewDescriptor of viewDescriptors) {

			const index = this.viewDescriptorItems.findIndex(i => i.viewDescriptor.id === viewDescriptor.id);
			if (index !== -1) {
				removed.push(viewDescriptor);
				const viewDescriptorItem = this.viewDescriptorItems[index];
				if (viewDescriptorItem.state.active) {
					removedActiveDescriptors.push(viewDescriptorItem.viewDescriptor);
				}
				if (this.isViewDescriptorVisible(viewDescriptorItem)) {
					const { visibleIndex } = this.find(viewDescriptorItem.viewDescriptor.id);
					removedVisibleDescriptors.push({ index: visibleIndex, viewDescriptor: viewDescriptorItem.viewDescriptor });
				}
				removedItems.push(viewDescriptorItem);
			}
		}

		// update state
		removedItems.forEach(item => this.viewDescriptorItems.splice(this.viewDescriptorItems.indexOf(item), 1));

		this.broadCastRemovedVisibleViewDescriptors(removedVisibleDescriptors);
		if (removedActiveDescriptors.length) {
			this._onDidChangeActiveViewDescriptors.fire(({ added: [], removed: removedActiveDescriptors }));
		}
		if (removed.length) {
			this._onDidChangeAllViewDescriptors.fire({ added: [], removed });
		}
	}

	isVisible(id: string): boolean {
		const viewDescriptorItem = this.viewDescriptorItems.find(v => v.viewDescriptor.id === id);
		if (!viewDescriptorItem) {
			throw new Error(`Unknown view ${id}`);
		}
		return this.isViewDescriptorVisible(viewDescriptorItem);
	}

	setVisible(id: string, visible: boolean): void {
		this.updateVisibility([{ id, visible }]);
	}

	private updateVisibility(viewDescriptors: { id: string; visible: boolean }[]): void {

		// Second: Update and add the view descriptors which are asked to be shown
		const added: IAddedViewDescriptorRef[] = [];
		for (const { id, visible } of viewDescriptors) {
			if (!visible) {
				continue;
			}
			const foundViewDescriptor = this.findAndIgnoreIfNotFound(id);
			if (!foundViewDescriptor) {
				continue;
			}
			const { viewDescriptorItem, visibleIndex } = foundViewDescriptor;
			if (this.updateViewDescriptorItemVisibility(viewDescriptorItem, true)) {
				added.push({ index: visibleIndex, viewDescriptor: viewDescriptorItem.viewDescriptor, size: viewDescriptorItem.state.size, collapsed: !!viewDescriptorItem.state.collapsed });
			}
		}
		if (added.length) {
			this.broadCastAddedVisibleViewDescriptors(added);
		}
	}

	private updateViewDescriptorItemVisibility(viewDescriptorItem: IViewDescriptorItem, visible: boolean): boolean {
		if (!viewDescriptorItem.viewDescriptor.canToggleVisibility) {
			return false;
		}
		if (this.isViewDescriptorVisibleWhenActive(viewDescriptorItem) === visible) {
			return false;
		}

		// update visibility
		if (viewDescriptorItem.viewDescriptor.workspace) {
			viewDescriptorItem.state.visibleWorkspace = visible;
		} else {
			viewDescriptorItem.state.visibleGlobal = visible;
		}

		// return `true` only if visibility is changed
		return this.isViewDescriptorVisible(viewDescriptorItem) === visible;
	}

	private isViewDescriptorVisible(item: IViewDescriptorItem): boolean {
		return this.isViewDescriptorVisibleWhenActive(item);
	}

	private isViewDescriptorVisibleWhenActive(viewDescriptorItem: IViewDescriptorItem): boolean {
		if (viewDescriptorItem.viewDescriptor.workspace) {
			return !!viewDescriptorItem.state.visibleWorkspace;
		}
		return !!viewDescriptorItem.state.visibleGlobal;
	}

	private broadCastAddedVisibleViewDescriptors(added: IAddedViewDescriptorRef[]): void {
		if (added.length) {
			this._onDidAddVisibleViewDescriptors.fire(added.sort((a, b) => a.index - b.index));
		}
	}

	private broadCastRemovedVisibleViewDescriptors(removed: IViewDescriptorRef[]): void {
		if (removed.length) {
			this._onDidRemoveVisibleViewDescriptors.fire(removed.sort((a, b) => b.index - a.index));
		}
	}

	private find(id: string): { index: number; visibleIndex: number; viewDescriptorItem: IViewDescriptorItem } {
		const result = this.findAndIgnoreIfNotFound(id);
		if (result) {
			return result;
		}
		throw new Error(`view descriptor ${id} not found`);
	}

	private findAndIgnoreIfNotFound(id: string): { index: number; visibleIndex: number; viewDescriptorItem: IViewDescriptorItem } | undefined {
		for (let i = 0, visibleIndex = 0; i < this.viewDescriptorItems.length; i++) {
			const viewDescriptorItem = this.viewDescriptorItems[i];
			if (viewDescriptorItem.viewDescriptor.id === id) {
				return { index: i, visibleIndex, viewDescriptorItem: viewDescriptorItem };
			}
			if (this.isViewDescriptorVisible(viewDescriptorItem)) {
				visibleIndex++;
			}
		}
		return undefined;
	}

	private compareViewDescriptors(a: IViewDescriptorItem, b: IViewDescriptorItem): number {
		if (a.viewDescriptor.id === b.viewDescriptor.id) {
			return 0;
		}

		return (this.getViewOrder(a) - this.getViewOrder(b)) || this.getGroupOrderResult(a.viewDescriptor, b.viewDescriptor);
	}

	private getViewOrder(viewDescriptorItem: IViewDescriptorItem): number {
		const viewOrder = typeof viewDescriptorItem.state.order === 'number' ? viewDescriptorItem.state.order : viewDescriptorItem.viewDescriptor.order;
		return typeof viewOrder === 'number' ? viewOrder : Number.MAX_VALUE;
	}

	private getGroupOrderResult(a: IViewDescriptor, b: IViewDescriptor) {
		if (!a.group || !b.group) {
			return 0;
		}

		if (a.group === b.group) {
			return 0;
		}

		return a.group < b.group ? -1 : 1;
	}
}
