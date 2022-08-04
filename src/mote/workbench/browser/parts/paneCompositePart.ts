import { ActivitybarPart } from 'mote/workbench/browser/parts/activitybar/activitybarPart';
import { IPaneComposite } from 'mote/workbench/common/panecomposite';
import { ViewContainerLocation } from 'mote/workbench/common/views';
import { IBadge } from 'mote/workbench/services/activity/common/activity';
import { IPaneCompositePartService } from 'mote/workbench/services/panecomposite/browser/panecomposite';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { assertIsDefined } from 'vs/base/common/types';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { PaneCompositeDescriptor } from 'mote/workbench/browser/panecomposite';
import { SidebarPart } from 'mote/workbench/browser/parts/sidebar/sidebarPart';

export interface IPaneCompositePart {

	/**
	 * Opens a viewlet with the given identifier and pass keyboard focus to it if specified.
	 */
	openPaneComposite(id: string | undefined, focus?: boolean): Promise<IPaneComposite | undefined>;

	/**
	 * Returns the current active viewlet if any.
	 */
	getActivePaneComposite(): IPaneComposite | undefined;

	/**
	 * Returns the viewlet by id.
	 */
	getPaneComposite(id: string): PaneCompositeDescriptor | undefined;

	/**
	 * Returns all enabled viewlets
	 */
	getPaneComposites(): PaneCompositeDescriptor[];
}

export interface IPaneCompositeSelectorPart {
	/**
	 * Returns id of pinned view containers following the visual order.
	 */
	getPinnedPaneCompositeIds(): string[];

	/**
	 * Returns id of visible view containers following the visual order.
	 */
	getVisiblePaneCompositeIds(): string[];

	/**
	 * Show an activity in a viewlet.
	 */
	showActivity(id: string, badge: IBadge, clazz?: string, priority?: number): IDisposable;
}

export class PaneCompositeParts extends Disposable implements IPaneCompositePartService {
	declare readonly _serviceBrand: undefined;

	private paneCompositeParts = new Map<ViewContainerLocation, IPaneCompositePart>();
	private paneCompositeSelectorParts = new Map<ViewContainerLocation, IPaneCompositeSelectorPart>();

	constructor(
		@ILogService private logService: ILogService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();

		const sideBarPart = instantiationService.createInstance(SidebarPart);
		const activityBarPart = instantiationService.createInstance(ActivitybarPart, sideBarPart);

		this.paneCompositeParts.set(ViewContainerLocation.Sidebar, sideBarPart);

		this.paneCompositeSelectorParts.set(ViewContainerLocation.Sidebar, activityBarPart);
	}

	openPaneComposite(id: string | undefined, viewContainerLocation: ViewContainerLocation, focus?: boolean): Promise<IPaneComposite | undefined> {
		this.logService.debug(`[PaneCompositeParts]#openPaneComposite <${id}>`);
		return this.getPartByLocation(viewContainerLocation).openPaneComposite(id, focus);
	}

	getPaneComposite(id: string, viewContainerLocation: ViewContainerLocation): PaneCompositeDescriptor | undefined {
		return this.getPartByLocation(viewContainerLocation).getPaneComposite(id);
	}

	private getPartByLocation(viewContainerLocation: ViewContainerLocation): IPaneCompositePart {
		const part = this.paneCompositeParts.get(viewContainerLocation);
		if (!part) {
			console.log("viewContainerLocation", viewContainerLocation);
			console.log("paneCompositeParts", this.paneCompositeParts);
		}
		return assertIsDefined(part);
	}

}

registerSingleton(IPaneCompositePartService, PaneCompositeParts);
