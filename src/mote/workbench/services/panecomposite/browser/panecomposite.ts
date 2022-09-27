import { PaneCompositeDescriptor } from "mote/workbench/browser/panecomposite";
import { IPaneComposite } from "mote/workbench/common/panecomposite";
import { ViewContainerLocation } from "mote/workbench/common/views";
import { createDecorator } from "vs/platform/instantiation/common/instantiation";

export const IPaneCompositePartService = createDecorator<IPaneCompositePartService>('paneCompositePartService');


export interface IPaneCompositePartService {

	readonly _serviceBrand: undefined;

	/**
	 * Opens a viewlet with the given identifier and pass keyboard focus to it if specified.
	 */
	openPaneComposite(id: string | undefined, viewContainerLocation: ViewContainerLocation, focus?: boolean): Promise<IPaneComposite | undefined>;

	/**
	 * Returns the viewlet by id.
	 */
	getPaneComposite(id: string, viewContainerLocation: ViewContainerLocation): PaneCompositeDescriptor | undefined;

	/**
	 * Returns the current active viewlet if any.
	 */
	getActivePaneComposite(viewContainerLocation: ViewContainerLocation): IPaneComposite | undefined;

	/**
	 * Hide the active viewlet.
	 */
	hideActivePaneComposite(viewContainerLocation: ViewContainerLocation): void;

}
