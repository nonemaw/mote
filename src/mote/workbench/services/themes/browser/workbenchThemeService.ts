import * as nls from 'vs/nls';
import * as types from 'vs/base/common/types';
import { Emitter, Event } from 'vs/base/common/event';
import { IColorTheme, IThemingRegistry, ThemeExtensions } from 'mote/platform/theme/common/themeService';
import { IWorkbenchColorTheme, IWorkbenchProductIconTheme, IWorkbenchThemeService, MOTE_DARK_THEME, MOTE_HC_DARK_THEME, MOTE_HC_LIGHT_THEME, MOTE_LIGHT_THEME, ThemeSettingTarget } from 'mote/workbench/services/themes/common/workbenchThemeService';
import { registerColorThemeExtensionPoint, registerProductIconThemeExtensionPoint, ThemeRegistry } from 'mote/workbench/services/themes/common/themeExstensionPoints';
import { ColorThemeData } from 'mote/workbench/services/themes/common/colorThemeData';
import { ProductIconThemeData } from 'mote/workbench/services/themes/browser/productIconThemeData';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { registerColorThemeSchemas } from 'mote/workbench/services/themes/common/colorThemeSchema';
import { ColorScheme } from 'mote/platform/theme/common/theme';
import { ThemeConfiguration } from 'mote/workbench/services/themes/common/themeConfiguration';
import { RunOnceScheduler, Sequencer } from 'vs/base/common/async';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { IHostColorSchemeService } from 'mote/platform/theme/common/hostColorSchemeService';
import { IBrowserWorkbenchEnvironmentService } from 'vs/workbench/services/environment/browser/environmentService';
import { isWeb } from 'vs/base/common/platform';
import { createStyleSheet } from 'vs/base/browser/dom';
import { getIconsStyleSheet } from 'mote/platform/theme/browser/iconsStyleSheet';
import { asCssVariableName, getColorRegistry } from 'mote/platform/theme/common/colorRegistry';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Registry } from 'vs/platform/registry/common/platform';

const DEFAULT_COLOR_THEME_ID = 'mote-dark mote-theme-defaults-themes-dark_plus-json';
const DEFAULT_LIGHT_COLOR_THEME_ID = 'mote mote-theme-defaults-themes-light_plus-json';

const PERSISTED_OS_COLOR_SCHEME = 'osColorScheme';
const PERSISTED_OS_COLOR_SCHEME_SCOPE = StorageScope.APPLICATION; // the OS scheme depends on settings in the OS

const defaultThemeExtensionId = 'mote-theme-defaults';

const colorThemeRulesClassName = 'contributedColorTheme';

const themingRegistry = Registry.as<IThemingRegistry>(ThemeExtensions.ThemingContribution);

function validateThemeId(theme: string): string {
	// migrations
	switch (theme) {
		case MOTE_LIGHT_THEME: return `mote ${defaultThemeExtensionId}-themes-light_mote-json`;
		case MOTE_DARK_THEME: return `mote-dark ${defaultThemeExtensionId}-themes-dark_mote-json`;
		case MOTE_HC_DARK_THEME: return `mote-hc-black ${defaultThemeExtensionId}-themes-hc_black-json`;
		case MOTE_HC_LIGHT_THEME: return `mote-hc-light ${defaultThemeExtensionId}-themes-hc_light-json`;
	}
	return theme;
}

const colorThemesExtPoint = registerColorThemeExtensionPoint();
const productIconThemesExtPoint = registerProductIconThemeExtensionPoint();

export class WorkbenchThemeService implements IWorkbenchThemeService {
	_serviceBrand: undefined;

	private settings: ThemeConfiguration;

	private readonly colorThemeRegistry: ThemeRegistry<ColorThemeData>;
	private currentColorTheme: ColorThemeData;
	private readonly onColorThemeChange: Emitter<IWorkbenchColorTheme>;
	private readonly colorThemeSequencer: Sequencer;
	private colorThemingParticipantChangeListener: IDisposable | undefined;

	private readonly productIconThemeRegistry: ThemeRegistry<ProductIconThemeData>;
	private currentProductIconTheme: ProductIconThemeData;
	private readonly onProductIconThemeChange: Emitter<IWorkbenchProductIconTheme>;

