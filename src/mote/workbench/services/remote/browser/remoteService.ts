import { Lodash } from 'mote/base/common/lodash';
import { doFetch } from 'mote/base/parts/request/common/request';
import { Pointer, RecordWithRole } from 'mote/platform/store/common/record';
import RequestQueue from 'mote/workbench/services/remote/common/requestQueue';
import { CaffeineResponse, IRemoteService, LoginData, SyncRecordRequest, UploadData, UserLoginPayload, UserSignupPayload } from 'mote/platform/remote/common/remote';
import { sha1Hex } from 'vs/base/browser/hash';
import { generateUuid } from 'vs/base/common/uuid';
import { TransactionQueue } from 'mote/platform/transaction/common/transaction';
import { CaffeineError } from 'mote/base/common/errors';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { IProductService } from 'vs/platform/product/common/productService';


let host: string;

function genarateUrl(path: string) {
	return `${host}${path}`;
}

type IRecordMap = { [key: string]: { [key: string]: RecordWithRole } };

class RecordMap {
	data: { [key: string]: { [key: string]: RecordWithRole } };

	constructor(recordMap: { [key: string]: { [key: string]: RecordWithRole } }) {
		this.data = recordMap;
	}

	get(pointer: Pointer) {
		const map = this.data[pointer.table];
		if (map) {
			return map[pointer.id];
		}
		return undefined;
	}

	getByTable(table: string) {
		const map = this.data[table] || {};
		return Object.entries(map).map(entry => {
			return {
				pointer: {
					table: table,
					id: entry[0]
				},
				value: entry[1]
			};
		});
	}
}

const syncRecordValuesQueue = new RequestQueue<SyncRecordRequest, RecordWithRole>({
	performRequests: async (requests: SyncRecordRequest[]) => {
		const uniqueRequests = Lodash.uniqWith(requests, (value, other) => {
			if (!other) {
				return false;
			}
			return value.id === other.id && value.table === other.table && value.version === other.version;
		});
		const recordMap = await syncRecordValues(uniqueRequests);
		return requests.map(request => recordMap.get(request))
			.filter(recordWithRole => recordWithRole !== undefined) as RecordWithRole[];
	},
	batchSize: 5,
	maxWorkers: 2,
	requestDelayMs: 200,
	requestTimeoutMs: 3000
});

const syncRecordValues = async (requests: SyncRecordRequest[]) => {
	if (requests.length === 0) {
		return new RecordMap({});
	}
	const requestMap: { [key: string]: SyncRecordRequest } = {};
	for (const request of requests) {
		const key = `${request.table}|${request.id}|${request.version}`;
		requestMap[key] = request;
	}
	requests = Object.keys(requestMap).map(key => requestMap[key]);
	const recordValues = await RemoteService.INSTANCE.syncRecordValues(requests);
	const data = recordValues ? recordValues : {};
	const recordMap = new RecordMap(data);
	return recordMap;
};

export class RemoteService implements IRemoteService {

	public static INSTANCE: RemoteService;

	readonly _serviceBrand: undefined;

	private timeout = 1200;

	public userService!: IUserService;

	constructor(
		@IProductService productService: IProductService,
	) {

		host = productService.updateUrl || 'http://localhost:7071';
		setInterval(() => this.applyTransactions(), this.timeout);
		RemoteService.INSTANCE = this;
	}

	//#region user

	async getUser(userId: string): Promise<LoginData> {
		return this.doGet<LoginData>(`/api/user/${userId}`);
	}

	async login(payload: UserLoginPayload): Promise<LoginData> {
		// Build password with salt
		const password = await sha1Hex('mote' + payload.password);
		payload.password = password;
		return this.doPost<LoginData>(`/api/user/login`, payload);
	}

	async signup(payload: UserSignupPayload): Promise<LoginData> {
		// Build password with salt
		const password = await sha1Hex('mote' + payload.password);
		payload.password = password;
		return this.doPost<LoginData>(`/api/user/signup`, payload);
	}

	//#endregion

	async getSpaces(userId: string): Promise<RecordWithRole[]> {
		return this.doPost<RecordWithRole[]>('/api/getSpaces', { userId: userId });
	}

	async syncRecordValue(userId: string, pointer: Pointer, version?: number): Promise<RecordWithRole> {
		return syncRecordValuesQueue.enqueue({
			id: pointer.id,
			table: pointer.table,
			version: version ?? -1
		});
	}

	async syncRecordValues(payload: SyncRecordRequest[]) {
		return await this.doPost<IRecordMap>('/api/syncRecordValues', payload);
	}

	async uploadFile(file: File) {
		const userId = this.userService.currentProfile?.id;
		const data = new FormData();
		data.append('file', file);
		return await this.doPost<UploadData>(`/api/upload?filename=${file.name}&username=${userId}`, data);
	}

	private async applyTransactions() {
		if (TransactionQueue.length === 0) {
			return Promise.resolve();
		}
		const transactions = TransactionQueue.splice(0, 20);
		const request = {
			traceId: generateUuid(),
			transactions: transactions
		};
		this.doPost('/api/applyTransactions', request);
	}

	private async doGet<T>(path: string): Promise<T> {
		return this.executeRequest(() => doFetch<CaffeineResponse<T>>(genarateUrl(path), null, 'GET'));
	}

	private async doPost<T>(path: string, payload: any): Promise<T> {
		return this.executeRequest(() => doFetch<CaffeineResponse<T>>(genarateUrl(path), payload, 'POST'));
	}

	private async executeRequest<T>(callback: () => Promise<CaffeineResponse<T>>) {
		// Check token valid or not
		const token = sessionStorage.getItem('auth_token');
		if (this.userService.currentProfile && !token) {
			// We login without token, force logout
			this.userService.logout();
			return Promise.reject('No auth token');
		}
		const response = await callback();
		switch (response.code) {
			case 0:
				return response.data;
			case 111: // TokenExpired
				this.userService.logout();
				return Promise.reject('Token expired');
		}
		throw new CaffeineError(response.message, response.code);
	}
}

