import { IColorTheme } from 'mote/platform/theme/common/themeService';
import { Color } from 'vs/base/common/color';
import { Emitter, Event } from 'vs/base/common/event';
import { IJSONSchema, IJSONSchemaMap } from 'vs/base/common/jsonSchema';
import { assertNever } from 'vs/base/common/types';
import { Extensions as JSONExtensions, IJSONContributionRegistry } from 'vs/platform/jsonschemas/common/jsonContributionRegistry';
import { Registry } from 'vs/platform/registry/common/platform';

//  ------ API types


export type ColorIdentifier = string;

export interface ColorContribution {
	readonly id: ColorIdentifier;
	readonly description: string;
	readonly defaults: ColorDefaults | null;
	readonly needsTransparency: boolean;
	readonly deprecationMessage: string | undefined;
}

/**
 * Returns the css variable name for the given color identifier. Dots (`.`) are replaced with hyphens (`-`) and
 * everything is prefixed with `--mote-`.
 *
 * @sample `editorSuggestWidget.background` is `--mote-editorSuggestWidget-background`.
 */
export function asCssVariableName(colorIdent: ColorIdentifier): string {
	return `--mote-${colorIdent.replace(/\./g, '-')}`;
}

export const enum ColorTransformType {
	Darken,
	Lighten,
	Transparent,
	OneOf,
	LessProminent,
	IfDefinedThenElse
}

export type ColorTransform =
	| { op: ColorTransformType.Darken; value: ColorValue; factor: number }
	| { op: ColorTransformType.Lighten; value: ColorValue; factor: number }
	| { op: ColorTransformType.Transparent; value: ColorValue; factor: number }
	| { op: ColorTransformType.OneOf; values: readonly ColorValue[] }
	| { op: ColorTransformType.LessProminent; value: ColorValue; background: ColorValue; factor: number; transparency: number }
	| { op: ColorTransformType.IfDefinedThenElse; if: ColorIdentifier; then: ColorValue; else: ColorValue };

/**
 * A Color Value is either a color literal, a reference to an other color or a derived color
 */
export type ColorValue = Color | string | ColorIdentifier | ColorTransform;


// color registry
export const ColorExtensions = {
	ColorContribution: 'base.contributions.colors'
};

export interface ColorDefaults {
	light: ColorValue | null;
	dark: ColorValue | null;
	hcDark?: ColorValue | null;
	hcLight?: ColorValue | null;
}

export interface IColorRegistry {

	readonly onDidChangeSchema: Event<void>;

	/**
	 * Register a color to the registry.
	 * @param id The color id as used in theme description files
	 * @param defaults The default values
	 * @description the description
	 */
	registerColor(id: string, defaults: ColorDefaults, description: string): ColorIdentifier;

	/**
	 * Register a color to the registry.
	 */
	deregisterColor(id: string): void;

	/**
	 * Get all color contributions
	 */
	getColors(): ColorContribution[];

	/**
	 * Gets the default color of the given id
	 */
	resolveDefaultColor(id: ColorIdentifier, theme: IColorTheme): Color | undefined;

}


class ColorRegistry implements IColorRegistry {

	private readonly _onDidChangeSchema = new Emitter<void>();
	readonly onDidChangeSchema: Event<void> = this._onDidChangeSchema.event;

	private colorsById: { [key: string]: ColorContribution };
	private colorSchema: IJSONSchema & { properties: IJSONSchemaMap } = { type: 'object', properties: {} };
	private colorReferenceSchema: IJSONSchema & { enum: string[]; enumDescriptions: string[] } = { type: 'string', enum: [], enumDescriptions: [] };

	constructor() {
		this.colorsById = {};
	}

	public registerColor(id: string, defaults: ColorDefaults | null, description: string, needsTransparency = false, deprecationMessage?: string): ColorIdentifier {
		const colorContribution: ColorContribution = { id, description, defaults, needsTransparency, deprecationMessage };
		this.colorsById[id] = colorContribution;
		const propertySchema: IJSONSchema = { type: 'string', description, format: 'color-hex', defaultSnippets: [{ body: '${1:#ff0000}' }] };
		if (deprecationMessage) {
			propertySchema.deprecationMessage = deprecationMessage;
		}
		this.colorSchema.properties[id] = propertySchema;
		this.colorReferenceSchema.enum.push(id);
		this.colorReferenceSchema.enumDescriptions.push(description);

		this._onDidChangeSchema.fire();
		return id;
	}


	public deregisterColor(id: string): void {
		delete this.colorsById[id];
		delete this.colorSchema.properties[id];
		const index = this.colorReferenceSchema.enum.indexOf(id);
		if (index !== -1) {
			this.colorReferenceSchema.enum.splice(index, 1);
			this.colorReferenceSchema.enumDescriptions.splice(index, 1);
		}

		this._onDidChangeSchema.fire();
	}

