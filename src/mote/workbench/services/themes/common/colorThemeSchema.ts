import { workbenchColorsSchemaId } from 'mote/platform/theme/common/colorRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';
import { Extensions as JSONExtensions, IJSONContributionRegistry } from 'vs/platform/jsonschemas/common/jsonContributionRegistry';
import { Registry } from 'vs/platform/registry/common/platform';


export const colorThemeSchemaId = 'mote://schemas/color-theme';
const colorThemeSchema: IJSONSchema = {
	type: 'object',
	allowComments: true,
	allowTrailingCommas: true,
	properties: {
		colors: {
			description: nls.localize('schema.workbenchColors', 'Colors in the workbench'),
			$ref: workbenchColorsSchemaId,
			additionalProperties: false
		},
		semanticHighlighting: {
			type: 'boolean',
			description: nls.localize('schema.supportsSemanticHighlighting', 'Whether semantic highlighting should be enabled for this theme.')
		},
	}
};

export function registerColorThemeSchemas() {
	const schemaRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
	schemaRegistry.registerSchema(colorThemeSchemaId, colorThemeSchema);
	//schemaRegistry.registerSchema(textmateColorsSchemaId, textmateColorSchema);
}
