import BlockStore from 'mote/platform/store/common/blockStore';
import RecordCacheStore from 'mote/platform/store/common/recordCacheStore';
import { IStoreService } from 'mote/platform/store/common/store';
import { GUEST_USER } from 'mote/platform/user/common/user';
import { IComposite } from 'mote/workbench/common/composite';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { URI } from 'vs/base/common/uri';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IPathData } from 'vs/platform/window/common/window';


// Static values for editor contributions
export const EditorExtensions = {
	EditorPane: 'workbench.contributions.editors',
	EditorFactory: 'workbench.contributions.editor.inputFactories'
};

/**
 * The editor pane is the container for workbench editors.
 */
export interface IEditorPane extends IComposite {

}

export interface IEditorDescriptor<T extends IEditorPane> {
	/**
	 * The unique type identifier of the editor. All instances
	 * of the same `IEditorPane` should have the same type
	 * identifier.
	 */
	readonly typeId: string;

	/**
	 * The display name of the editor.
	 */
	readonly name: string;

	/**
	 * Instantiates the editor pane using the provided services.
	 */
	instantiate(instantiationService: IInstantiationService): T;

	/**
	 * Whether the descriptor is for the provided editor pane.
	 */
	describes(editorPane: T): boolean;
}

export async function pathToEditor(path: IPathData, accessor: ServicesAccessor) {
	if (!path) {
		return undefined;
	}
	const resource = URI.revive(path.fileUri);
	if (!resource) {
		return;
	}

	if (resource.path.length !== 42) {
		return;
	}

	//const remoteService = accessor.get(IRemoteService);
	const userService = accessor.get(IUserService);
	const pointer = { table: 'page', id: resource.path.substring(6) };
	// Set to guest as default behavior
	let userId = GUEST_USER;
	if (userService.currentProfile) {
		userId = userService.currentProfile.id;
	}
	const blockStore = new BlockStore(
		pointer,
		userId,
		[],
		RecordCacheStore.Default,
		accessor.get(IStoreService)
	);
	return Promise.resolve({ resource, store: blockStore });
}