	constructor(
		@IBrowserWorkbenchEnvironmentService readonly environmentService: IBrowserWorkbenchEnvironmentService,
		@IHostColorSchemeService private readonly hostColorService: IHostColorSchemeService,
		@IStorageService private readonly storageService: IStorageService,
	) {

		this.settings = new ThemeConfiguration();

		this.colorThemeRegistry = new ThemeRegistry(colorThemesExtPoint, ColorThemeData.fromExtensionTheme);
		this.onColorThemeChange = new Emitter<IWorkbenchColorTheme>({ leakWarningThreshold: 400 });
		this.currentColorTheme = ColorThemeData.createUnloadedTheme('');
		this.colorThemeSequencer = new Sequencer();

		this.productIconThemeRegistry = new ThemeRegistry(productIconThemesExtPoint, ProductIconThemeData.fromExtensionTheme, true, ProductIconThemeData.defaultTheme);
		this.onProductIconThemeChange = new Emitter<IWorkbenchProductIconTheme>();
		this.currentProductIconTheme = ProductIconThemeData.createUnloadedTheme('');

		// In order to avoid paint flashing for tokens, because
		// themes are loaded asynchronously, we need to initialize
		// a color theme document with good defaults until the theme is loaded
		let themeData: ColorThemeData | undefined = ColorThemeData.fromStorageData(this.storageService);
		if (themeData && this.settings.colorTheme !== themeData.settingsId && this.settings.isDefaultColorTheme()) {
			// the web has different defaults than the desktop, therefore do not restore when the setting is the default theme and the storage doesn't match that.
			themeData = undefined;
		}

		// the preferred color scheme (high contrast, light, dark) has changed since the last start
		const preferredColorScheme = this.getPreferredColorScheme();

		if (preferredColorScheme && themeData?.type !== preferredColorScheme && this.storageService.get(PERSISTED_OS_COLOR_SCHEME, PERSISTED_OS_COLOR_SCHEME_SCOPE) !== preferredColorScheme) {
			themeData = ColorThemeData.createUnloadedThemeForThemeType(preferredColorScheme);
		}
		if (!themeData) {
			const initialColorTheme = environmentService.options?.initialColorTheme;
			if (initialColorTheme) {
				themeData = ColorThemeData.createUnloadedThemeForThemeType(initialColorTheme.themeType, initialColorTheme.colors);
			}
		}
		if (!themeData) {
			themeData = ColorThemeData.createUnloadedThemeForThemeType(isWeb ? ColorScheme.LIGHT : ColorScheme.DARK);
		}
		themeData.setCustomizations(this.settings);
		this.applyTheme(themeData, undefined, true);

		this.initialize();

		const codiconStyleSheet = createStyleSheet();
		codiconStyleSheet.id = 'codiconStyles';

		const iconsStyleSheet = getIconsStyleSheet(this);
		function updateAll() {
			codiconStyleSheet.textContent = iconsStyleSheet.getCSS();
		}

		const delayer = new RunOnceScheduler(updateAll, 0);
		iconsStyleSheet.onDidChange(() => delayer.schedule());
		delayer.schedule();
	}

	private initialize(): Promise<[IWorkbenchColorTheme | null]> {
		const initializeColorTheme = async () => {

			const fallbackTheme = this.currentColorTheme.type === ColorScheme.LIGHT ? DEFAULT_LIGHT_COLOR_THEME_ID : DEFAULT_COLOR_THEME_ID;
			const theme = this.colorThemeRegistry.findThemeBySettingsId(this.settings.colorTheme, fallbackTheme);

			return this.setColorTheme(theme && theme.id, undefined);
		};

		return Promise.all([initializeColorTheme()]);
	}

	private getPreferredColorScheme(): ColorScheme | undefined {
		return this.hostColorService.dark ? ColorScheme.DARK : ColorScheme.LIGHT;
	}

	getColorTheme(): IColorTheme {
		return this.currentColorTheme;
	}

	public async getColorThemes(): Promise<IWorkbenchColorTheme[]> {
		return this.colorThemeRegistry.getThemes();
	}

	public get onDidColorThemeChange(): Event<IWorkbenchColorTheme> {
		return this.onColorThemeChange.event;
	}

