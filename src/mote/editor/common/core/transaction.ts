import { generateUuid } from 'vs/base/common/uuid';
import { Operation } from 'mote/platform/transaction/common/operations';
import CommandFacade from '../../../platform/store/common/commandFacade';
import { TransactionQueue } from 'mote/platform/transaction/common/transaction';
import RecordStore from 'mote/platform/store/common/recordStore';
import { Role } from 'mote/platform/store/common/record';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';
import { StoreStorageProvider } from 'mote/platform/store/common/storeStorageProvider';
import { isGuestUser, isLocalUser } from 'mote/platform/user/common/user';


export interface TransactionCallback {
	(transcation: Transaction): void;
}

export class Transaction {

	static create(userId: string) {
		return new Transaction(userId);
	}

	static async createAndCommit(callback: TransactionCallback, userId: string) {
		const transaction = Transaction.create(userId);
		const result = callback(transaction);
		await transaction.commit();
		return result;
	}

	id: string = generateUuid();
	userId: string;
	isLocal = true;
	canUndo = true;

	committed = false;

	operations: Operation[] = [];
	stores: RecordStore[] = [];
	snapshot: { [key: string]: any } = {};

	preSubmitActions: any[] = [];
	postSubmitActions: any[] = [];
	postSubmitCallbacks: any[] = [];

	private constructor(userId: string) {
		this.userId = userId;
		this.isLocal = isLocalUser(userId) || isGuestUser(userId);
	}

	done(args?: any) {
		for (const callback of this.postSubmitCallbacks) {
			callback(args);
		}
		console.debug(`[${this.id}] done.`);
	}

	commit() {
		if (this.committed) {
			console.debug(`commit on a committed transaction [${this.id}].`);
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			if (0 === this.operations.length) {
				this.done();
				resolve();
				return;
			}

			// Trigger preSubmitAction
			for (const preSubmitAction of this.preSubmitActions) {
				preSubmitAction();
			}

			if (this.operations.length > 0) {

			}

			if (this.isLocal) {
				// Trigger postSubmitAction
				for (const postSubmitAction of this.postSubmitActions) {
					postSubmitAction();
				}

				this.done();
				resolve();
			} else {
				TransactionQueue.push({
					id: this.id,
					operations: this.operations
				});
				// Trigger postSubmitAction
				for (const postSubmitAction of this.postSubmitActions) {
					postSubmitAction();
				}

				this.done();
				resolve();
			}
			this.committed = true;
		});
	}

	addOperation(store: RecordStore, operation: Operation) {
		let record = store.getRecordStoreAtRootPath().getValue();
		const role = store.getRecordStoreAtRootPath().getRole();
		record = CommandFacade.execute(operation, record);

		const { userId, pointer, inMemoryRecordCacheStore } = store;
		const recordWithRole = {
			value: record,
			role: role || Role.Editor
		};

		StoreUtils.updateCache(
			userId, pointer, recordWithRole, inMemoryRecordCacheStore,
			StoreStorageProvider.INSTANCE.get(),
			true
		);

		this.operations.push(operation);
		this.stores.push(store);
	}
}
