import { IThemeService } from 'mote/platform/theme/common/themeService';
import { ViewPaneContainer } from 'mote/workbench/browser/parts/views/viewPaneContainer';
import { Extensions, IViewContainersRegistry, IViewDescriptor, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from "mote/workbench/common/views";
import { IWorkbenchLayoutService } from 'mote/workbench/services/layout/browser/layoutService';

import { localize } from 'vs/nls';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { Registry } from 'vs/platform/registry/common/platform';
import { FILES_VIEWLET_ID } from '../common/files';
import { Disposable } from 'vs/base/common/lifecycle';
import { IWorkbenchContribution } from 'mote/workbench/common/contributions';
import { EmptyView } from './views/emptyView';
import { ExplorerView } from './views/explorerView';
import { IWorkspaceContextService } from 'mote/platform/workspace/common/workspace';
import { IContextViewService } from 'mote/platform/contextview/browser/contextView';
import { WorkspacesController } from 'mote/workbench/contrib/pages/browser/views/workspacesController';
import { registerIcon } from 'mote/platform/theme/common/iconRegistry';
import { Codicon } from 'vs/base/common/codicons';

const explorerViewIcon = registerIcon('explorer-view-icon', Codicon.files, localize('explorerViewIcon', 'View icon of the explorer view.'));


const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(Extensions.ViewContainersRegistry);

export class ExplorerViewPaneContainer extends ViewPaneContainer {

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ILogService logService: ILogService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
	) {
		super(FILES_VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }, layoutService, logService, instantiationService, themeService, viewDescriptorService);

	}

	override create(parent: HTMLElement): void {
		super.create(parent);
		parent.classList.add('explorer-viewlet');
	}

	override renderHeader(parent: HTMLElement) {
		new WorkspacesController(parent, this.themeService, this.contextViewService, this.contextService, this.instantiationService);
		return true;
	}
}

export class ExplorerViewletViewsContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super();
		this.registerView();
		this._register(workspaceContextService.onDidChangeWorkspace(() => this.registerView()));
	}

	private registerView() {

		const viewDescriptors = viewsRegistry.getViews(EXPLORER_VIEW_CONTAINER);

		const viewDescriptorsToRegister: IViewDescriptor[] = [];
		const viewDescriptorsToDeregister: IViewDescriptor[] = [];

		const explorerViewDescriptor = this.createExplorerViewDescriptor();
		const registeredExplorerViewDescriptor = viewDescriptors.find(v => v.id === explorerViewDescriptor.id);
		const emptyViewDescriptor = this.createEmptyViewDescriptor();
		const registeredEmptyViewDescriptor = viewDescriptors.find(v => v.id === emptyViewDescriptor.id);

		if (this.workspaceContextService.getSpaceStores().length === 0) {
			if (registeredExplorerViewDescriptor) {
				viewDescriptorsToDeregister.push(registeredExplorerViewDescriptor);
			}
			if (!registeredEmptyViewDescriptor) {
				viewDescriptorsToRegister.push(emptyViewDescriptor);
			}
		} else {
			if (registeredEmptyViewDescriptor) {
				viewDescriptorsToDeregister.push(registeredEmptyViewDescriptor);
			}
			if (!registeredExplorerViewDescriptor) {
				viewDescriptorsToRegister.push(explorerViewDescriptor);
			}
		}


		if (viewDescriptorsToRegister.length) {
			viewsRegistry.registerViews(viewDescriptorsToRegister, EXPLORER_VIEW_CONTAINER);
		}
		if (viewDescriptorsToDeregister.length) {
			viewsRegistry.deregisterViews(viewDescriptorsToDeregister, EXPLORER_VIEW_CONTAINER);
		}
	}

	private createEmptyViewDescriptor(): IViewDescriptor {
		return {
			id: EmptyView.ID,
			name: EmptyView.NAME,
			//containerIcon: explorerViewIcon,
			ctorDescriptor: new SyncDescriptor(EmptyView),
			order: 1,
			canToggleVisibility: true,
		};
	}

	private createExplorerViewDescriptor(): IViewDescriptor {
		return {
			id: ExplorerView.ID,
			name: localize('folders', "Folders"),
			//containerIcon: explorerViewIcon,
			ctorDescriptor: new SyncDescriptor(ExplorerView),
			order: 1,
			canToggleVisibility: false,
		};
	}
}



/**
 * Explorer viewlet container.
 */
export const EXPLORER_VIEW_CONTAINER: ViewContainer = viewContainerRegistry.registerViewContainer({
	id: FILES_VIEWLET_ID,
	title: localize('workspace', "Workspace"),
	icon: explorerViewIcon,
	ctorDescriptor: new SyncDescriptor(ExplorerViewPaneContainer),
}, ViewContainerLocation.Sidebar, { isDefault: true });
