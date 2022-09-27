import { Lodash } from 'mote/base/common/lodash';
import BlockStore from 'mote/platform/store/common/blockStore';
import { BugIndicatingError } from 'vs/base/common/errors';
import { Pointer, RecordWithRole } from 'mote/platform/store/common/record';
import RecordStore from 'mote/platform/store/common/recordStore';
import RecordCacheStore from 'mote/platform/store/common/recordCacheStore';
import { BLOCK_TABLE_NAME } from 'mote/platform/store/common/blockRepository';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';

export class StoreUtils {

	static getParentBlockStore(childStore: RecordStore) {
		let parentStore: RecordStore = childStore;
		while (true) {
			if (!parentStore.recordStoreParentStore) {
				return;
			}
			parentStore = parentStore.recordStoreParentStore;
			if (parentStore instanceof BlockStore && parentStore !== childStore) {
				return parentStore;
			}
		}
	}

	static getLineNumberForStore(store: BlockStore, contentStore: RecordStore) {
		const storeId = store.id;
		const pageIds: string[] = contentStore.getValue() || [];
		return Lodash.findIndex(pageIds, (id) => id === storeId);
	}

	static createStoreForLineNumber(lineNumber: number, contentStore: RecordStore) {
		if (lineNumber < 0) {
			throw new BugIndicatingError('lineNumber should never be negative when create new store');
		}
		const pageId = this.getPageId(lineNumber, contentStore);
		return this.createStoreForPageId(pageId, contentStore);
	}

	static getPageId(lineNumber: number, contentStore: RecordStore) {
		const pageIds: string[] = contentStore.getValue() || [];
		if (lineNumber >= pageIds.length) {
			throw new BugIndicatingError(`content length = ${pageIds.length}, less than ${lineNumber}`);
		}
		return pageIds[lineNumber];
	}

	static createStoreForPageId = (id: string, contentStore: RecordStore) => {
		return BlockStore.createChildStore(contentStore, {
			table: 'block',
			id: id
		});
	};

	static updateCache(
		userId: string, pointer: Pointer,
		recordWithRole: RecordWithRole,
		cacheStore: RecordCacheStore,
		persistedStore: IStorageService,
		force?: boolean,
	) {
		const key = RecordCacheStore.generateCacheKey({ userId, pointer });
		if (recordWithRole && recordWithRole.value) {
			const record = recordWithRole.value;
			if (record.space_id) {
				pointer.spaceId = record.space_id;
			}
		}
		const cachedRecord = cacheStore.getVersion({
			pointer: pointer,
			userId: userId
		});

		const cachedRole = cacheStore.getRole({
			pointer: pointer,
			userId: userId
		});

		if (force || !recordWithRole || !recordWithRole.value
			|| recordWithRole.value.version > cachedRecord
			|| cachedRole !== recordWithRole.role
		) {
			cacheStore.setRecord({ userId, pointer }, recordWithRole);

			if (recordWithRole) {
				if (pointer.table === BLOCK_TABLE_NAME && recordWithRole.value) {
					const record = recordWithRole.value;
					if (record.properties && record.properties.title) {

					}
				}

				persistedStore.store(key, JSON.stringify(recordWithRole), StorageScope.WORKSPACE, StorageTarget.MACHINE);
			}
		}
		if (!recordWithRole) {
			persistedStore.remove(key, StorageScope.WORKSPACE);
		}
	}
}



