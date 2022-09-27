import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IDimension } from 'vs/editor/common/core/dimension';

/**
 * An editor contribution that gets created every time a new editor gets created and gets disposed when the editor gets disposed.
 */
export interface IEditorContribution {
	/**
	 * Dispose this contribution.
	 */
	dispose(): void;
	/**
	 * Store view state.
	 */
	//saveViewState?(): any;
	/**
	 * Restore view state.
	 */
	//restoreViewState?(state: any): void;
}

export const enum ScrollType {
	Smooth = 0,
	Immediate = 1,
}

/**
 * An editor.
 */
export interface IEditor {
	/**
	 * An event emitted when the editor has been disposed.
	 * @event
	 */
	onDidDispose(listener: () => void): IDisposable;

	/**
	 * Dispose the editor.
	 */
	dispose(): void;

	/**
	 * Get a unique id for this editor instance.
	 */
	getId(): string;

	/**
	 * Get the editor type. Please see `EditorType`.
	 * This is to avoid an instanceof check
	 */
	getEditorType(): string;

	/**
	 * Indicates that the editor becomes hidden.
	 * @internal
	 */
	onHide(): void;

	/**
	 * Instructs the editor to remeasure its container. This method should
	 * be called when the container of the editor gets resized.
	 *
	 * If a dimension is passed in, the passed in value will be used.
	 */
	layout(dimension?: IDimension): void;

	/**
	 * Brings browser focus to the editor text
	 */
	focus(): void;

	/**
	 * Returns the primary selection of the editor.
	 */
	getSelection(): EditorSelection | null;

	/**
	 * Directly trigger a handler or an editor action.
	 * @param source The source of the call.
	 * @param handlerId The id of the handler or the id of a contribution.
	 * @param payload Extra data to be sent to the handler.
	 */
	trigger(source: string | null | undefined, handlerId: string, payload: any): void;


	/**
	 * Gets the current model attached to this editor.
	 */
	//getModel(): IEditorModel | null;

	/**
	 * Sets the current model attached to this editor.
	 * If the previous model was created by the editor via the value key in the options
	 * literal object, it will be destroyed. Otherwise, if the previous model was set
	 * via setModel, or the model key in the options literal object, the previous model
	 * will not be destroyed.
	 * It is safe to call setModel(null) to simply detach the current model from the editor.
	 */
	//setModel(model: IEditorModel | null): void;

	/**
	 * Create a collection of decorations. All decorations added through this collection
	 * will get the ownerId of the editor (meaning they will not show up in other editors).
	 * These decorations will be automatically cleared when the editor's model changes.
	 */
	//createDecorationsCollection(decorations?: IModelDeltaDecoration[]): IEditorDecorationsCollection;

	/**
	 * Change the decorations. All decorations added through this changeAccessor
	 * will get the ownerId of the editor (meaning they will not show up in other
	 * editors).
	 * @see {@link ITextModel.changeDecorations}
	 * @internal
	 */
	//changeDecorations(callback: (changeAccessor: IModelDecorationsChangeAccessor) => any): any;
}

/**
 * The type of the `IEditor`.
 */
export const EditorType = {
	IDocumentEditor: 'mote.editor.IDocumentEditor',
	ICollectionEditor: 'mote.editor.ICollectionEditor'
};

/**
 * Built-in commands.
 * @internal
 */
export const enum Handler {
	CompositionStart = 'compositionStart',
	CompositionEnd = 'compositionEnd',
	Type = 'type',
	Decorate = 'decorate',
	ReplacePreviousChar = 'replacePreviousChar',
	CompositionType = 'compositionType',
	Paste = 'paste',
	Cut = 'cut',
}
