import * as glob from 'vs/base/common/glob';
import { IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { IDisposable } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IEditorResolverService = createDecorator<IEditorResolverService>('editorResolverService');

type EditorInputFactoryResult = EditorInput | Promise<EditorInput>;
export type EditorInputFactory = (editorInput: IResourceEditorInput) => EditorInputFactoryResult;

export type RegisteredEditorInfo = {
	id: string;
};

export interface IEditorResolverService {
	readonly _serviceBrand: undefined;

	registerEditor(globPattern: string | glob.IRelativePattern, editorInfo: RegisteredEditorInfo, editorFactory: EditorInputFactory): IDisposable;

	resolveEditor(editor: IResourceEditorInput): Promise<EditorInput>;
}
