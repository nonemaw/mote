import { ThemedStyles } from 'mote/base/common/themes';
import { IThemeService, ThemeIcon } from 'mote/platform/theme/common/themeService';
import { Part } from 'mote/workbench/browser/part';
import { ViewContainerActivityAction } from 'mote/workbench/browser/parts/activitybar/activitybarActions';
import { ToggleCompositePinnedAction } from 'mote/workbench/browser/parts/compositeBarAction';
import { IPaneCompositePart, IPaneCompositeSelectorPart } from 'mote/workbench/browser/parts/paneCompositePart';
import { IViewDescriptorService, ViewContainer, ViewContainerLocation } from 'mote/workbench/common/views';
import { IBadge } from 'mote/workbench/services/activity/common/activity';
import { IWorkbenchLayoutService, Parts } from 'mote/workbench/services/layout/browser/layoutService';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { assertIsDefined, isString } from 'vs/base/common/types';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';

interface IPlaceholderViewContainer {
	readonly id: string;
	readonly name?: string;
	readonly iconUrl?: UriComponents;
	readonly themeIcon?: ThemeIcon;
	readonly isBuiltin?: boolean;
	readonly views?: { when?: string }[];
}

interface IPinnedViewContainer {
	readonly id: string;
	readonly pinned: boolean;
	readonly order?: number;
	readonly visible: boolean;
}

interface ICachedViewContainer {
	readonly id: string;
	name?: string;
	icon?: URI | ThemeIcon;
	readonly pinned: boolean;
	readonly order?: number;
	visible: boolean;
	isBuiltin?: boolean;
	views?: { when?: string }[];
}

export class ActivitybarPart extends Part implements IPaneCompositeSelectorPart {

	declare readonly _serviceBrand: undefined;

	private static readonly PINNED_VIEW_CONTAINERS = 'workbench.activity.pinnedViewlets';
	private static readonly PLACEHOLDER_VIEW_CONTAINERS = 'workbench.activity.placeholderViewlets';
	//private static readonly ACTION_HEIGHT = 48;
	//private static readonly ACCOUNTS_ACTION_INDEX = 0;

	//#region IView

	readonly minimumWidth: number = 48;
	readonly maximumWidth: number = 48;
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;

	//#endregion

	private content: HTMLElement | undefined;

	private readonly compositeActions = new Map<string, { activityAction: ViewContainerActivityAction; pinnedAction: ToggleCompositePinnedAction }>();
	private readonly viewContainerDisposables = new Map<string, IDisposable>();

	private readonly location = ViewContainerLocation.Sidebar;

	constructor(
		private readonly paneCompositePart: IPaneCompositePart,
		@IThemeService themeService: IThemeService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IStorageService private readonly storageService: IStorageService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super(Parts.ACTIVITYBAR_PART, { hasTitle: false }, themeService, layoutService);

		this.onDidRegisterViewContainers(this.getViewContainers());

		//this.createCompositeBar();
	}

	override createContentArea(parent: HTMLElement): HTMLElement {
		this.element = parent;

		this.content = document.createElement('div');
		this.content.classList.add('content');
		parent.appendChild(this.content);

		return this.content;
	}

	public createCompositeBar() {
		this.cachedViewContainers
			.map(container => ({
				id: container.id,
				name: container.name,
				visible: container.visible,
				order: container.order,
				pinned: container.pinned
			}));
	}

	override updateStyles(): void {
		super.updateStyles();

		// Part container
		const container = assertIsDefined(this.getContainer());
		container.style.backgroundColor = ThemedStyles.activityBackground.dark;
		container.style.height = '100%';
	}

