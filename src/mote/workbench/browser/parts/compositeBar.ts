import { ActivityAction, CompositeActionViewItem, CompositeOverflowActivityAction, CompositeOverflowActivityActionViewItem, IActivityHoverOptions, ICompositeActivity, ICompositeBar, ICompositeBarColors } from 'mote/workbench/browser/parts/compositeBarAction';
import { Widget } from 'vs/base/browser/ui/widget';
import { IAction } from 'vs/base/common/actions';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { Dimension, $, addDisposableListener, EventType, EventHelper, isAncestor } from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { localize } from 'vs/nls';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { IColorTheme } from 'mote/platform/theme/common/themeService';
import { IComposite } from 'mote/workbench/common/composite';
import { ILogService } from 'vs/platform/log/common/log';
import { Emitter } from 'vs/base/common/event';

export interface ICompositeBarItem {
	id: string;
	name?: string;
	pinned: boolean;
	order?: number;
	visible: boolean;
}

export interface ICompositeBarOptions {

	readonly icon: boolean;
	readonly orientation: ActionsOrientation;
	readonly colors: (theme: IColorTheme) => ICompositeBarColors;
	readonly compositeSize: number;
	readonly overflowActionSize: number;
	//readonly dndHandler: ICompositeDragAndDrop;
	readonly activityHoverOptions: IActivityHoverOptions;
	readonly preventLoopNavigation?: boolean;

	getActivityAction: (compositeId: string) => ActivityAction;
	getCompositePinnedAction: (compositeId: string) => IAction;
	getDefaultCompositeId: () => string | undefined;
	openComposite: (compositeId: string, preserveFocus?: boolean) => Promise<IComposite | null>;
}

export class CompositeBar extends Widget implements ICompositeBar {

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	private dimension: Dimension | undefined;

	private compositeSwitcherBar: ActionBar | undefined;
	private compositeOverflowAction: CompositeOverflowActivityAction | undefined;
	private compositeOverflowActionViewItem: CompositeOverflowActivityActionViewItem | undefined;

	private model: CompositeBarModel;
	private visibleComposites: string[];
	private compositeSizeInBar: Map<string, number>;

	constructor(
		items: ICompositeBarItem[],
		private readonly options: ICompositeBarOptions,
		@ILogService private readonly logService: ILogService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		this.model = new CompositeBarModel(items, options);
		this.visibleComposites = [];
		this.compositeSizeInBar = new Map<string, number>();
	}

	getCompositeBarItems(): ICompositeBarItem[] {
		return [...this.model.items];
	}

	setCompositeBarItems(items: ICompositeBarItem[]): void {
		if (this.model.setItems(items)) {
			this.updateCompositeSwitcher();
		}
	}

	getPinnedComposites(): ICompositeBarItem[] {
		return this.model.pinnedItems;
	}

	getVisibleComposites(): ICompositeBarItem[] {
		return this.model.visibleItems;
	}

	create(parent: HTMLElement): HTMLElement {
		const actionBarDiv = parent.appendChild($('.composite-bar'));
		this.compositeSwitcherBar = this._register(new ActionBar(actionBarDiv, {
			actionViewItemProvider: action => {
				if (action instanceof CompositeOverflowActivityAction) {
					return this.compositeOverflowActionViewItem;
				}
				const item = this.model.findItem(action.id);
				return item && this.instantiationService.createInstance(
					CompositeActionViewItem,
					{ draggable: true, colors: this.options.colors, icon: this.options.icon, hoverOptions: this.options.activityHoverOptions },
					action as ActivityAction,
					item.pinnedAction,
					//compositeId => this.options.getContextMenuActionsForComposite(compositeId),
					//() => this.getContextMenuActions(),
					//this.options.dndHandler,
					this
				);
			},
			orientation: this.options.orientation,
			ariaLabel: localize('activityBarAriaLabel', "Active View Switcher"),
			ariaRole: 'tablist',
			animated: false,
			preventLoopNavigation: this.options.preventLoopNavigation,
			triggerKeys: { keyDown: true }
		}));

		return actionBarDiv;
	}

