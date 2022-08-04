import { IThemeService } from 'mote/platform/theme/common/themeService';
import { Part } from 'mote/workbench/browser/part';
import { IPaneCompositePart, IPaneCompositeSelectorPart } from 'mote/workbench/browser/parts/paneCompositePart';
import { IBadge } from 'mote/workbench/services/activity/common/activity';
import { IWorkbenchLayoutService, Parts } from 'mote/workbench/services/layout/browser/layoutService';
import { IDisposable } from 'vs/workbench/workbench.web.main';

export class ActivitybarPart extends Part implements IPaneCompositeSelectorPart {


	declare readonly _serviceBrand: undefined;

	//#region IView

	readonly minimumWidth: number = 48;
	readonly maximumWidth: number = 48;
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;

	//#endregion

	constructor(
		private readonly paneCompositePart: IPaneCompositePart,
		@IThemeService themeService: IThemeService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
	) {
		super(Parts.ACTIVITYBAR_PART, { hasTitle: false }, themeService, layoutService);
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

	toJSON(): object {
		return {
			type: Parts.ACTIVITYBAR_PART
		};
	}
}
