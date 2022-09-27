import * as types from 'vs/base/common/types';
import { ColorExtensions, ColorIdentifier, IColorRegistry } from 'mote/platform/theme/common/colorRegistry';
import { ExtensionData, IColorCustomizations, IColorMap, IThemeExtensionPoint, IThemeScopableCustomizations, IThemeScopedCustomizations, IWorkbenchColorTheme, MOTE_HC_DARK_THEME, MOTE_HC_LIGHT_THEME, MOTE_LIGHT_THEME, themeScopeRegex, THEME_SCOPE_CLOSE_PAREN, THEME_SCOPE_OPEN_PAREN, THEME_SCOPE_WILDCARD } from 'mote/workbench/services/themes/common/workbenchThemeService';
import { Color } from 'vs/base/common/color';
import { basename } from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';
import { Registry } from 'vs/platform/registry/common/platform';
import { ColorScheme } from 'mote/platform/theme/common/theme';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { getThemeTypeSelector } from 'mote/platform/theme/common/themeService';
import { ThemeConfiguration } from 'mote/workbench/services/themes/common/themeConfiguration';

const colorRegistry = Registry.as<IColorRegistry>(ColorExtensions.ColorContribution);


export class ColorThemeData implements IWorkbenchColorTheme {

	static readonly STORAGE_KEY = 'colorThemeData';

	description?: string;
	isLoaded: boolean;
	location?: URI; // only set for extension from the registry, not for themes restored from the storage
	watch?: boolean;
	extensionData?: ExtensionData;

	private themeSemanticHighlighting: boolean | undefined;
	private customSemanticHighlighting: boolean | undefined;
	private customSemanticHighlightingDeprecated: boolean | undefined;

	private colorMap: IColorMap = {};
	private customColorMap: IColorMap = {};

	private constructor(public id: string, public label: string, public settingsId: string) {
		this.isLoaded = false;
	}

	get semanticHighlighting(): boolean {
		if (this.customSemanticHighlighting !== undefined) {
			return this.customSemanticHighlighting;
		}
		if (this.customSemanticHighlightingDeprecated !== undefined) {
			return this.customSemanticHighlightingDeprecated;
		}
		return !!this.themeSemanticHighlighting;
	}

	public getColor(colorId: ColorIdentifier, useDefault?: boolean): Color | undefined {
		let color: Color | undefined = this.customColorMap[colorId];
		if (color) {
			return color;
		}
		color = this.colorMap[colorId];
		if (useDefault !== false && types.isUndefined(color)) {
			color = this.getDefault(colorId);
		}
		return color;
	}

	public getDefault(colorId: ColorIdentifier): Color | undefined {
		return colorRegistry.resolveDefaultColor(colorId, this);
	}

	public defines(colorId: ColorIdentifier): boolean {
		return this.customColorMap.hasOwnProperty(colorId) || this.colorMap.hasOwnProperty(colorId);
	}

	public setCustomizations(settings: ThemeConfiguration) {
		//this.setCustomColors(settings.colorCustomizations);
		//this.setCustomTokenColors(settings.tokenColorCustomizations);
		//this.setCustomSemanticTokenColors(settings.semanticTokenColorCustomizations);
	}

	public setCustomColors(colors: IColorCustomizations) {
		this.customColorMap = {};

		this.overwriteCustomColors(colors);

		const themeSpecificColors = this.getThemeSpecificColors(colors) as IColorCustomizations;
		if (types.isObject(themeSpecificColors)) {
			this.overwriteCustomColors(themeSpecificColors);
		}
	}

	private overwriteCustomColors(colors: IColorCustomizations) {
		for (const id in colors) {
			const colorVal = colors[id];
			if (typeof colorVal === 'string') {
				this.customColorMap[id] = Color.fromHex(colorVal);
			}
		}
	}

	public isThemeScope(key: string): boolean {
		return key.charAt(0) === THEME_SCOPE_OPEN_PAREN && key.charAt(key.length - 1) === THEME_SCOPE_CLOSE_PAREN;
	}

	public isThemeScopeMatch(themeId: string): boolean {
		const themeIdFirstChar = themeId.charAt(0);
		const themeIdLastChar = themeId.charAt(themeId.length - 1);
		const themeIdPrefix = themeId.slice(0, -1);
		const themeIdInfix = themeId.slice(1, -1);
		const themeIdSuffix = themeId.slice(1);
		return themeId === this.settingsId
			|| (this.settingsId.includes(themeIdInfix) && themeIdFirstChar === THEME_SCOPE_WILDCARD && themeIdLastChar === THEME_SCOPE_WILDCARD)
			|| (this.settingsId.startsWith(themeIdPrefix) && themeIdLastChar === THEME_SCOPE_WILDCARD)
			|| (this.settingsId.endsWith(themeIdSuffix) && themeIdFirstChar === THEME_SCOPE_WILDCARD);
	}

