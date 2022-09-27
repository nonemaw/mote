import * as nls from 'vs/nls';
import * as Paths from 'vs/base/common/path';
import { ExtensionData, IThemeExtensionPoint, IWorkbenchProductIconTheme } from 'mote/workbench/services/themes/common/workbenchThemeService';
import { URI } from 'vs/base/common/uri';
import { getIconRegistry, IconContribution, IconDefinition } from 'mote/platform/theme/common/iconRegistry';
import { ThemeIcon } from 'mote/platform/theme/common/themeService';
import { DEFAULT_PRODUCT_ICON_THEME_SETTING_VALUE } from 'mote/workbench/services/themes/common/themeConfiguration';

export const DEFAULT_PRODUCT_ICON_THEME_ID = ''; // TODO

interface ProductIconThemeDocument {
	iconDefinitions: Map<string, IconDefinition>;
}

export class ProductIconThemeData implements IWorkbenchProductIconTheme {

	static readonly STORAGE_KEY = 'productIconThemeData';

	description?: string;
	isLoaded: boolean;
	location?: URI;
	extensionData?: ExtensionData;
	watch?: boolean;

	iconThemeDocument: ProductIconThemeDocument = { iconDefinitions: new Map() };
	styleSheetContent?: string;

	private constructor(public id: string, public label: string, public settingsId: string) {
		this.isLoaded = false;
	}

	public getIcon(iconContribution: IconContribution): IconDefinition | undefined {
		return _resolveIconDefinition(iconContribution, this.iconThemeDocument);
	}

	static fromExtensionTheme(iconTheme: IThemeExtensionPoint, iconThemeLocation: URI, extensionData: ExtensionData): ProductIconThemeData {
		const id = extensionData.extensionId + '-' + iconTheme.id;
		const label = iconTheme.label || Paths.basename(iconTheme.path);
		const settingsId = iconTheme.id;

		const themeData = new ProductIconThemeData(id, label, settingsId);

		themeData.description = iconTheme.description;
		themeData.location = iconThemeLocation;
		themeData.extensionData = extensionData;
		themeData.watch = iconTheme._watch;
		themeData.isLoaded = false;
		return themeData;
	}

	static createUnloadedTheme(id: string): ProductIconThemeData {
		const themeData = new ProductIconThemeData(id, '', '__' + id);
		themeData.isLoaded = false;
		themeData.extensionData = undefined;
		themeData.watch = false;
		return themeData;
	}

	private static _defaultProductIconTheme: ProductIconThemeData | null = null;

	static get defaultTheme(): ProductIconThemeData {
		let themeData = ProductIconThemeData._defaultProductIconTheme;
		if (!themeData) {
			themeData = ProductIconThemeData._defaultProductIconTheme = new ProductIconThemeData(DEFAULT_PRODUCT_ICON_THEME_ID, nls.localize('defaultTheme', 'Default'), DEFAULT_PRODUCT_ICON_THEME_SETTING_VALUE);
			themeData.isLoaded = true;
			themeData.extensionData = undefined;
			themeData.watch = false;
		}
		return themeData;
	}
}

const iconRegistry = getIconRegistry();

function _resolveIconDefinition(iconContribution: IconContribution, iconThemeDocument: ProductIconThemeDocument): IconDefinition | undefined {
	const iconDefinitions = iconThemeDocument.iconDefinitions;
	let definition: IconDefinition | undefined = iconDefinitions.get(iconContribution.id);
	let defaults = iconContribution.defaults;
	while (!definition && ThemeIcon.isThemeIcon(defaults)) {
		// look if an inherited icon has a definition
		const ic = iconRegistry.getIcon(defaults.id);
		if (ic) {
			definition = iconDefinitions.get(ic.id);
			defaults = ic.defaults;
		} else {
			return undefined;
		}
	}
	if (definition) {
		return definition;
	}
	if (!ThemeIcon.isThemeIcon(defaults)) {
		return defaults;
	}
	return undefined;
}
