import { localize } from 'vs/nls';

//#region SidebarPart

import { registerColor } from 'mote/platform/theme/common/themeColors';

export const SIDE_BAR_BACKGROUND = registerColor('sideBar.background', {
	dark: '#252526',
	light: '#F7F6F3',
	hcDark: '#000000',
	hcLight: '#FFFFFF'
}, localize('sideBarBackground', "Side bar background color. The side bar is the container for views like explorer and search."));

//#endregion
