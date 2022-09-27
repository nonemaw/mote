import { ICommandService } from 'mote/platform/commands/common/commands';
import { IColorTheme, IThemeService, ThemeIcon } from 'mote/platform/theme/common/themeService';
import { IActivity } from 'mote/workbench/common/activity';
import { IBadge, IconBadge, NumberBadge, ProgressBadge, TextBadge } from 'mote/workbench/services/activity/common/activity';
import { BaseActionViewItem, IBaseActionViewItemOptions } from 'vs/base/browser/ui/actionbar/actionViewItems';
import { Action, IAction } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { Color } from 'vs/base/common/color';
import { Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { HoverPosition } from 'vs/base/browser/ui/hover/hoverWidget';
import { IHoverService, IHoverWidget } from 'mote/workbench/services/hover/browser/hover';
import { DisposableStore, MutableDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { contrastBorder } from 'mote/platform/theme/common/themeColors';
import { addDisposableListener, append, clearNode, hide, show, $, EventType } from 'vs/base/browser/dom';
import { RunOnceScheduler } from 'vs/base/common/async';

export interface ICompositeActivity {
	badge: IBadge;
	clazz?: string;
	priority: number;
}

export interface ICompositeBar {
	/**
	 * Unpins a composite from the composite bar.
	 */
	unpin(compositeId: string): void;

	/**
	 * Pin a composite inside the composite bar.
	 */
	pin(compositeId: string): void;

	/**
	 * Find out if a composite is pinned in the composite bar.
	 */
	isPinned(compositeId: string): boolean;

	/**
	 * Reorder composite ordering by moving a composite to the location of another composite.
	 */
	move(compositeId: string, tocompositeId: string): void;
}

export class ToggleCompositePinnedAction extends Action {

	constructor(
		private activity: IActivity | undefined,
		private compositeBar: ICompositeBar
	) {
		super('show.toggleCompositePinned', activity ? activity.name : localize('toggle', "Toggle View Pinned"));

		this.checked = !!this.activity && this.compositeBar.isPinned(this.activity.id);
	}

	override async run(context: string): Promise<void> {
		const id = this.activity ? this.activity.id : context;

		if (this.compositeBar.isPinned(id)) {
			this.compositeBar.unpin(id);
		} else {
			this.compositeBar.pin(id);
		}
	}
}

export class ActivityAction extends Action {

	private readonly _onDidChangeActivity = this._register(new Emitter<ActivityAction>());
	readonly onDidChangeActivity = this._onDidChangeActivity.event;

	private readonly _onDidChangeBadge = this._register(new Emitter<ActivityAction>());
	readonly onDidChangeBadge = this._onDidChangeBadge.event;

	private badge: IBadge | undefined;
	private clazz: string | undefined;

	constructor(private _activity: IActivity) {
		super(_activity.id, _activity.name, _activity.cssClass);
	}

	get activity(): IActivity {
		return this._activity;
	}

	set activity(activity: IActivity) {
		this._label = activity.name;
		this._activity = activity;
		this._onDidChangeActivity.fire(this);
	}

	activate(): void {
		if (!this.checked) {
			this._setChecked(true);
		}
	}

	deactivate(): void {
		if (this.checked) {
			this._setChecked(false);
		}
	}

	getBadge(): IBadge | undefined {
		return this.badge;
	}

	getClass(): string | undefined {
		return this.clazz;
	}

	setBadge(badge: IBadge | undefined, clazz?: string): void {
		this.badge = badge;
		this.clazz = clazz;
		this._onDidChangeBadge.fire(this);
	}

	override dispose(): void {
		this._onDidChangeActivity.dispose();
		this._onDidChangeBadge.dispose();

		super.dispose();
	}
}

export interface IActivityHoverOptions {
	position: () => HoverPosition;
}

export interface ICompositeBarColors {
	activeBackgroundColor?: Color;
	inactiveBackgroundColor?: Color;
	activeBorderColor?: Color;
	activeBackground?: Color;
	activeBorderBottomColor?: Color;
	activeForegroundColor?: Color;
	inactiveForegroundColor?: Color;
	badgeBackground?: Color;
	badgeForeground?: Color;
	dragAndDropBorder?: Color;
}

export interface IActivityActionViewItemOptions extends IBaseActionViewItemOptions {
	icon?: boolean;
	colors: (theme: IColorTheme) => ICompositeBarColors;
	hoverOptions: IActivityHoverOptions;
	hasPopup?: boolean;
}

export class ActivityActionViewItem extends BaseActionViewItem {

	protected container!: HTMLElement;
	protected label!: HTMLElement;
	protected badge!: HTMLElement;
	protected override readonly options: IActivityActionViewItemOptions;

	private badgeContent: HTMLElement | undefined;
	private readonly badgeDisposable = this._register(new MutableDisposable());
	private mouseUpTimeout: any;

	private readonly hoverDisposables = this._register(new DisposableStore());
	private lastHover: IHoverWidget | undefined;
	private readonly showHoverScheduler = new RunOnceScheduler(() => this.showHover(), 0);

	private static _hoverLeaveTime = 0;

	constructor(
		action: ActivityAction,
		options: IActivityActionViewItemOptions,
		@IThemeService protected readonly themeService: IThemeService,
		@IHoverService private readonly hoverService: IHoverService,
	) {
		super(null, action, options);

		this.options = options;

		this._register(this.themeService.onDidColorThemeChange(this.onThemeChange, this));
		this._register(action.onDidChangeActivity(this.updateActivity, this));
	}

	protected get activity(): IActivity {
		return (this._action as ActivityAction).activity;
	}

	protected updateStyles(): void {
		const theme = this.themeService.getColorTheme();
		const colors = this.options.colors(theme);

		if (this.label) {
			if (this.options.icon) {
				const foreground = this._action.checked ? colors.activeForegroundColor : colors.inactiveForegroundColor;
				if (this.activity.iconUrl) {
					// Apply background color to activity bar item provided with iconUrls
					this.label.style.backgroundColor = foreground ? foreground.toString() : '';
					this.label.style.color = '';
				} else {
					// Apply foreground color to activity bar items provided with codicons
					this.label.style.color = foreground ? foreground.toString() : '';
					this.label.style.backgroundColor = '';
				}
			} else {
				const foreground = this._action.checked ? colors.activeForegroundColor : colors.inactiveForegroundColor;
				const borderBottomColor = this._action.checked ? colors.activeBorderBottomColor : null;
				this.label.style.color = foreground ? foreground.toString() : '';
				this.label.style.borderBottomColor = borderBottomColor ? borderBottomColor.toString() : '';
			}

			this.container.style.setProperty('--insert-border-color', colors.dragAndDropBorder ? colors.dragAndDropBorder.toString() : '');
		}

		// Badge
		if (this.badgeContent) {
			const badgeForeground = colors.badgeForeground;
			const badgeBackground = colors.badgeBackground;
			const contrastBorderColor = theme.getColor(contrastBorder);

			this.badgeContent.style.color = badgeForeground ? badgeForeground.toString() : '';
			this.badgeContent.style.backgroundColor = badgeBackground ? badgeBackground.toString() : '';

			this.badgeContent.style.borderStyle = contrastBorderColor ? 'solid' : '';
			this.badgeContent.style.borderWidth = contrastBorderColor ? '1px' : '';
			this.badgeContent.style.borderColor = contrastBorderColor ? contrastBorderColor.toString() : '';
		}
	}

	override render(container: HTMLElement): void {
		super.render(container);

		this.container = container;
		if (this.options.icon) {
			this.container.classList.add('icon');
		}

		if (this.options.hasPopup) {
			this.container.setAttribute('role', 'button');
			this.container.setAttribute('aria-haspopup', 'true');
		} else {
			this.container.setAttribute('role', 'tab');
		}

		// Try hard to prevent keyboard only focus feedback when using mouse
		this._register(addDisposableListener(this.container, EventType.MOUSE_DOWN, () => {
			this.container.classList.add('clicked');
		}));

		this._register(addDisposableListener(this.container, EventType.MOUSE_UP, () => {
			if (this.mouseUpTimeout) {
				clearTimeout(this.mouseUpTimeout);
			}

			this.mouseUpTimeout = setTimeout(() => {
				this.container.classList.remove('clicked');
			}, 800); // delayed to prevent focus feedback from showing on mouse up
		}));

		// Label
		this.label = append(container, $('a'));

		// Badge
		this.badge = append(container, $('.badge'));
		this.badgeContent = append(this.badge, $('.badge-content'));

		// pane composite bar active border + background
		append(container, $('.active-item-indicator'));

		hide(this.badge);

		this.updateActivity();
		this.updateStyles();
		this.updateHover();
	}

	private onThemeChange(theme: IColorTheme): void {
		this.updateStyles();
	}

	protected updateActivity(): void {
		this.updateLabel();
		this.updateTitle();
		this.updateBadge();
		this.updateStyles();
	}

	protected updateBadge(): void {
		const action = this.getAction();
		if (!this.badge || !this.badgeContent || !(action instanceof ActivityAction)) {
			return;
		}

		const badge = action.getBadge();
		const clazz = action.getClass();

		this.badgeDisposable.clear();

		clearNode(this.badgeContent);
		hide(this.badge);

		if (badge) {

			// Number
			if (badge instanceof NumberBadge) {
				if (badge.number) {
					let number = badge.number.toString();
					if (badge.number > 999) {
						const noOfThousands = badge.number / 1000;
						const floor = Math.floor(noOfThousands);
						if (noOfThousands > floor) {
							number = `${floor}K+`;
						} else {
							number = `${noOfThousands}K`;
						}
					}
					this.badgeContent.textContent = number;
					show(this.badge);
				}
			}

			// Text
			else if (badge instanceof TextBadge) {
				this.badgeContent.textContent = badge.text;
				show(this.badge);
			}

			// Icon
			else if (badge instanceof IconBadge) {
				const clazzList = ThemeIcon.asClassNameArray(badge.icon);
				this.badgeContent.classList.add(...clazzList);
				show(this.badge);
			}

			// Progress
			else if (badge instanceof ProgressBadge) {
				show(this.badge);
			}

			if (clazz) {
				const classNames = clazz.split(' ');
				this.badge.classList.add(...classNames);
				this.badgeDisposable.value = toDisposable(() => this.badge.classList.remove(...classNames));
			}
		}

		this.updateTitle();
	}

	protected override updateLabel(): void {
		this.label.className = 'action-label';

		if (this.activity.cssClass) {
			this.label.classList.add(...this.activity.cssClass.split(' '));
		}

		if (this.options.icon && !this.activity.iconUrl) {
			// Only apply codicon class to activity bar icon items without iconUrl
			this.label.classList.add('codicon');
		}

		if (!this.options.icon) {
			this.label.textContent = this.getAction().label;
		}
	}

	private updateTitle(): void {
		// Title
		const title = this.computeTitle();
		[this.label, this.badge, this.container].forEach(element => {
			if (element) {
				element.setAttribute('aria-label', title);
				element.setAttribute('title', '');
				element.removeAttribute('title');
			}
		});
	}

	private computeTitle(): string {
		let title = this.activity.name;
		const badge = (this.getAction() as ActivityAction).getBadge();
		if (badge?.getDescription()) {
			title = localize('badgeTitle', "{0} - {1}", title, badge.getDescription());
		}
		return title;
	}

	private updateHover(): void {
		this.hoverDisposables.clear();

		this.updateTitle();
		this.hoverDisposables.add(addDisposableListener(this.container, EventType.MOUSE_OVER, () => {
			if (!this.showHoverScheduler.isScheduled()) {
				if (Date.now() - ActivityActionViewItem._hoverLeaveTime < 200) {
					this.showHover(true);
				} else {
					this.showHoverScheduler.schedule(400);
				}
			}
		}, true));
		this.hoverDisposables.add(addDisposableListener(this.container, EventType.MOUSE_LEAVE, () => {
			ActivityActionViewItem._hoverLeaveTime = Date.now();
			this.hoverService.hideHover();
			this.showHoverScheduler.cancel();
		}, true));
		this.hoverDisposables.add(toDisposable(() => {
			this.hoverService.hideHover();
			this.showHoverScheduler.cancel();
		}));
	}

	private showHover(skipFadeInAnimation: boolean = false): void {
		if (this.lastHover && !this.lastHover.isDisposed) {
			return;
		}
		const hoverPosition = this.options.hoverOptions!.position();
		this.lastHover = this.hoverService.showHover({
			target: this.container,
			hoverPosition,
			content: this.computeTitle(),
			showPointer: true,
			compact: true,
			hideOnKeyDown: true,
			skipFadeInAnimation,
		});
	}

	override dispose(): void {
		super.dispose();

		if (this.mouseUpTimeout) {
			clearTimeout(this.mouseUpTimeout);
		}

		this.badge.remove();
	}
}


export class CompositeOverflowActivityAction extends ActivityAction {

	constructor(
		private showMenu: () => void
	) {
		super({
			id: 'additionalComposites.action',
			name: localize('additionalViews', "Additional Views"),
			cssClass: Codicon.more.classNames
		});
	}

	override async run(): Promise<void> {
		this.showMenu();
	}
}

export class CompositeOverflowActivityActionViewItem extends ActivityActionViewItem {

}

class ManageExtensionAction extends Action {

	constructor(
		@ICommandService private readonly commandService: ICommandService
	) {
		super('activitybar.manage.extension', localize('manageExtension', "Manage Extension"));
	}

	override run(id: string): Promise<void> {
		return this.commandService.executeCommand('_extensions.manage', id);
	}
}

export class CompositeActionViewItem extends ActivityActionViewItem {

	constructor(
		options: IActivityActionViewItemOptions,
		private readonly compositeActivityAction: ActivityAction,
		private readonly toggleCompositePinnedAction: IAction,
		//private readonly compositeContextMenuActionsProvider: (compositeId: string) => IAction[],
		//private readonly contextMenuActionsProvider: () => IAction[],
		private readonly compositeBar: ICompositeBar,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
	) {
		super(compositeActivityAction, options, themeService, hoverService);
	}

	override render(container: HTMLElement): void {
		super.render(container);

		this.updateChecked();
		this.updateEnabled();
	}

	protected override updateChecked(): void {
		if (this.getAction().checked) {
			this.container.classList.add('checked');
			this.container.setAttribute('aria-label', this.container.title);
			this.container.setAttribute('aria-expanded', 'true');
			this.container.setAttribute('aria-selected', 'true');
		} else {
			this.container.classList.remove('checked');
			this.container.setAttribute('aria-label', this.container.title);
			this.container.setAttribute('aria-expanded', 'false');
			this.container.setAttribute('aria-selected', 'false');
		}
		this.updateStyles();
	}
}