	private onDidRegisterViewContainers(viewContainers: readonly ViewContainer[]): void {
		for (const viewContainer of viewContainers) {
			this.addComposite(viewContainer);

			// Pin it by default if it is new
			const cachedViewContainer = this.cachedViewContainers.filter(({ id }) => id === viewContainer.id)[0];
			if (!cachedViewContainer) {
				//this.compositeBar.pin(viewContainer.id);
			}

			// Active
			const visibleViewContainer = this.paneCompositePart.getActivePaneComposite();
			if (visibleViewContainer?.getId() === viewContainer.id) {
				//this.compositeBar.activateComposite(viewContainer.id);
			}

			const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
			//this.updateActivity(viewContainer, viewContainerModel);
			//this.showOrHideViewContainer(viewContainer);

			const disposables = new DisposableStore();
			//disposables.add(viewContainerModel.onDidChangeContainerInfo(() => this.updateActivity(viewContainer, viewContainerModel)));
			disposables.add(viewContainerModel.onDidChangeActiveViewDescriptors(() => this.showOrHideViewContainer(viewContainer)));

			this.viewContainerDisposables.set(viewContainer.id, disposables);
		}
	}

	/*
	private onDidDeregisterViewContainer(viewContainer: ViewContainer): void {
		const disposable = this.viewContainerDisposables.get(viewContainer.id);
		if (disposable) {
			disposable.dispose();
		}

		this.viewContainerDisposables.delete(viewContainer.id);
		this.removeComposite(viewContainer.id);
	}
	*/

	private showOrHideViewContainer(viewContainer: ViewContainer): void {
		/*
		let contextKey = this.enabledViewContainersContextKeys.get(viewContainer.id);
		if (!contextKey) {
			contextKey = this.contextKeyService.createKey(getEnabledViewContainerContextKey(viewContainer.id), false);
			this.enabledViewContainersContextKeys.set(viewContainer.id, contextKey);
		}
		*/
		if (this.shouldBeHidden(viewContainer)) {
			//contextKey.set(false);
			this.hideComposite(viewContainer.id);
		} else {
			//contextKey.set(true);
			this.addComposite(viewContainer);
		}
	}

	//#region composite

	private shouldBeHidden(viewContainerOrId: string | ViewContainer, cachedViewContainer?: ICachedViewContainer): boolean {
		const viewContainer = isString(viewContainerOrId) ? this.getViewContainer(viewContainerOrId) : viewContainerOrId;
		const viewContainerId = isString(viewContainerOrId) ? viewContainerOrId : viewContainerOrId.id;

		if (viewContainer) {
			if (viewContainer.hideIfEmpty) {
				if (this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.length > 0) {
					return false;
				}
			} else {
				return false;
			}
		}

		if (viewContainerId) {

		}

		return true;
	}

	private addComposite(viewContainer: ViewContainer): void {
		//this.compositeBar.addComposite({ id: viewContainer.id, name: viewContainer.title, order: viewContainer.order, requestedIndex: viewContainer.requestedIndex });
	}

	private hideComposite(compositeId: string): void {
		//this.compositeBar.hideComposite(compositeId);

		const compositeActions = this.compositeActions.get(compositeId);
		if (compositeActions) {
			compositeActions.activityAction.dispose();
			compositeActions.pinnedAction.dispose();
			this.compositeActions.delete(compositeId);
		}
	}

	public removeComposite(compositeId: string): void {
		//this.compositeBar.removeComposite(compositeId);

		const compositeActions = this.compositeActions.get(compositeId);
		if (compositeActions) {
			compositeActions.activityAction.dispose();
			compositeActions.pinnedAction.dispose();
			this.compositeActions.delete(compositeId);
		}
	}

	getPinnedPaneCompositeIds(): string[] {
		throw new Error('Method not implemented.');
	}
	getVisiblePaneCompositeIds(): string[] {
		throw new Error('Method not implemented.');
	}
	showActivity(id: string, badge: IBadge, clazz?: string | undefined, priority?: number | undefined): IDisposable {
		throw new Error('Method not implemented.');
	}

	private getViewContainer(id: string): ViewContainer | undefined {
		const viewContainer = this.viewDescriptorService.getViewContainerById(id);
		return viewContainer && this.viewDescriptorService.getViewContainerLocation(viewContainer) === this.location ? viewContainer : undefined;
	}

	private getViewContainers(): readonly ViewContainer[] {
		return this.viewDescriptorService.getViewContainersByLocation(this.location);
	}

	//#region PinnedViewContainers