	focus(index?: number): void {
		this.compositeSwitcherBar?.focus(index);
	}

	recomputeSizes(): void {
		this.computeSizes(this.model.visibleItems);
	}

	layout(dimension: Dimension): void {
		this.dimension = dimension;
		if (dimension.height === 0 || dimension.width === 0) {
			// Do not layout if not visible. Otherwise the size measurment would be computed wrongly
			return;
		}

		if (this.compositeSizeInBar.size === 0) {
			// Compute size of each composite by getting the size from the css renderer
			// Size is later used for overflow computation
			this.computeSizes(this.model.visibleItems);
		}

		this.updateCompositeSwitcher();
	}

	addComposite({ id, name, order, requestedIndex }: { id: string; name: string; order?: number; requestedIndex?: number }): void {
		// Add to the model
		if (this.model.add(id, name, order, requestedIndex)) {
			this.computeSizes([this.model.findItem(id)]);
			this.updateCompositeSwitcher();
		}
	}

	removeComposite(id: string): void {

		// If it pinned, unpin it first
		if (this.isPinned(id)) {
			this.unpin(id);
		}

		// Remove from the model
		if (this.model.remove(id)) {
			this.updateCompositeSwitcher();
		}
	}

	hideComposite(id: string): void {
		if (this.model.hide(id)) {
			this.resetActiveComposite(id);
			this.updateCompositeSwitcher();
		}
	}

	activateComposite(id: string): void {
		const previousActiveItem = this.model.activeItem;
		if (this.model.activate(id)) {
			// Update if current composite is neither visible nor pinned
			// or previous active composite is not pinned
			if (this.visibleComposites.indexOf(id) === - 1 || (!!this.model.activeItem && !this.model.activeItem.pinned) || (previousActiveItem && !previousActiveItem.pinned)) {
				this.updateCompositeSwitcher();
			}
		}
	}

	deactivateComposite(id: string): void {
		const previousActiveItem = this.model.activeItem;
		if (this.model.deactivate()) {
			if (previousActiveItem && !previousActiveItem.pinned) {
				this.updateCompositeSwitcher();
			}
		}
	}

	async pin(compositeId: string, open?: boolean): Promise<void> {
		this.logService.debug(`[CompositeBar] pin composite<id=${compositeId}>`);
		this.updateCompositeSwitcher();
		if (this.model.setPinned(compositeId, true)) {
			this.updateCompositeSwitcher();

			if (open) {
				await this.options.openComposite(compositeId);
				this.activateComposite(compositeId); // Activate after opening
			}
		}
	}

	unpin(compositeId: string): void {
		if (this.model.setPinned(compositeId, false)) {

			this.updateCompositeSwitcher();

			this.resetActiveComposite(compositeId);
		}
	}

	private resetActiveComposite(compositeId: string) {
		const defaultCompositeId = this.options.getDefaultCompositeId();

		// Case: composite is not the active one or the active one is a different one
		// Solv: we do nothing
		if (!this.model.activeItem || this.model.activeItem.id !== compositeId) {
			return;
		}

		// Deactivate itself
		this.deactivateComposite(compositeId);

		// Case: composite is not the default composite and default composite is still showing
		// Solv: we open the default composite
		if (defaultCompositeId && defaultCompositeId !== compositeId && this.isPinned(defaultCompositeId)) {
			this.options.openComposite(defaultCompositeId, true);
		}

		// Case: we closed the default composite
		// Solv: we open the next visible composite from top
		else {
			this.options.openComposite(this.visibleComposites.filter(cid => cid !== compositeId)[0]);
		}
	}

	isPinned(compositeId: string): boolean {
		const item = this.model.findItem(compositeId);
		return item?.pinned;
	}

	move(compositeId: string, tocompositeId: string): void {
		throw new Error('Method not implemented.');
	}

