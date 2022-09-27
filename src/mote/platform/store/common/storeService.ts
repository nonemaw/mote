import { Pointer, RecordWithRole } from 'mote/platform/store/common/record';
import RecordCacheStore from 'mote/platform/store/common/recordCacheStore';
import { IStoreService } from 'mote/platform/store/common/store';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';
import { IRemoteService } from 'mote/platform/remote/common/remote';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { isLocalUser } from 'mote/platform/user/common/user';

export class StoreService implements IStoreService {

	constructor(
		@IRemoteService private remoteService: IRemoteService,
		@IStorageService private readonly storeageService: IStorageService
	) {

	}

	addSubscription(userId: string, pointer: Pointer): void {
		const record = RecordCacheStore.Default.getRecord({ userId, pointer });
		if (record) {
			// todo
		} else {
			this.fetchRecordValue(userId, pointer, RecordCacheStore.Default);
		}
	}

	private async fetchRecordValue(userId: string, pointer: Pointer, cacheStore: RecordCacheStore) {
		const key = RecordCacheStore.generateCacheKey({ userId, pointer });
		let recordWithRole: RecordWithRole | undefined;
		const recordPersisted = this.storeageService.get(key, StorageScope.WORKSPACE);
		if (recordPersisted) {
			StoreUtils.updateCache(userId, pointer, JSON.parse(recordPersisted), cacheStore, this.storeageService);
		}
		if (isLocalUser(userId)) {
			return recordPersisted;
		}

		try {
			// Force request latest version
			recordWithRole = await this.remoteService.syncRecordValue(userId, pointer, -1);
			if (recordWithRole) {
				StoreUtils.updateCache(userId, pointer, recordWithRole, cacheStore, this.storeageService);
				cacheStore.fire(key);
			}
		} catch (err) {
			console.error(err);
		}

		return recordWithRole || recordPersisted;
	}

}
