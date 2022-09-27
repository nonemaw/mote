import RecordCacheStore from 'mote/platform/store/common/recordCacheStore';
import { IStoreService } from 'mote/platform/store/common/store';
import { BlockType, Pointer } from './record';
import RecordStore from './recordStore';

export default class BlockStore extends RecordStore {
	static override keyName = 'BlockStore';

	static override createChildStore(parentStore: RecordStore, pointer: Pointer, path?: string[]): BlockStore {
		const childStoreKey = RecordStore.getChildStoreKey(pointer, BlockStore.keyName, path);
		const cachedChildStore = parentStore.getRecordStoreChildStore(childStoreKey) as BlockStore;
		const childStore = cachedChildStore || new BlockStore(
			pointer, parentStore.userId, path || [],
			parentStore.inMemoryRecordCacheStore,
			parentStore.storeService,
		);
		if (!cachedChildStore) {
			childStore.setRecordStoreParent(childStoreKey, parentStore);
		}
		return childStore;
	}

	constructor(
		pointer: Pointer,
		userId: string,
		path: string[],
		inMemoryRecordCacheStore: RecordCacheStore,
		@IStoreService storeService: IStoreService,
	) {
		super({ pointer, userId, path, inMemoryRecordCacheStore }, storeService);
	}

	getType(): BlockType | undefined {
		const record = this.getValue();
		if (record && record.type) {
			return record.type;
		}
		return undefined;
	}

	override getPropertyStore(property: string): RecordStore {
		return BlockStore.createChildStore(this, this.pointer, [property]);
	}

	getProperties(): { [key: string]: any } {
		const value = this.getValue();
		if (value && value.properties) {
			return value.properties;
		}
		return {};
	}

	getTitleStore(): RecordStore {
		return this.getPropertyStore('title');
	}

	getContentStore() {
		return this.getPropertyStore('content');
	}

	getPropertiesStore() {
		return RecordStore.createChildStore(this, this.pointer, ['properties']);
	}

	getPermissionsStore() {
		return RecordStore.createChildStore(this, this.pointer, ['permissions']);
	}

	getContentStores(table: string = 'block'): RecordStore[] {
		const contentStore = this.getContentStore();
		const record = this.getValue();
		const content: string[] = record && record.content ? record.content : [];
		return content.map(itemId => RecordStore.createChildStore(contentStore, {
			table: table,
			id: itemId,
		}));
	}

	override clone() {
		return new BlockStore(
			this.pointer,
			this.userId,
			this.path,
			this.inMemoryRecordCacheStore,
			this.storeService
		);
	}
}
