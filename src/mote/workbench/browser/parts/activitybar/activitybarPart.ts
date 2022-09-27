import 'vs/css!./media/activitybarpart';
import { ThemedStyles } from 'mote/base/common/themes';
import { IColorTheme, IThemeService, ThemeIcon } from 'mote/platform/theme/common/themeService';
import { Part } from 'mote/workbench/browser/part';
import { PlaceHolderToggleCompositePinnedAction, PlaceHolderViewContainerActivityAction, ViewContainerActivityAction } from 'mote/workbench/browser/parts/activitybar/activitybarActions';
import { IActivityHoverOptions, ICompositeBarColors, ToggleCompositePinnedAction } from 'mote/workbench/browser/parts/compositeBarAction';
import { IPaneCompositePart, IPaneCompositeSelectorPart } from 'mote/workbench/browser/parts/paneCompositePart';
import { IViewContainerModel, IViewDescriptorService, ViewContainer, ViewContainerLocation } from 'mote/workbench/common/views';
import { IBadge } from 'mote/workbench/services/activity/common/activity';
import { IWorkbenchLayoutService, Parts, Position } from 'mote/workbench/services/layout/browser/layoutService';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { assertIsDefined, isString } from 'vs/base/common/types';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { CompositeBar } from 'mote/workbench/browser/parts/compositeBar';
import { IActivity } from 'mote/workbench/common/activity';
import { asCSSUrl, createCSSRule, Dimension } from 'vs/base/browser/dom';
import { StringSHA1 } from 'vs/base/common/hash';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { ACTIVITY_BAR_ACTIVE_BACKGROUND, ACTIVITY_BAR_ACTIVE_BORDER, ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_DRAG_AND_DROP_BORDER, ACTIVITY_BAR_FOREGROUND, ACTIVITY_BAR_INACTIVE_FOREGROUND } from 'mote/workbench/common/theme';
import { HoverPosition } from 'vs/base/browser/ui/hover/hoverWidget';

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
	private static readonly ACTION_HEIGHT = 48;
	//private static readonly ACCOUNTS_ACTION_INDEX = 0;

	//#region IView

	readonly minimumWidth: number = 48;
	readonly maximumWidth: number = 48;
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;

	//#endregion

	private content: HTMLElement | undefined;

	private compositeBar: CompositeBar;
	private compositeBarContainer: HTMLElement | undefined;

	private readonly compositeActions = new Map<string, { activityAction: ViewContainerActivityAction; pinnedAction: ToggleCompositePinnedAction }>();
	private readonly viewContainerDisposables = new Map<string, IDisposable>();

	private readonly location = ViewContainerLocation.Sidebar;

	constructor(
		private readonly paneCompositePart: IPaneCompositePart,
		@IThemeService themeService: IThemeService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IStorageService private readonly storageService: IStorageService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IInstantiationService private instantiationService: IInstantiationService,
		//@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
	) {
		super(Parts.ACTIVITYBAR_PART, { hasTitle: false }, themeService, layoutService);

		this.compositeBar = this.createCompositeBar();

		this.onDidRegisterViewContainers(this.getViewContainers());

		this.registerListeners();
	}

	override createContentArea(parent: HTMLElement): HTMLElement {
		this.element = parent;

		this.content = document.createElement('div');
		this.content.classList.add('content');
		parent.appendChild(this.content);

		// View Containers action bar
		this.compositeBarContainer = this.compositeBar.create(this.content);

		return this.content;
	}

	public createCompositeBar() {
		const cachedItems = this.cachedViewContainers
			.map(container => ({
				id: container.id,
				name: container.name,
				visible: container.visible,
				order: container.order,
				pinned: container.pinned
			}));
		return this._register(this.instantiationService.createInstance(CompositeBar, cachedItems, {
			icon: true,
			orientation: ActionsOrientation.VERTICAL,
			activityHoverOptions: this.getActivityHoverOptions(),
			openComposite: async (compositeId, preserveFocus) => {
				return (await this.paneCompositePart.openPaneComposite(compositeId, !preserveFocus)) ?? null;
			},
			getDefaultCompositeId: () => this.viewDescriptorService.getDefaultViewContainer(this.location)?.id,
			getActivityAction: compositeId => this.getCompositeActions(compositeId).activityAction,
			getCompositePinnedAction: compositeId => this.getCompositeActions(compositeId).pinnedAction,
			compositeSize: 52,
			colors: (theme: IColorTheme) => this.getActivitybarItemColors(theme),
			overflowActionSize: ActivitybarPart.ACTION_HEIGHT
		}));
	}

	private getActivityHoverOptions(): IActivityHoverOptions {
		return {
			position: () => this.layoutService.getSideBarPosition() === Position.LEFT ? HoverPosition.RIGHT : HoverPosition.LEFT,
		};
	}

	private registerListeners(): void {

		// View Container Changes
		this._register(this.viewDescriptorService.onDidChangeViewContainers(({ added, removed }) => this.onDidChangeViewContainers(added, removed)));
		//this._register(this.viewDescriptorService.onDidChangeContainerLocation(({ viewContainer, from, to }) => this.onDidChangeViewContainerLocation(viewContainer, from, to)));

		// View Container Visibility Changes
		this.paneCompositePart.onDidPaneCompositeOpen(e => this.onDidChangeViewContainerVisibility(e.getId(), true));
		this.paneCompositePart.onDidPaneCompositeClose(e => this.onDidChangeViewContainerVisibility(e.getId(), false));

		// Extension registration
		/*
		const disposables = this._register(new DisposableStore());
		this._register(this.extensionService.onDidRegisterExtensions(() => {
			disposables.clear();
			this.onDidRegisterExtensions();
			this.compositeBar.onDidChange(() => this.saveCachedViewContainers(), this, disposables);
			this.storageService.onDidChangeValue(e => this.onDidStorageValueChange(e), this, disposables);
		}));


		// Register for configuration changes
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('window.menuBarVisibility')) {
				if (getMenuBarVisibility(this.configurationService) === 'compact') {
					this.installMenubar();
				} else {
					this.uninstallMenubar();
				}
			}
		}));
		*/
	}

	private onDidChangeViewContainers(added: readonly { container: ViewContainer; location: ViewContainerLocation }[], removed: readonly { container: ViewContainer; location: ViewContainerLocation }[]) {
		removed.filter(({ location }) => location === ViewContainerLocation.Sidebar).forEach(({ container }) => this.onDidDeregisterViewContainer(container));
		this.onDidRegisterViewContainers(added.filter(({ location }) => location === ViewContainerLocation.Sidebar).map(({ container }) => container));
	}

	private onDidChangeViewContainerLocation(container: ViewContainer, from: ViewContainerLocation, to: ViewContainerLocation) {
		if (from === this.location) {
			this.onDidDeregisterViewContainer(container);
		}

		if (to === this.location) {
			this.onDidRegisterViewContainers([container]);
		}
	}

	private onDidChangeViewContainerVisibility(id: string, visible: boolean) {
		if (visible) {
			// Activate view container action on opening of a view container
			this.onDidViewContainerVisible(id);
		} else {
			// Deactivate view container action on close
			this.compositeBar.deactivateComposite(id);
		}
	}

	private onDidRegisterExtensions(): void {
		//this.hasExtensionsRegistered = true;

		// show/hide/remove composites
		for (const { id } of this.cachedViewContainers) {
			const viewContainer = this.getViewContainer(id);
			if (viewContainer) {
				this.showOrHideViewContainer(viewContainer);
			} else {
				if (this.viewDescriptorService.isViewContainerRemovedPermanently(id)) {
					this.removeComposite(id);
				} else {
					this.hideComposite(id);
				}
			}
		}

		this.saveCachedViewContainers();
	}

	private onDidViewContainerVisible(id: string): void {
		const viewContainer = this.getViewContainer(id);
		if (viewContainer) {

			// Update the composite bar by adding
			this.addComposite(viewContainer);
			this.compositeBar.activateComposite(viewContainer.id);

			if (this.shouldBeHidden(viewContainer)) {
				const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
				if (viewContainerModel.activeViewDescriptors.length === 0) {
					// Update the composite bar by hiding
					this.hideComposite(viewContainer.id);
				}
			}
		}
	}


	override updateStyles(): void {
		super.updateStyles();

		// Part container
		const container = assertIsDefined(this.getContainer());
		container.style.backgroundColor = ThemedStyles.activityBackground.dark;
		container.style.height = '100%';
	}

	private getCompositeActions(compositeId: string): { activityAction: ViewContainerActivityAction; pinnedAction: ToggleCompositePinnedAction } {
		let compositeActions = this.compositeActions.get(compositeId);
		if (!compositeActions) {
			const viewContainer = this.getViewContainer(compositeId);
			if (viewContainer) {
				const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
				compositeActions = {
					activityAction: this.instantiationService.createInstance(ViewContainerActivityAction, this.toActivity(viewContainerModel), this.paneCompositePart),
					pinnedAction: new ToggleCompositePinnedAction(this.toActivity(viewContainerModel), this.compositeBar)
				};
			} else {
				const cachedComposite = this.cachedViewContainers.filter(c => c.id === compositeId)[0];
				compositeActions = {
					activityAction: this.instantiationService.createInstance(PlaceHolderViewContainerActivityAction, ActivitybarPart.toActivity(compositeId, compositeId, cachedComposite?.icon, undefined), this.paneCompositePart),
					pinnedAction: new PlaceHolderToggleCompositePinnedAction(compositeId, this.compositeBar)
				};
			}

			this.compositeActions.set(compositeId, compositeActions);
		}

		return compositeActions;
	}

	private onDidRegisterViewContainers(viewContainers: readonly ViewContainer[]): void {
		for (const viewContainer of viewContainers) {
			this.addComposite(viewContainer);

			// Pin it by default if it is new
			const cachedViewContainer = this.cachedViewContainers.filter(({ id }) => id === viewContainer.id)[0];
			if (!cachedViewContainer) {
				this.compositeBar.pin(viewContainer.id);
			}

			// Active
			const visibleViewContainer = this.paneCompositePart.getActivePaneComposite();
			if (visibleViewContainer?.getId() === viewContainer.id) {
				this.compositeBar.activateComposite(viewContainer.id);
			}

			const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
			this.updateActivity(viewContainer, viewContainerModel);
			this.showOrHideViewContainer(viewContainer);

			const disposables = new DisposableStore();
			disposables.add(viewContainerModel.onDidChangeContainerInfo(() => this.updateActivity(viewContainer, viewContainerModel)));
			disposables.add(viewContainerModel.onDidChangeActiveViewDescriptors(() => this.showOrHideViewContainer(viewContainer)));

			this.viewContainerDisposables.set(viewContainer.id, disposables);
		}
	}


	private onDidDeregisterViewContainer(viewContainer: ViewContainer): void {
		const disposable = this.viewContainerDisposables.get(viewContainer.id);
		if (disposable) {
			disposable.dispose();
		}

		this.viewContainerDisposables.delete(viewContainer.id);
		this.removeComposite(viewContainer.id);
	}

	private updateActivity(viewContainer: ViewContainer, viewContainerModel: IViewContainerModel): void {
		const activity: IActivity = this.toActivity(viewContainerModel);
		const { activityAction, pinnedAction } = this.getCompositeActions(viewContainer.id);
		activityAction.updateActivity(activity);

		if (pinnedAction instanceof PlaceHolderToggleCompositePinnedAction) {
			pinnedAction.setActivity(activity);
		}

		this.saveCachedViewContainers();
	}


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
		this.compositeBar.addComposite({ id: viewContainer.id, name: viewContainer.title, order: viewContainer.order, requestedIndex: viewContainer.requestedIndex });
	}

	private hideComposite(compositeId: string): void {
		this.compositeBar.hideComposite(compositeId);

		const compositeActions = this.compositeActions.get(compositeId);
		if (compositeActions) {
			compositeActions.activityAction.dispose();
			compositeActions.pinnedAction.dispose();
			this.compositeActions.delete(compositeId);
		}
	}

	public removeComposite(compositeId: string): void {
		this.compositeBar.removeComposite(compositeId);

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

	private toActivity(viewContainerModel: IViewContainerModel): IActivity {
		return ActivitybarPart.toActivity(viewContainerModel.viewContainer.id, viewContainerModel.title, viewContainerModel.icon, viewContainerModel.keybindingId);
	}

	private static toActivity(id: string, name: string, icon: URI | ThemeIcon | undefined, keybindingId: string | undefined): IActivity {
		let cssClass: string | undefined = undefined;
		let iconUrl: URI | undefined = undefined;
		if (URI.isUri(icon)) {
			iconUrl = icon;
			const cssUrl = asCSSUrl(icon);
			const hash = new StringSHA1();
			hash.update(cssUrl);
			cssClass = `activity-${id.replace(/\./g, '-')}-${hash.digest()}`;
			const iconClass = `.monaco-workbench .activitybar .monaco-action-bar .action-label.${cssClass}`;
			createCSSRule(iconClass, `
				mask: ${cssUrl} no-repeat 50% 50%;
				mask-size: 24px;
				-webkit-mask: ${cssUrl} no-repeat 50% 50%;
				-webkit-mask-size: 24px;
			`);
		} else if (ThemeIcon.isThemeIcon(icon)) {
			cssClass = ThemeIcon.asClassName(icon);
		}

		return { id, name, cssClass, iconUrl, keybindingId };
	}

	override layout(width: number, height: number): void {
		if (!this.layoutService.isVisible(Parts.ACTIVITYBAR_PART)) {
			return;
		}

		// Layout contents
		const contentAreaSize = super.layoutContents(width, height).contentSize;

		// Layout composite bar
		let availableHeight = contentAreaSize.height;
		/*
		if (this.menuBarContainer) {
			availableHeight -= this.menuBarContainer.clientHeight;
		}
		if (this.globalActivityActionBar) {
			availableHeight -= (this.globalActivityActionBar.viewItems.length * ActivitybarPart.ACTION_HEIGHT); // adjust height for global actions showing
		}
		*/
		this.compositeBar.layout(new Dimension(width, availableHeight));
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

	private setPinnedViewContainers(pinnedViewContainers: IPinnedViewContainer[]): void {
		this.pinnedViewContainersValue = JSON.stringify(pinnedViewContainers);
	}

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

	private setPlaceholderViewContainers(placeholderViewContainers: IPlaceholderViewContainer[]): void {
		this.placeholderViewContainersValue = JSON.stringify(placeholderViewContainers);
	}

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

	private saveCachedViewContainers(): void {
		const state: ICachedViewContainer[] = [];

		const compositeItems = this.compositeBar.getCompositeBarItems();
		for (const compositeItem of compositeItems) {
			const viewContainer = this.getViewContainer(compositeItem.id);
			if (viewContainer) {
				const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
				const views: { when: string | undefined }[] = [];
				for (const { when } of viewContainerModel.allViewDescriptors) {
					views.push({ when: when ? when.serialize() : undefined });
				}
				state.push({
					id: compositeItem.id,
					name: viewContainerModel.title,
					icon: undefined, /* Donot cache uri icons in desktop with remote connection */
					views,
					pinned: compositeItem.pinned,
					order: compositeItem.order,
					visible: compositeItem.visible,
					isBuiltin: !viewContainer.extensionId
				});
			} else {
				state.push({ id: compositeItem.id, pinned: compositeItem.pinned, order: compositeItem.order, visible: false, isBuiltin: false });
			}
		}

		this.storeCachedViewContainersState(state);
	}

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

	private storeCachedViewContainersState(cachedViewContainers: ICachedViewContainer[]): void {
		this.setPinnedViewContainers(cachedViewContainers.map(({ id, pinned, visible, order }) => (<IPinnedViewContainer>{
			id,
			pinned,
			visible,
			order
		})));

		this.setPlaceholderViewContainers(cachedViewContainers.map(({ id, icon, name, views, isBuiltin }) => (<IPlaceholderViewContainer>{
			id,
			iconUrl: URI.isUri(icon) ? icon : undefined,
			themeIcon: ThemeIcon.isThemeIcon(icon) ? icon : undefined,
			name,
			isBuiltin,
			views
		})));
	}

	private getActivitybarItemColors(theme: IColorTheme): ICompositeBarColors {
		return {
			activeForegroundColor: theme.getColor(ACTIVITY_BAR_FOREGROUND),
			inactiveForegroundColor: theme.getColor(ACTIVITY_BAR_INACTIVE_FOREGROUND),
			activeBorderColor: theme.getColor(ACTIVITY_BAR_ACTIVE_BORDER),
			activeBackground: theme.getColor(ACTIVITY_BAR_ACTIVE_BACKGROUND),
			badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
			badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
			dragAndDropBorder: theme.getColor(ACTIVITY_BAR_DRAG_AND_DROP_BORDER),
			activeBackgroundColor: undefined, inactiveBackgroundColor: undefined, activeBorderBottomColor: undefined,
		};
	}

	toJSON(): object {
		return {
			type: Parts.ACTIVITYBAR_PART
		};
	}
}
