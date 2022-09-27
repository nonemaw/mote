import 'vs/css!./media/activityaction';
import { ActivityAction, ICompositeBar, ToggleCompositePinnedAction } from 'mote/workbench/browser/parts/compositeBarAction';
import { IPaneCompositePart } from 'mote/workbench/browser/parts/paneCompositePart';
import { IActivity } from 'mote/workbench/common/activity';
import { IWorkbenchLayoutService, Parts } from 'mote/workbench/services/layout/browser/layoutService';

export class ViewContainerActivityAction extends ActivityAction {

	private static readonly preventDoubleClickDelay = 300;

	private lastRun = 0;

	constructor(
		activity: IActivity,
		private readonly paneCompositePart: IPaneCompositePart,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		//@ITelemetryService private readonly telemetryService: ITelemetryService,
		//@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super(activity);
	}

	updateActivity(activity: IActivity): void {
		this.activity = activity;
	}

	override async run(event: { preserveFocus: boolean }): Promise<void> {
		if (event instanceof MouseEvent && event.button === 2) {
			return; // do not run on right click
		}

		// prevent accident trigger on a doubleclick (to help nervous people)
		const now = Date.now();
		if (now > this.lastRun /* https://github.com/microsoft/vscode/issues/25830 */ && now - this.lastRun < ViewContainerActivityAction.preventDoubleClickDelay) {
			return;
		}
		this.lastRun = now;

		const sideBarVisible = this.layoutService.isVisible(Parts.SIDEBAR_PART);
		const activeViewlet = this.paneCompositePart.getActivePaneComposite();
		const focusBehavior = 'toggle';//this.configurationService.getValue<string>('workbench.activityBar.iconClickBehavior');

		const focus = (event && 'preserveFocus' in event) ? !event.preserveFocus : true;
		if (sideBarVisible && activeViewlet?.getId() === this.activity.id) {
			switch (focusBehavior) {
				case 'focus':
					this.logAction('refocus');
					this.paneCompositePart.openPaneComposite(this.activity.id, focus);
					break;
				case 'toggle':
				default:
					// Hide sidebar if selected viewlet already visible
					this.logAction('hide');
					this.layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
					break;
			}

			return;
		}

		this.logAction('show');
		await this.paneCompositePart.openPaneComposite(this.activity.id, focus);

		return this.activate();
	}

	private logAction(action: string) {

	}
}

export class PlaceHolderViewContainerActivityAction extends ViewContainerActivityAction { }

export class PlaceHolderToggleCompositePinnedAction extends ToggleCompositePinnedAction {

	constructor(id: string, compositeBar: ICompositeBar) {
		super({ id, name: id, cssClass: undefined }, compositeBar);
	}

	setActivity(activity: IActivity): void {
		this.label = activity.name;
	}
}
