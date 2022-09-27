import { Event } from 'vs/base/common/event';
import { IDimension } from 'mote/editor/common/core/dimension';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ConfigurationChangedEvent, IComputedEditorOptions } from 'mote/editor/common/config/editorOptions';

export interface IEditorConfiguration extends IDisposable {

	/**
	 * Computed editor options.
	 */
	readonly options: IComputedEditorOptions;

	/**
	 * The `options` have changed (quick event)
	 */
	onDidChangeFast: Event<ConfigurationChangedEvent>;

	/**
	 * Recompute options with new reference element dimensions.
	 */
	observeContainer(dimension?: IDimension): void;
}