	private computeSizes(items: ICompositeBarModelItem[]): void {
		const size = this.options.compositeSize;
		if (size) {
			items.forEach(composite => this.compositeSizeInBar.set(composite.id, size));
		} else {
			const compositeSwitcherBar = this.compositeSwitcherBar;
			if (compositeSwitcherBar && this.dimension && this.dimension.height !== 0 && this.dimension.width !== 0) {
				// Compute sizes only if visible. Otherwise the size measurment would be computed wrongly.
				const currentItemsLength = compositeSwitcherBar.viewItems.length;
				compositeSwitcherBar.push(items.map(composite => composite.activityAction));
				items.map((composite, index) => this.compositeSizeInBar.set(composite.id, this.options.orientation === ActionsOrientation.VERTICAL
					? compositeSwitcherBar.getHeight(currentItemsLength + index)
					: compositeSwitcherBar.getWidth(currentItemsLength + index)
				));
				items.forEach(() => compositeSwitcherBar.pull(compositeSwitcherBar.viewItems.length - 1));
			}
		}
	}

	private updateCompositeSwitcher(): void {
		const compositeSwitcherBar = this.compositeSwitcherBar;
		if (!compositeSwitcherBar || !this.dimension) {
			return; // We have not been rendered yet so there is nothing to update.
		}

		let compositesToShow = this.model.visibleItems.filter(item =>
			item.pinned
			|| (this.model.activeItem && this.model.activeItem.id === item.id) /* Show the active composite even if it is not pinned */
		).map(item => item.id);

		// Ensure we are not showing more composites than we have height for
		let maxVisible = compositesToShow.length;
		const totalComposites = compositesToShow.length;
		let size = 0;
		const limit = this.options.orientation === ActionsOrientation.VERTICAL ? this.dimension.height : this.dimension.width;

		// Add composites while they fit
		for (let i = 0; i < compositesToShow.length; i++) {
			const compositeSize = this.compositeSizeInBar.get(compositesToShow[i])!;
			// Adding this composite will overflow available size, so don't
			if (size + compositeSize > limit) {
				maxVisible = i;
				break;
			}

			size += compositeSize;
		}

		// Remove the tail of composites that did not fit
		if (totalComposites > maxVisible) {
			compositesToShow = compositesToShow.slice(0, maxVisible);
		}

		// We always try show the active composite, so re-add it if it was sliced out
		if (this.model.activeItem && compositesToShow.every(compositeId => !!this.model.activeItem && compositeId !== this.model.activeItem.id)) {
			size += this.compositeSizeInBar.get(this.model.activeItem.id)!;
			compositesToShow.push(this.model.activeItem.id);
		}

		// The active composite might have pushed us over the limit
		// Keep popping the composite before the active one until it fits
		// If even the active one doesn't fit, we will resort to overflow
		while (size > limit && compositesToShow.length) {
			const removedComposite = compositesToShow.length > 1 ? compositesToShow.splice(compositesToShow.length - 2, 1)[0] : compositesToShow.pop();
			size -= this.compositeSizeInBar.get(removedComposite!)!;
		}

		// We are overflowing, add the overflow size
		if (totalComposites > compositesToShow.length) {
			size += this.options.overflowActionSize;
		}

		// Check if we need to make extra room for the overflow action
		while (size > limit && compositesToShow.length) {
			const removedComposite = compositesToShow.length > 1 && compositesToShow[compositesToShow.length - 1] === this.model.activeItem?.id ?
				compositesToShow.splice(compositesToShow.length - 2, 1)[0] : compositesToShow.pop();
			size -= this.compositeSizeInBar.get(removedComposite!)!;
		}

		// Remove the overflow action if there are no overflows
		if (totalComposites === compositesToShow.length && this.compositeOverflowAction) {
			compositeSwitcherBar.pull(compositeSwitcherBar.length() - 1);

			this.compositeOverflowAction.dispose();
			this.compositeOverflowAction = undefined;

			if (this.compositeOverflowActionViewItem) {
				this.compositeOverflowActionViewItem.dispose();
			}
			this.compositeOverflowActionViewItem = undefined;
		}

		// Pull out composites that overflow or got hidden
		const compositesToRemove: number[] = [];
		this.visibleComposites.forEach((compositeId, index) => {
			if (!compositesToShow.includes(compositeId)) {
				compositesToRemove.push(index);
			}
		});
		compositesToRemove.reverse().forEach(index => {
			const actionViewItem = compositeSwitcherBar.viewItems[index];
			compositeSwitcherBar.pull(index);
			actionViewItem.dispose();
			this.visibleComposites.splice(index, 1);
		});

		// Update the positions of the composites
		compositesToShow.forEach((compositeId, newIndex) => {
			const currentIndex = this.visibleComposites.indexOf(compositeId);
			if (newIndex !== currentIndex) {
				if (currentIndex !== -1) {
					const actionViewItem = compositeSwitcherBar.viewItems[currentIndex];
					compositeSwitcherBar.pull(currentIndex);
					actionViewItem.dispose();
					this.visibleComposites.splice(currentIndex, 1);
				}

				compositeSwitcherBar.push(this.model.findItem(compositeId).activityAction, { label: true, icon: this.options.icon, index: newIndex });
				this.visibleComposites.splice(newIndex, 0, compositeId);
			}
		});


		this._onDidChange.fire();
	}

}

