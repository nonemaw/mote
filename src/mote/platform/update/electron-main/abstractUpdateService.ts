import { ILifecycleMainService } from 'mote/platform/lifecycle/electron-main/lifecycleMainService';
import { IRequestService } from 'mote/platform/request/common/request';
import { AvailableForDownload, IUpdateService, State, StateType, UpdateType } from 'mote/platform/update/common/update';
import { timeout } from 'vs/base/common/async';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Emitter, Event } from 'vs/base/common/event';
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';

export function createUpdateURL(platform: string, quality: string, productService: IProductService): string {
	return `${productService.updateUrl}/api/update/${platform}/${quality}/${productService.commit}`;
}

export type UpdateNotAvailableClassification = {
	owner: 'zurex';
	explicit: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Whether the user has manually checked for updates, or this was an automatic check.' };
	comment: 'This is used to understand how often Mote pings the update server for an update and there\'s none available.';
};

export abstract class AbstractUpdateService implements IUpdateService {

	declare readonly _serviceBrand: undefined;

	protected url: string | undefined;

	private _state: State = State.Uninitialized;

	private readonly _onStateChange = new Emitter<State>();
	readonly onStateChange: Event<State> = this._onStateChange.event;

	get state(): State {
		return this._state;
	}

	protected setState(state: State): void {
		this.logService.info('update#setState', state.type);
		this._state = state;
		this._onStateChange.fire(state);
	}

	constructor(
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@ILogService protected logService: ILogService,
		@IRequestService protected requestService: IRequestService,
		@IProductService protected readonly productService: IProductService
	) {

	}

	/**
	 * This must be called before any other call. This is a performance
	 * optimization, to avoid using extra CPU cycles before first window open.
	 * https://github.com/microsoft/vscode/issues/89784
	 */
	async initialize(): Promise<void> {

		if (this.environmentMainService.disableUpdates) {
			this.logService.info('update#ctor - updates are disabled by the environment');
			return;
		}

		if (!this.productService.updateUrl || !this.productService.commit) {
			this.logService.info('update#ctor - updates are disabled as there is no update URL');
			return;
		}

		const updateMode = this.getUpdateMode();
		const quality = this.getProductQuality(updateMode);

		if (!quality) {
			this.logService.info('update#ctor - updates are disabled by user preference');
			return;
		}

		this.url = this.buildUpdateFeedUrl(quality);
		if (!this.url) {
			this.logService.info('update#ctor - updates are disabled as the update URL is badly formed');
			return;
		}

		this.setState(State.Idle(this.getUpdateType()));

		if (updateMode === 'manual') {
			this.logService.info('update#ctor - manual checks only; automatic updates are disabled by user preference');
			return;
		}

		if (updateMode === 'start') {
			this.logService.info('update#ctor - startup checks only; automatic updates are disabled by user preference');

			// Check for updates only once after 30 seconds
			setTimeout(() => this.checkForUpdates(false), 30 * 1000);
		} else {
			this.logService.info('update#ctor - automatic updates scheduled');
			// Start checking for updates after 10 seconds
			this.scheduleCheckForUpdates(10 * 1000).then(undefined, err => this.logService.error(err));
		}
	}

	protected getUpdateMode(): 'none' | 'manual' | 'start' | 'default' {
		//return getMigratedSettingValue<'none' | 'manual' | 'start' | 'default'>(this.configurationService, 'update.mode', 'update.channel');
		return 'default';
	}

	private getProductQuality(updateMode: string): string | undefined {
		return updateMode === 'none' ? undefined : this.productService.quality;
	}

	private scheduleCheckForUpdates(delay = 60 * 60 * 1000): Promise<void> {
		return timeout(delay)
			.then(() => this.checkForUpdates(false))
			.then(() => {
				// Check again after 1 hour
				return this.scheduleCheckForUpdates(60 * 60 * 1000);
			});
	}

	async checkForUpdates(explicit: boolean): Promise<void> {
		this.logService.trace('update#checkForUpdates, state = ', this.state.type);

		if (this.state.type !== StateType.Idle) {
			return;
		}

		this.doCheckForUpdates(explicit);
	}

	async downloadUpdate(): Promise<void> {
		this.logService.trace('update#downloadUpdate, state = ', this.state.type);

		if (this.state.type !== StateType.AvailableForDownload) {
			return;
		}

		await this.doDownloadUpdate(this.state);
	}

	protected async doDownloadUpdate(state: AvailableForDownload): Promise<void> {
		// noop
	}

	async applyUpdate(): Promise<void> {
		this.logService.trace('update#applyUpdate, state = ', this.state.type);

		if (this.state.type !== StateType.Downloaded) {
			return;
		}

		await this.doApplyUpdate();
	}

	protected async doApplyUpdate(): Promise<void> {
		// noop
	}

	quitAndInstall(): Promise<void> {
		this.logService.trace('update#quitAndInstall, state = ', this.state.type);

		if (this.state.type !== StateType.Ready) {
			return Promise.resolve(undefined);
		}

		this.logService.trace('update#quitAndInstall(): before lifecycle quit()');

		this.lifecycleMainService.quit(true /* will restart */).then(vetod => {
			this.logService.trace(`update#quitAndInstall(): after lifecycle quit() with veto: ${vetod}`);
			if (vetod) {
				return;
			}

			this.logService.trace('update#quitAndInstall(): running raw#quitAndInstall()');
			this.doQuitAndInstall();
		});

		return Promise.resolve(undefined);
	}

	async isLatestVersion(): Promise<boolean | undefined> {
		if (!this.url) {
			return undefined;
		}

		const mode = await this.getUpdateMode();

		if (mode === 'none') {
			return false;
		}

		const context = await this.requestService.request({ url: this.url }, CancellationToken.None);

		// The update server replies with 204 (No Content) when no
		// update is available - that's all we want to know.
		return context.res.statusCode === 204;
	}

	async _applySpecificUpdate(packagePath: string): Promise<void> {
		// noop
	}

	protected getUpdateType(): UpdateType {
		return UpdateType.Archive;
	}

	protected doQuitAndInstall(): void {
		// noop
	}

	protected abstract buildUpdateFeedUrl(quality: string): string | undefined;
	protected abstract doCheckForUpdates(context: any): void;
}
