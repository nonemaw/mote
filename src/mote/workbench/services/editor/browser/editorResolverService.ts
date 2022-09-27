import * as glob from 'vs/base/common/glob';
import { IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { EditorInputFactory, IEditorResolverService, RegisteredEditorInfo } from 'mote/workbench/services/editor/common/editorResolverService';
import { Disposable, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { insert } from 'vs/base/common/arrays';

interface RegisteredEditor {
	globPattern: string | glob.IRelativePattern;
	editorInfo: RegisteredEditorInfo;
	editorFactory: EditorInputFactory;
}

type RegisteredEditors = Array<RegisteredEditor>;

export class EditorResolverService extends Disposable implements IEditorResolverService {
	readonly _serviceBrand: undefined;

	// Data Stores
	private _editors: Map<string | glob.IRelativePattern, RegisteredEditors> = new Map<string | glob.IRelativePattern, RegisteredEditors>();
	//private cache: Set<string> | undefined;

	constructor() {
		super();
	}

	registerEditor(globPattern: string | glob.IRelativePattern, editorInfo: RegisteredEditorInfo, editorFactory: EditorInputFactory): IDisposable {
		let registeredEditor = this._editors.get(globPattern);
		if (registeredEditor === undefined) {
			registeredEditor = [];
			this._editors.set(globPattern, registeredEditor);
		}
		const remove = insert(registeredEditor, {
			globPattern,
			editorInfo,
			editorFactory
		});

		return toDisposable(() => {
			remove();
		});
	}

	async resolveEditor(editor: IResourceEditorInput): Promise<EditorInput> {
		const registeredEditor = this._editors.get('page')!;
		const editorInput = await registeredEditor[0].editorFactory(editor);
		return editorInput;
	}

}

registerSingleton(IEditorResolverService, EditorResolverService);
