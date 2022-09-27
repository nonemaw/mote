import { EditorOption, FindComputedEditorOptionValueById } from 'mote/editor/common/config/editorOptions';

/**
 * @internal
 */
export interface IValidatedEditorOptions {
	get<T extends EditorOption>(id: T): FindComputedEditorOptionValueById<T>;
}