interface ICompositeBarModelItem extends ICompositeBarItem {
	activityAction: ActivityAction;
	pinnedAction: IAction;
	activity: ICompositeActivity[];
}

class CompositeBarModel {

	private _items: ICompositeBarModelItem[] = [];
	private readonly options: ICompositeBarOptions;
	activeItem?: ICompositeBarModelItem;

	constructor(
		items: ICompositeBarItem[],
		options: ICompositeBarOptions
	) {
		this.options = options;
		this.setItems(items);
	}

	get items(): ICompositeBarModelItem[] {
		return this._items;
	}

	setItems(items: ICompositeBarItem[]): boolean {
		const result: ICompositeBarModelItem[] = [];
		let hasChanges: boolean = false;
		if (!this.items || this.items.length === 0) {
			this._items = items.map(i => this.createCompositeBarItem(i.id, i.name, i.order, i.pinned, i.visible));
			hasChanges = true;
		} else {
			const existingItems = this.items;
			for (let index = 0; index < items.length; index++) {
				const newItem = items[index];
				const existingItem = existingItems.filter(({ id }) => id === newItem.id)[0];
				if (existingItem) {
					if (
						existingItem.pinned !== newItem.pinned ||
						index !== existingItems.indexOf(existingItem)
					) {
						existingItem.pinned = newItem.pinned;
						result.push(existingItem);
						hasChanges = true;
					} else {
						result.push(existingItem);
					}
				} else {
					result.push(this.createCompositeBarItem(newItem.id, newItem.name, newItem.order, newItem.pinned, newItem.visible));
					hasChanges = true;
				}
			}
			this._items = result;
		}

		return hasChanges;
	}

	get visibleItems(): ICompositeBarModelItem[] {
		return this.items.filter(item => item.visible);
	}

	get pinnedItems(): ICompositeBarModelItem[] {
		return this.items.filter(item => item.visible && item.pinned);
	}

	private createCompositeBarItem(id: string, name: string | undefined, order: number | undefined, pinned: boolean, visible: boolean): ICompositeBarModelItem {
		const options = this.options;
		return {
			id, name, pinned, order, visible,
			activity: [],
			get activityAction() {
				return options.getActivityAction(id);
			},
			get pinnedAction() {
				return options.getCompositePinnedAction(id);
			}
		};
	}

