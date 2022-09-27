import { IUserProfile } from 'mote/platform/user/common/user';
import { IRemoteService, LoginData, UserLoginPayload, UserSignupPayload } from 'mote/platform/remote/common/remote';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';

export class UserService extends Disposable implements IUserService {

	private static STORAGE_KEY = 'user.profile';

	readonly _serviceBrand: undefined;

	private readonly _onDidChangeCurrentProfile = this._register(new Emitter<IUserProfile | undefined>());
	readonly onDidChangeCurrentProfile = this._onDidChangeCurrentProfile.event;

	private _currentProfile: IUserProfile | undefined;
	get currentProfile(): IUserProfile | undefined { return this._currentProfile; }

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IRemoteService private readonly remoteService: IRemoteService
	) {
		super();
		const profile = this.storageService.get(UserService.STORAGE_KEY, StorageScope.APPLICATION);
		if (profile) {
			this._currentProfile = JSON.parse(profile);
			if (this._currentProfile) {
				sessionStorage.setItem('auth_token', this._currentProfile.token);
			}
		}
	}

	loginOrRegister(): void {
		throw new Error('Method not implemented.');
	}

	public async logout(): Promise<void> {
		this._currentProfile = undefined;
		this.storageService.remove(UserService.STORAGE_KEY, StorageScope.APPLICATION);
		sessionStorage.removeItem('auth_token');
		this._onDidChangeCurrentProfile.fire(undefined);
	}

	public async signup(payload: UserSignupPayload): Promise<IUserProfile> {
		const loginData = await this.remoteService.signup(payload);
		return this.buildProfile(loginData);
	}

	public async login(payload: UserLoginPayload): Promise<IUserProfile> {
		const loginData = await this.remoteService.login(payload);
		return this.buildProfile(loginData);
	}

	public async checkUser(): Promise<IUserProfile> {
		const loginData = await this.remoteService.getUser('me');
		return this.buildProfile(loginData);
	}

	private buildProfile(data: LoginData): IUserProfile {
		const profile = {
			id: data.id,
			email: data.email,
			name: data.nickname || '',
			token: data.token
		};
		this._currentProfile = profile;
		this.storageService.store(UserService.STORAGE_KEY, JSON.stringify(profile), StorageScope.APPLICATION, StorageTarget.USER);
		sessionStorage.setItem('auth_token', data.token);
		this._onDidChangeCurrentProfile.fire(profile);
		return profile;
	}
}
