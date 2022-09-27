import { IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { IEditorPane } from 'mote/workbench/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IEditorService = createDecorator<IEditorService>('editorService');

export interface IEditorService {

	readonly _serviceBrand: undefined;

	openEditor(editor: EditorInput): Promise<IEditorPane | undefined>;

	openEditorWithResource(editor: IResourceEditorInput): Promise<IEditorPane | undefined>;

	closeEditor(editor?: EditorInput): Promise<boolean>;

}
