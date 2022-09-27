/* eslint-disable code-no-unexternalized-strings */
import { ThemeIcon } from 'mote/platform/theme/common/themeService';
import { defaultViewIcon, IAddedViewDescriptorRef, IAddedViewDescriptorState, IViewContainerModel, IViewDescriptor, IViewDescriptorRef, ViewContainer } from "mote/workbench/common/views";
import { Emitter, Event } from "vs/base/common/event";
import { Disposable } from "vs/base/common/lifecycle";
import { isEqual } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { IInstantiationService } from "vs/platform/instantiation/common/instantiation";

interface IViewDescriptorState {
	visibleGlobal: boolean | undefined;
	visibleWorkspace: boolean | undefined;
	collapsed: boolean | undefined;
	active: boolean;
	order?: number;
	size?: number;
}


export function getViewsStateStorageId(viewContainerStorageId: string): string { return `${viewContainerStorageId}.hidden`; }


interface IViewDescriptorItem {
	viewDescriptor: IViewDescriptor;
	state: IViewDescriptorState;
}

export class ViewContainerModel extends Disposable implements IViewContainerModel {

	private viewDescriptorItems: IViewDescriptorItem[] = [];
	//private viewDescriptorsState: ViewDescriptorsState;

	// Container Info
	private _title!: string;
	get title(): string { return this._title; }

	private _icon: URI | ThemeIcon | undefined;
	get icon(): URI | ThemeIcon | undefined { return this._icon; }

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
		this.updateContainerInfo();
	}

	private updateContainerInfo(): void {
		/* Use default container info if one of the visible view descriptors belongs to the current container by default */
		const useDefaultContainerInfo = this.viewContainer.alwaysUseContainerInfo || this.visibleViewDescriptors.length === 0 || this.visibleViewDescriptors.some(v => Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).getViewContainer(v.id) === this.viewContainer);
		const title = useDefaultContainerInfo ? this.viewContainer.title : this.visibleViewDescriptors[0]?.containerTitle || this.visibleViewDescriptors[0]?.name || '';

		let titleChanged: boolean = false;
		if (this._title !== title) {
			this._title = title;
			titleChanged = true;
		}

		const icon = useDefaultContainerInfo ? this.viewContainer.icon : this.visibleViewDescriptors[0]?.containerIcon || defaultViewIcon;
		let iconChanged: boolean = false;
		if (!this.isEqualIcon(icon)) {
			this._icon = icon;
			iconChanged = true;
		}
	}

	private isEqualIcon(icon: URI | ThemeIcon | undefined): boolean {
		if (URI.isUri(icon)) {
			return URI.isUri(this._icon) && isEqual(icon, this._icon);
		} else if (ThemeIcon.isThemeIcon(icon)) {
			return ThemeIcon.isThemeIcon(this._icon) && ThemeIcon.isEqual(icon, this._icon);
		}
		return icon === this._icon;
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