	public setColorTheme(themeIdOrTheme: string | undefined | IWorkbenchColorTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchColorTheme | null> {
		return this.colorThemeSequencer.queue(async () => {
			return this.internalSetColorTheme(themeIdOrTheme, settingsTarget);
		});
	}

	private async internalSetColorTheme(themeIdOrTheme: string | undefined | IWorkbenchColorTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchColorTheme | null> {
		if (!themeIdOrTheme) {
			return null;
		}
		const themeId = types.isString(themeIdOrTheme) ? validateThemeId(themeIdOrTheme) : themeIdOrTheme.id;
		if (this.currentColorTheme.isLoaded && themeId === this.currentColorTheme.id) {
			if (settingsTarget !== 'preview') {
				this.currentColorTheme.toStorage(this.storageService);
			}
			return this.settings.setColorTheme(this.currentColorTheme, settingsTarget);
		}

		let themeData = this.colorThemeRegistry.findThemeById(themeId);
		if (!themeData) {
			if (themeIdOrTheme instanceof ColorThemeData) {
				themeData = themeIdOrTheme;
			} else {
				return null;
			}
		}
		try {
			//await themeData.ensureLoaded(this.extensionResourceLoaderService);
			//themeData.setCustomizations(this.settings);
			return this.applyTheme(themeData, settingsTarget);
		} catch (error) {
			throw new Error(nls.localize('error.cannotloadtheme', "Unable to load {0}: {1}", themeData.location?.toString(), error.message));
		}

	}

	private updateDynamicCSSRules(themeData: IColorTheme) {
		const cssRules = new Set<string>();
		const ruleCollector = {
			addRule: (rule: string) => {
				if (!cssRules.has(rule)) {
					cssRules.add(rule);
				}
			}
		};
		ruleCollector.addRule(`.workbench { forced-color-adjust: none; }`);
		themingRegistry.getThemingParticipants().forEach(p => p(themeData, ruleCollector, this.environmentService));

		const colorVariables: string[] = [];
		for (const item of getColorRegistry().getColors()) {
			const color = themeData.getColor(item.id, true);
			if (color) {
				colorVariables.push(`${asCssVariableName(item.id)}: ${color.toString()};`);
			}
		}
		ruleCollector.addRule(`.workbench { ${colorVariables.join('\n')} }`);

		_applyRules([...cssRules].join('\n'), colorThemeRulesClassName);
	}

	private applyTheme(newTheme: ColorThemeData, settingsTarget: ThemeSettingTarget, silent = false): Promise<IWorkbenchColorTheme | null> {
		this.updateDynamicCSSRules(newTheme);

		this.currentColorTheme.clearCaches();
		this.currentColorTheme = newTheme;
		if (!this.colorThemingParticipantChangeListener) {
			this.colorThemingParticipantChangeListener = themingRegistry.onThemingParticipantAdded(_ => this.updateDynamicCSSRules(this.currentColorTheme));
		}

		if (silent) {
			return Promise.resolve(null);
		}

		this.onColorThemeChange.fire(this.currentColorTheme);

		return this.settings.setColorTheme(this.currentColorTheme, settingsTarget);
	}

	public async getProductIconThemes(): Promise<IWorkbenchProductIconTheme[]> {
		return this.productIconThemeRegistry.getThemes();
	}

	public getProductIconTheme() {
		return this.currentProductIconTheme;
	}

	public get onDidProductIconThemeChange(): Event<IWorkbenchProductIconTheme> {
		return this.onProductIconThemeChange.event;
	}
}

function _applyRules(styleSheetContent: string, rulesClassName: string) {
	const themeStyles = document.head.getElementsByClassName(rulesClassName);
	if (themeStyles.length === 0) {
		const elStyle = document.createElement('style');
		elStyle.type = 'text/css';
		elStyle.className = rulesClassName;
		elStyle.textContent = styleSheetContent;
		document.head.appendChild(elStyle);
	} else {
		(<HTMLStyleElement>themeStyles[0]).textContent = styleSheetContent;
	}
}

registerColorThemeSchemas();

registerSingleton(IWorkbenchThemeService, WorkbenchThemeService);
