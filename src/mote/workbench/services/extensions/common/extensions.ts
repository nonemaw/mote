import Severity from 'vs/base/common/severity';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';

export interface IMessage {
	type: Severity;
	message: string;
	extensionId: ExtensionIdentifier;
	extensionPointId: string;
}
