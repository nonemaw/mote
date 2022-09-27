import BlockStore from 'mote/platform/store/common/blockStore';
import { EditorInput } from 'mote/workbench/common/editorInput';


export class DocumentEditorInput extends EditorInput {

	static readonly ID = 'documentEditor.Input';

	constructor(
		public pageStore: BlockStore,
	) {
		super();
	}
}
