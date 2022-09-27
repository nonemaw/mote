import { Emitter, Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { get } from './commandFacade';
import { Pointer, RecordValue, Role } from 'mote/platform/store/common/record';
import RecordCacheStore from './recordCacheStore';
import { IStoreService } from 'mote/platform/store/common/store';
import { PermissionUtils } from 'mote/platform/store/common/permissionUtils';


interface RecordStoreState<T> {
	value: T;
	role: Role;
	ready: boolean;
	syncState: boolean;
}

interface RecordStoreProps {
	pointer: Pointer;
	userId?: string;
	path?: string[];
	inMemoryRecordCacheStore?: RecordCacheStore;
}

export default class RecordStore<T = any> extends Disposable {

	static keyName = 'RecordStore';

	private _onDidChange = this._register(new Emitter<void>());
	public readonly onDidChange: Event<void> = this._onDidChange.event;

	private _onDidUpdate = this._register(new Emitter<void>());
	public readonly onDidUpdate: Event<void> = this._onDidUpdate.event;

	userId: string;
	pointer: Pointer;
	path: string[];
	recordStoreParentStore?: RecordStore;
	inMemoryRecordCacheStore: RecordCacheStore;
	private childStoreMap: { [key: string]: RecordStore } = {};
	private instanceState!: RecordStoreState<T>;

	//#region static method

	static getChildStoreKey(pointer: Pointer, keyName: string, path?: string[]) {
		const { id, table } = pointer;
		let key = `${table}:${id}:${keyName}`;
		if (path) {
			for (const property of path) {
				key += `:${property}`;
			}
		}
		return key;
	}

	static createChildStore(parentStore: RecordStore, pointer: Pointer, path?: string[]) {
		const childStoreKey = RecordStore.getChildStoreKey(pointer, RecordStore.keyName, path);
		const cachedChildStore = parentStore.getRecordStoreChildStore(childStoreKey);
		const childStore: RecordStore = cachedChildStore || new RecordStore({
			pointer: pointer, userId: parentStore.userId, path: path,
			inMemoryRecordCacheStore: parentStore.inMemoryRecordCacheStore
		}, parentStore.storeService);
		if (!cachedChildStore) {
			childStore.setRecordStoreParent(childStoreKey, parentStore);
		}
		return childStore;
	}

	//#endregion

	constructor(
		props: RecordStoreProps,
		@IStoreService public readonly storeService: IStoreService,
	) {
		super();
		this.userId = props.userId || 'local';
		this.pointer = props.pointer;
		this.path = props.path || [];
		this.instanceState = {} as any;
		this.inMemoryRecordCacheStore = props.inMemoryRecordCacheStore || RecordCacheStore.Default;

		if (this.isDefaultRecordCache()) {
			storeService.addSubscription(this.userId, this.pointer);
		}

		this._register(this.inMemoryRecordCacheStore.addListener(
			this.userId,
			this.pointer,
			() => this._onDidChange.fire()
		));
		this._register(RecordCacheStore.Default.onDidUpdate((e) => {
			if (this.identify === e) {
				this._onDidUpdate.fire();
			}
		}));
	}

	get id() {
		return this.pointer.id;
	}

	get table() {
		return this.pointer.table;
	}

	get identify() {
		return RecordCacheStore.generateCacheKey({ pointer: this.pointer, userId: this.userId });
	}

	get state() {
		const cachedRecord = this.inMemoryRecordCacheStore.getRecord({ pointer: this.pointer, userId: this.userId });
		if (cachedRecord) {
			if (this.path && this.path.length > 0) {
				this.instanceState.value = get(cachedRecord.value, this.path);
			} else {
				this.instanceState.value = cachedRecord.value as any;
			}
			this.instanceState.syncState = this.inMemoryRecordCacheStore.getSyncState({ pointer: this.pointer, userId: this.userId });
			this.instanceState.role = cachedRecord.role;
			this.instanceState.ready = null !== cachedRecord.role && undefined !== cachedRecord.role;
		}
		return this.instanceState;
	}

	getValue() {
		return this.state.value;
	}

	getRole() {
		return this.state.role;
	}

	getSyncState() {
		return this.state.syncState;
	}

	isMarkedOffline() {
		return Boolean(this.getSyncState());
	}

	isDefaultRecordCache() {
		return this.inMemoryRecordCacheStore === RecordCacheStore.Default;
	}

	//#region permission

	canRead() {
		return PermissionUtils.canRead(this.getRole());
	}

	canComment() {
		return PermissionUtils.canComment(this.getRole());
	}

	canEdit() {
		return PermissionUtils.canEdit(this.getRole());
	}

	//#endregion

	public fire() {
		this._onDidChange.fire();
	}


	getPropertyStore(property: string): RecordStore {
		return RecordStore.createChildStore(this, this.pointer, [property]);
	}

	setRecordStoreParent<T extends RecordStore>(keyName: string, parentStore: T) {
		parentStore.childStoreMap[keyName] = this;
		this.recordStoreParentStore = parentStore;
	}

	getRecordStoreChildStore(keyName: string) {
		return this.childStoreMap[keyName];
	}

	getRecordStoreAtRootPath(): RecordStore<RecordValue> {
		return RecordStore.createChildStore(this, this.pointer);
	}

	async load() {
		if (!this.state.ready && this.isDefaultRecordCache()) {
			await this.waitUtil(() => Boolean(this.state.ready));
		}
		return Promise.resolve();
	}

	waitUtil(predict: () => boolean) {
		if (predict()) {
			return Promise.resolve();
		}
		return new Promise<void>((resolve) => {
			const disposable = this._register(this.onDidChange(() => {
				if (predict()) {
					resolve();
					disposable.dispose();
				}
			}));
		});
	}

	async awaitNonNullValue() {
		return this.waitUtil(() => !!this.getValue());
	}

	clone() {
		return new RecordStore({
			pointer: this.pointer,
			userId: this.userId,
			inMemoryRecordCacheStore: this.inMemoryRecordCacheStore
		}, this.storeService);
	}

	cloneWithNewParent<T extends RecordStore>(parent: T): this {
		const childKey = RecordStore.getChildStoreKey(this.pointer, RecordStore.keyName, this.path);
		const childInCache = parent.getRecordStoreChildStore(childKey) as this;
		const child = childInCache || this.clone();
		if (!childInCache) {
			child.setRecordStoreParent(childKey, parent);
		}
		return child;
	}
}
