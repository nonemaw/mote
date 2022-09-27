import { IWorkbenchColorTheme, ThemeSettingTarget } from 'mote/workbench/services/themes/common/workbenchThemeService';

export const DEFAULT_PRODUCT_ICON_THEME_SETTING_VALUE = 'Default';

export class ThemeConfiguration {

	public get colorTheme(): string {
		return '';
	}

	public async setColorTheme(theme: IWorkbenchColorTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchColorTheme> {
		//await this.writeConfiguration(ThemeSettings.COLOR_THEME, theme.settingsId, settingsTarget);
		return theme;
	}

	public get productIconTheme(): string {
		return '';
	}

	public isDefaultColorTheme(): boolean {
		return true;
	}
}
