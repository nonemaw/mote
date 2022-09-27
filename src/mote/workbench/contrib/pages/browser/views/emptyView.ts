import { IntlProvider } from 'mote/base/common/i18n';
import { IContextMenuService } from 'mote/platform/contextview/browser/contextView';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { IViewPaneOptions, ViewPane } from "mote/workbench/browser/parts/views/viewPane";
import { Extensions, IViewsRegistry } from "mote/workbench/common/views";
import { ILogService } from "vs/platform/log/common/log";
import { Registry } from "vs/platform/registry/common/platform";

const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);

export class EmptyView extends ViewPane {

	static readonly ID: string = 'workbench.explorer.emptyView';
	static readonly NAME = IntlProvider.INSTANCE.formatMessage({ id: 'noWorkspace', defaultMessage: 'No Workspace Opened' });

	constructor(
		options: IViewPaneOptions,
		@ILogService logService: ILogService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
	) {
		super(options, logService, contextMenuService, themeService);
		this.logService.debug('[EmptyView] created');
	}

	override shouldShowWelcome(): boolean {
		return true;
	}

}

viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
	content: IntlProvider.INSTANCE.formatMessage({ id: 'noWorkspaceHelp', defaultMessage: 'You have not yet opened a workspace' })
});