	public getThemeSpecificColors(colors: IThemeScopableCustomizations): IThemeScopedCustomizations | undefined {
		let themeSpecificColors;
		for (const key in colors) {
			const scopedColors = colors[key];
			if (this.isThemeScope(key) && scopedColors instanceof Object && !types.isArray(scopedColors)) {
				const themeScopeList = key.match(themeScopeRegex) || [];
				for (const themeScope of themeScopeList) {
					const themeId = themeScope.substring(1, themeScope.length - 1);
					if (this.isThemeScopeMatch(themeId)) {
						if (!themeSpecificColors) {
							themeSpecificColors = {} as IThemeScopedCustomizations;
						}
						const scopedThemeSpecificColors = scopedColors as IThemeScopedCustomizations;
						for (const subkey in scopedThemeSpecificColors) {
							const originalColors = themeSpecificColors[subkey];
							const overrideColors = scopedThemeSpecificColors[subkey];
							if (types.isArray(originalColors) && types.isArray(overrideColors)) {
								themeSpecificColors[subkey] = originalColors.concat(overrideColors);
							} else if (overrideColors) {
								themeSpecificColors[subkey] = overrideColors;
							}
						}
					}
				}
			}
		}
		return themeSpecificColors;
	}

	toStorage(storageService: IStorageService) {
		// Todo should we save it in server?
		const colorMapData: { [key: string]: string } = {};
		for (const key in this.colorMap) {
			colorMapData[key] = Color.Format.CSS.formatHexA(this.colorMap[key], true);
		}
		// no need to persist custom colors, they will be taken from the settings
		const value = JSON.stringify({
			id: this.id,
			label: this.label,
			settingsId: this.settingsId,
			//themeTokenColors: this.themeTokenColors.map(tc => ({ settings: tc.settings, scope: tc.scope })), // don't persist names
			//semanticTokenRules: this.semanticTokenRules.map(SemanticTokenRule.toJSONObject),
			extensionData: ExtensionData.toJSONObject(this.extensionData),
			themeSemanticHighlighting: this.themeSemanticHighlighting,
			colorMap: colorMapData,
			watch: this.watch
		});

		// roam persisted color theme colors. Don't enable for icons as they contain references to fonts and images.
		storageService.store(ColorThemeData.STORAGE_KEY, value, StorageScope.PROFILE, StorageTarget.USER);
	}

	public clearCaches() {
	}

	get baseTheme(): string {
		return this.classNames[0];
	}

	get classNames(): string[] {
		return this.id.split(' ');
	}

	get type(): ColorScheme {
		switch (this.baseTheme) {
			case MOTE_LIGHT_THEME: return ColorScheme.LIGHT;
			case MOTE_HC_DARK_THEME: return ColorScheme.HIGH_CONTRAST_DARK;
			case MOTE_HC_LIGHT_THEME: return ColorScheme.HIGH_CONTRAST_LIGHT;
			default: return ColorScheme.DARK;
		}
	}

	static createUnloadedThemeForThemeType(themeType: ColorScheme, colorMap?: { [id: string]: string }): ColorThemeData {
		return ColorThemeData.createUnloadedTheme(getThemeTypeSelector(themeType), colorMap);
	}

	static createUnloadedTheme(id: string, colorMap?: { [id: string]: string }): ColorThemeData {
		const themeData = new ColorThemeData(id, '', '__' + id);
		themeData.isLoaded = false;
		themeData.watch = false;
		if (colorMap) {
			for (const id in colorMap) {
				themeData.colorMap[id] = Color.fromHex(colorMap[id]);
			}
		}
		return themeData;
	}

	static fromStorageData(storageService: IStorageService): ColorThemeData | undefined {
		const input = storageService.get(ColorThemeData.STORAGE_KEY, StorageScope.PROFILE);
		if (!input) {
			return undefined;
		}
		try {
			const data = JSON.parse(input);
			const theme = new ColorThemeData('', '', '');
			for (const key in data) {
				switch (key) {
					case 'colorMap': {
						const colorMapData = data[key];
						for (const id in colorMapData) {
							theme.colorMap[id] = Color.fromHex(colorMapData[id]);
						}
						break;
					}
					case 'themeTokenColors':
					case 'id': case 'label': case 'settingsId': case 'watch': case 'themeSemanticHighlighting':
						(theme as any)[key] = data[key];
						break;
					case 'location':
						// ignore, no longer restore
						break;
					case 'extensionData':
						theme.extensionData = ExtensionData.fromJSONObject(data.extensionData);
						break;
				}
			}
			if (!theme.id || !theme.settingsId) {
				return undefined;
			}
			return theme;
		} catch (e) {
			return undefined;
		}
	}

	static fromExtensionTheme(theme: IThemeExtensionPoint, colorThemeLocation: URI, extensionData: ExtensionData): ColorThemeData {
		const baseTheme: string = theme['uiTheme'] || 'vs-dark';
		const themeSelector = toCSSSelector(extensionData.extensionId, theme.path);
		const id = `${baseTheme} ${themeSelector}`;
		const label = theme.label || basename(theme.path);
		const settingsId = theme.id || label;
		const themeData = new ColorThemeData(id, label, settingsId);
		themeData.description = theme.description;
		themeData.watch = theme._watch === true;
		themeData.location = colorThemeLocation;
		themeData.extensionData = extensionData;
		themeData.isLoaded = false;
		return themeData;
	}
}

function toCSSSelector(extensionId: string, path: string) {
	if (path.startsWith('./')) {
		path = path.substr(2);
	}
	let str = `${extensionId}-${path}`;

	//remove all characters that are not allowed in css
	str = str.replace(/[^_a-zA-Z0-9-]/g, '-');
	if (str.charAt(0).match(/[0-9-]/)) {
		str = '_' + str;
	}
	return str;
}
