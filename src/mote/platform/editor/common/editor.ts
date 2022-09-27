import BlockStore from 'mote/platform/store/common/blockStore';
import { URI } from 'vs/base/common/uri';

export interface IBaseUntypedEditorInput {

}

export interface IResourceEditorInput extends IBaseUntypedEditorInput {

	/**
	 * The resource URI of the resource to open.
	 */
	readonly resource: URI;

	readonly store: BlockStore;
}

export interface IEditorOptions {

}
