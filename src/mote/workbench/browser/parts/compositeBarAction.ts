import { IActivity } from 'mote/workbench/common/activity';
import { IBadge } from 'mote/workbench/services/activity/common/activity';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';

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


