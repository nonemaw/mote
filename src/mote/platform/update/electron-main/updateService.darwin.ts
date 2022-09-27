import * as electron from 'electron';
import { Event } from 'vs/base/common/event';
import { memoize } from 'vs/base/common/decorators';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { AbstractUpdateService, createUpdateURL } from 'mote/platform/update/electron-main/abstractUpdateService';
import { IUpdate, State, StateType, UpdateType } from 'mote/platform/update/common/update';
import { ILifecycleMainService } from 'mote/platform/lifecycle/electron-main/lifecycleMainService';
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { IRequestService } from 'mote/platform/request/common/request';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';


export class DarwinUpdateService extends AbstractUpdateService {

	private readonly disposables = new DisposableStore();

	@memoize private get onRawError(): Event<string> { return Event.fromNodeEventEmitter(electron.autoUpdater, 'error', (_, message) => message); }
	@memoize private get onRawUpdateNotAvailable(): Event<void> { return Event.fromNodeEventEmitter<void>(electron.autoUpdater, 'update-not-available'); }
	@memoize private get onRawUpdateAvailable(): Event<IUpdate> { return Event.fromNodeEventEmitter(electron.autoUpdater, 'update-available', (_, url, version) => ({ url, version, productVersion: version })); }
	@memoize private get onRawUpdateDownloaded(): Event<IUpdate> { return Event.fromNodeEventEmitter(electron.autoUpdater, 'update-downloaded', (_, releaseNotes, version, date) => ({ releaseNotes, version, productVersion: version, date })); }

	constructor(
		@ILifecycleMainService lifecycleMainService: ILifecycleMainService,
		//@IConfigurationService configurationService: IConfigurationService,
		//@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IEnvironmentMainService environmentMainService: IEnvironmentMainService,
		@IRequestService requestService: IRequestService,
		@ILogService logService: ILogService,
		@IProductService productService: IProductService
	) {
		super(lifecycleMainService, environmentMainService, logService, requestService, productService);
	}

	override async initialize(): Promise<void> {
		await super.initialize();
		this.onRawError(this.onError, this, this.disposables);
		this.onRawUpdateAvailable(this.onUpdateAvailable, this, this.disposables);
		this.onRawUpdateDownloaded(this.onUpdateDownloaded, this, this.disposables);
		this.onRawUpdateNotAvailable(this.onUpdateNotAvailable, this, this.disposables);
	}

	private onError(err: string): void {
		this.logService.error('UpdateService error:', err);

		// only show message when explicitly checking for updates
		const shouldShowMessage = this.state.type === StateType.CheckingForUpdates ? this.state.explicit : true;
		const message: string | undefined = shouldShowMessage ? err : undefined;
		this.setState(State.Idle(UpdateType.Archive, message));
	}

	protected buildUpdateFeedUrl(quality: string): string | undefined {
		let assetID: string;
		if (!this.productService.darwinUniversalAssetId) {
			assetID = process.arch === 'x64' ? 'darwin' : 'darwin-arm64';
		} else {
			assetID = this.productService.darwinUniversalAssetId;
		}
		const url = createUpdateURL(assetID, quality, this.productService);
		try {
			//electron.autoUpdater.setFeedURL({ url });
		} catch (e) {
			// application is very likely not signed
			this.logService.error('Failed to set update feed URL', e);
			return url;
		}
		return url;
	}

	protected async doCheckForUpdates(context: any): Promise<void> {
		this.setState(State.CheckingForUpdates(context));
		//electron.autoUpdater.checkForUpdates();
		await this.isLatestVersion();
		this.setState(State.Idle(context));
	}

	private onUpdateAvailable(update: IUpdate): void {
		if (this.state.type !== StateType.CheckingForUpdates) {
			return;
		}

		this.setState(State.Downloading(update));
	}

	private onUpdateDownloaded(update: IUpdate): void {
		if (this.state.type !== StateType.Downloading) {
			return;
		}

		this.setState(State.Ready(update));
	}

	private onUpdateNotAvailable(): void {
		if (this.state.type !== StateType.CheckingForUpdates) {
			return;
		}
		//this.telemetryService.publicLog2<{ explicit: boolean }, UpdateNotAvailableClassification>('update:notAvailable', { explicit: this.state.explicit });

		this.setState(State.Idle(UpdateType.Archive));
	}

	protected override doQuitAndInstall(): void {
		this.logService.trace('update#quitAndInstall(): running raw#quitAndInstall()');
		electron.autoUpdater.quitAndInstall();
	}

	dispose(): void {
		this.disposables.dispose();
	}
}
