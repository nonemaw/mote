import 'vs/css!./workbench.common.main';
//#region --- workbench parts

import 'mote/workbench/browser/parts/editor/editorPart';
import 'mote/workbench/browser/parts/paneCompositePart';
import 'mote/workbench/browser/parts/views/viewsService';

//#endregion

//#region --- workbench contributions

// Explorer
import 'mote/workbench/contrib/pages/browser/explorerViewlet';
import 'mote/workbench/contrib/pages/browser/pages.contribution';

// DocumentEditor
import 'mote/workbench/contrib/documentEditor/browser/documentEditor.contribution';

import 'mote/workbench/contrib/login/browser/login.contribution';

//#endregion

//#region --- workbench services

import 'mote/workbench/services/hover/browser/hoverService';
import 'mote/workbench/services/commands/common/commandService';
import 'mote/workbench/services/editor/browser/editorService';
import 'mote/workbench/services/quickmenu/browser/quickmenuService';
import 'mote/workbench/services/views/browser/viewDescriptorService';
import 'mote/workbench/services/user/common/userService';
import 'mote/workbench/services/remote/browser/remoteService';

//#endregion


import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IContextViewService } from 'mote/platform/contextview/browser/contextView';
import { ContextViewService } from 'mote/platform/contextview/browser/contextViewService';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { BrowserThemeService } from 'mote/platform/theme/browser/browserThemeService';
import { IHostColorSchemeService } from 'mote/platform/theme/common/hostColorSchemeService';
import { BrowserHostColorSchemeService } from 'mote/platform/theme/browser/browserHostColorSchemeService';


registerSingleton(IContextViewService, ContextViewService, true);
registerSingleton(IThemeService, BrowserThemeService);
registerSingleton(IHostColorSchemeService, BrowserHostColorSchemeService);