	public getColors(): ColorContribution[] {
		return Object.keys(this.colorsById).map(id => this.colorsById[id]);
	}

	public resolveDefaultColor(id: ColorIdentifier, theme: IColorTheme): Color | undefined {
		const colorDesc = this.colorsById[id];
		if (colorDesc && colorDesc.defaults) {
			const colorValue = colorDesc.defaults[theme.type];
			if (typeof colorValue === 'string' && colorValue.startsWith('rgb')) {
				console.error(`[${id}] value is ${colorValue}, shold use HEX`);
			}
			return resolveColorValue(colorValue, theme);
		}
		return undefined;
	}

	public getColorSchema(): IJSONSchema {
		return this.colorSchema;
	}

	public getColorReferenceSchema(): IJSONSchema {
		return this.colorReferenceSchema;
	}

	public toString() {
		const sorter = (a: string, b: string) => {
			const cat1 = a.indexOf('.') === -1 ? 0 : 1;
			const cat2 = b.indexOf('.') === -1 ? 0 : 1;
			if (cat1 !== cat2) {
				return cat1 - cat2;
			}
			return a.localeCompare(b);
		};

		return Object.keys(this.colorsById).sort(sorter).map(k => `- \`${k}\`: ${this.colorsById[k].description}`).join('\n');
	}
}

const colorRegistry = new ColorRegistry();

export function getColorRegistry(): IColorRegistry {
	return colorRegistry;
}

Registry.add(ColorExtensions.ColorContribution, colorRegistry);

// ----- color functions

export function executeTransform(transform: ColorTransform, theme: IColorTheme) {
	switch (transform.op) {
		case ColorTransformType.Darken:
			return resolveColorValue(transform.value, theme)?.darken(transform.factor);

		case ColorTransformType.Lighten:
			return resolveColorValue(transform.value, theme)?.lighten(transform.factor);

		case ColorTransformType.Transparent:
			return resolveColorValue(transform.value, theme)?.transparent(transform.factor);

		case ColorTransformType.OneOf:
			for (const candidate of transform.values) {
				const color = resolveColorValue(candidate, theme);
				if (color) {
					return color;
				}
			}
			return undefined;

		case ColorTransformType.IfDefinedThenElse:
			return resolveColorValue(theme.defines(transform.if) ? transform.then : transform.else, theme);

		case ColorTransformType.LessProminent: {
			const from = resolveColorValue(transform.value, theme);
			if (!from) {
				return undefined;
			}

			const backgroundColor = resolveColorValue(transform.background, theme);
			if (!backgroundColor) {
				return from.transparent(transform.factor * transform.transparency);
			}

			return from.isDarkerThan(backgroundColor)
				? Color.getLighterColor(from, backgroundColor, transform.factor).transparent(transform.transparency)
				: Color.getDarkerColor(from, backgroundColor, transform.factor).transparent(transform.transparency);
		}
		default:
			throw assertNever(transform);
	}
}

export function darken(colorValue: ColorValue, factor: number): ColorTransform {
	return { op: ColorTransformType.Darken, value: colorValue, factor };
}

export function lighten(colorValue: ColorValue, factor: number): ColorTransform {
	return { op: ColorTransformType.Lighten, value: colorValue, factor };
}

export function transparent(colorValue: ColorValue, factor: number): ColorTransform {
	return { op: ColorTransformType.Transparent, value: colorValue, factor };
}

export function oneOf(...colorValues: ColorValue[]): ColorTransform {
	return { op: ColorTransformType.OneOf, values: colorValues };
}

export function ifDefinedThenElse(ifArg: ColorIdentifier, thenArg: ColorValue, elseArg: ColorValue): ColorTransform {
	return { op: ColorTransformType.IfDefinedThenElse, if: ifArg, then: thenArg, else: elseArg };
}

/*
function lessProminent(colorValue: ColorValue, backgroundColorValue: ColorValue, factor: number, transparency: number): ColorTransform {
	return { op: ColorTransformType.LessProminent, value: colorValue, background: backgroundColorValue, factor, transparency };
}
*/

// ----- implementation

/**
 * @param colorValue Resolve a color value in the context of a theme
 */
export function resolveColorValue(colorValue: ColorValue | null | undefined, theme: IColorTheme): Color | undefined {
	if (!colorValue) {
		return undefined;
	} else if (typeof colorValue === 'string') {
		if (colorValue[0] === '#') {
			return Color.fromHex(colorValue);
		}
		return theme.getColor(colorValue);
	} else if (colorValue instanceof Color) {
		return colorValue;
	} else if (typeof colorValue === 'object') {
		return executeTransform(colorValue, theme);
	}
	return undefined;
}

export const workbenchColorsSchemaId = 'mote://schemas/workbench-colors';

const schemaRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
schemaRegistry.registerSchema(workbenchColorsSchemaId, colorRegistry.getColorSchema());