	add(id: string, name: string, order: number | undefined, requestedIndex: number | undefined): boolean {
		const item = this.findItem(id);
		if (item) {
			let changed = false;
			item.name = name;
			if (!isUndefinedOrNull(order)) {
				changed = item.order !== order;
				item.order = order;
			}
			if (!item.visible) {
				item.visible = true;
				changed = true;
			}

			return changed;
		} else {
			const item = this.createCompositeBarItem(id, name, order, true, true);
			if (!isUndefinedOrNull(requestedIndex)) {
				let index = 0;
				let rIndex = requestedIndex;
				while (rIndex > 0 && index < this.items.length) {
					if (this.items[index++].visible) {
						rIndex--;
					}
				}

				this.items.splice(index, 0, item);
			} else if (isUndefinedOrNull(order)) {
				this.items.push(item);
			} else {
				let index = 0;
				while (index < this.items.length && typeof this.items[index].order === 'number' && this.items[index].order! < order) {
					index++;
				}
				this.items.splice(index, 0, item);
			}

			return true;
		}
	}

	remove(id: string): boolean {
		for (let index = 0; index < this.items.length; index++) {
			if (this.items[index].id === id) {
				this.items.splice(index, 1);
				return true;
			}
		}
		return false;
	}

	hide(id: string): boolean {
		for (const item of this.items) {
			if (item.id === id) {
				if (item.visible) {
					item.visible = false;
					return true;
				}
				return false;
			}
		}
		return false;
	}

	move(compositeId: string, toCompositeId: string): boolean {

		const fromIndex = this.findIndex(compositeId);
		const toIndex = this.findIndex(toCompositeId);

		// Make sure both items are known to the model
		if (fromIndex === -1 || toIndex === -1) {
			return false;
		}

		const sourceItem = this.items.splice(fromIndex, 1)[0];
		this.items.splice(toIndex, 0, sourceItem);

		// Make sure a moved composite gets pinned
		sourceItem.pinned = true;

		return true;
	}

	setPinned(id: string, pinned: boolean): boolean {
		for (const item of this.items) {
			if (item.id === id) {
				if (item.pinned !== pinned) {
					item.pinned = pinned;
					return true;
				}
				return false;
			}
		}
		return false;
	}

	addActivity(id: string, activity: ICompositeActivity): boolean {
		const item = this.findItem(id);
		if (item) {
			const stack = item.activity;
			for (let i = 0; i <= stack.length; i++) {
				if (i === stack.length) {
					stack.push(activity);
					break;
				} else if (stack[i].priority <= activity.priority) {
					stack.splice(i, 0, activity);
					break;
				}
			}
			this.updateActivity(id);
			return true;
		}
		return false;
	}

	removeActivity(id: string, activity: ICompositeActivity): boolean {
		const item = this.findItem(id);
		if (item) {
			const index = item.activity.indexOf(activity);
			if (index !== -1) {
				item.activity.splice(index, 1);
				this.updateActivity(id);
				return true;
			}
		}
		return false;
	}

	updateActivity(id: string): void {
		const item = this.findItem(id);
		if (item) {
			if (item.activity.length) {
				const [{ badge, clazz }] = item.activity;
				item.activityAction.setBadge(badge, clazz);
			}
			else {
				item.activityAction.setBadge(undefined);
			}
		}
	}

	activate(id: string): boolean {
		if (!this.activeItem || this.activeItem.id !== id) {
			if (this.activeItem) {
				this.deactivate();
			}
			for (const item of this.items) {
				if (item.id === id) {
					this.activeItem = item;
					this.activeItem.activityAction.activate();
					return true;
				}
			}
		}
		return false;
	}

	deactivate(): boolean {
		if (this.activeItem) {
			this.activeItem.activityAction.deactivate();
			this.activeItem = undefined;
			return true;
		}
		return false;
	}

	findItem(id: string): ICompositeBarModelItem {
		return this.items.filter(item => item.id === id)[0];
	}

	private findIndex(id: string): number {
		for (let index = 0; index < this.items.length; index++) {
			if (this.items[index].id === id) {
				return index;
			}
		}
		return -1;
	}
}