	private getPinnedViewContainers(): IPinnedViewContainer[] {
		return JSON.parse(this.pinnedViewContainersValue);
	}

	/*
	private setPinnedViewContainers(pinnedViewContainers: IPinnedViewContainer[]): void {
		this.pinnedViewContainersValue = JSON.stringify(pinnedViewContainers);
	}
	*/

	private _pinnedViewContainersValue: string | undefined;
	private get pinnedViewContainersValue(): string {
		if (!this._pinnedViewContainersValue) {
			this._pinnedViewContainersValue = this.getStoredPinnedViewContainersValue();
		}

		return this._pinnedViewContainersValue || '[]';
	}

	private set pinnedViewContainersValue(pinnedViewContainersValue: string) {
		if (this.pinnedViewContainersValue !== pinnedViewContainersValue) {
			this._pinnedViewContainersValue = pinnedViewContainersValue;
			this.setStoredPinnedViewContainersValue(pinnedViewContainersValue);
		}
	}

	private getStoredPinnedViewContainersValue(): string {
		return this.storageService.get(ActivitybarPart.PINNED_VIEW_CONTAINERS, StorageScope.PROFILE, '[]');
	}

	private setStoredPinnedViewContainersValue(value: string): void {
		this.storageService.store(ActivitybarPart.PINNED_VIEW_CONTAINERS, value, StorageScope.PROFILE, StorageTarget.USER);
	}

	//#endregion

	//#region PlaceholderViewContainers

	private getPlaceholderViewContainers(): IPlaceholderViewContainer[] {
		return JSON.parse(this.placeholderViewContainersValue);
	}

	/*
	private setPlaceholderViewContainers(placeholderViewContainers: IPlaceholderViewContainer[]): void {
		this.placeholderViewContainersValue = JSON.stringify(placeholderViewContainers);
	}
	*/

	private _placeholderViewContainersValue: string | undefined;
	private get placeholderViewContainersValue(): string {
		if (!this._placeholderViewContainersValue) {
			this._placeholderViewContainersValue = this.getStoredPlaceholderViewContainersValue();
		}

		return this._placeholderViewContainersValue || '[]';
	}

	private set placeholderViewContainersValue(placeholderViewContainesValue: string) {
		if (this.placeholderViewContainersValue !== placeholderViewContainesValue) {
			this._placeholderViewContainersValue = placeholderViewContainesValue;
			this.setStoredPlaceholderViewContainersValue(placeholderViewContainesValue);
		}
	}

	private getStoredPlaceholderViewContainersValue(): string {
		return this.storageService.get(ActivitybarPart.PLACEHOLDER_VIEW_CONTAINERS, StorageScope.PROFILE, '[]');
	}

	private setStoredPlaceholderViewContainersValue(value: string): void {
		this.storageService.store(ActivitybarPart.PLACEHOLDER_VIEW_CONTAINERS, value, StorageScope.PROFILE, StorageTarget.MACHINE);
	}

	//#endregion

	private _cachedViewContainers: ICachedViewContainer[] | undefined = undefined;
	private get cachedViewContainers(): ICachedViewContainer[] {
		if (this._cachedViewContainers === undefined) {
			this._cachedViewContainers = this.getPinnedViewContainers();
			for (const placeholderViewContainer of this.getPlaceholderViewContainers()) {
				const cachedViewContainer = this._cachedViewContainers.filter(cached => cached.id === placeholderViewContainer.id)[0];
				if (cachedViewContainer) {
					cachedViewContainer.name = placeholderViewContainer.name;
					cachedViewContainer.icon = placeholderViewContainer.themeIcon ? placeholderViewContainer.themeIcon :
						placeholderViewContainer.iconUrl ? URI.revive(placeholderViewContainer.iconUrl) : undefined;
					cachedViewContainer.views = placeholderViewContainer.views;
					cachedViewContainer.isBuiltin = placeholderViewContainer.isBuiltin;
				}
			}
		}

		return this._cachedViewContainers;
	}

	toJSON(): object {
		return {
			type: Parts.ACTIVITYBAR_PART
		};
	}
}
