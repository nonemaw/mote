/* eslint-disable code-no-unexternalized-strings */
import { app, ipcMain } from "electron";
import { ILifecycleMainService, LifecycleMainPhase, ShutdownReason } from 'mote/platform/lifecycle/electron-main/lifecycleMainService';
import { IUpdateService } from 'mote/platform/update/common/update';
import { DarwinUpdateService } from 'mote/platform/update/electron-main/updateService.darwin';
import { IWindowsMainService, OpenContext } from "mote/platform/windows/electron-main/windows";
import { WindowsMainService } from "mote/platform/windows/electron-main/windowsMainService";
import { onUnexpectedError, setUnexpectedErrorHandler } from "vs/base/common/errors";
import { Disposable } from "vs/base/common/lifecycle";
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { SyncDescriptor } from "vs/platform/instantiation/common/descriptors";
import { IInstantiationService, ServicesAccessor } from "vs/platform/instantiation/common/instantiation";
import { ServiceCollection } from "vs/platform/instantiation/common/serviceCollection";
import { ILogService } from "vs/platform/log/common/log";
import { Server as ElectronIPCServer } from 'mote/base/parts/ipc/electron-main/ipc.electron';
import { Client as MessagePortClient } from 'mote/base/parts/ipc/electron-main/ipc.mp';
import { IStateMainService } from 'vs/platform/state/electron-main/state';
import { IProcessEnvironment, isMacintosh } from 'vs/base/common/platform';
import { machineIdKey } from 'vs/platform/telemetry/common/telemetry';
import { getMachineId } from 'vs/base/node/id';
import { SharedProcess } from 'mote/platform/sharedProcess/electron-main/sharedProcess';
import { WindowError } from 'vs/platform/window/electron-main/window';

export class MoteApplication extends Disposable {

	private windowsMainService: IWindowsMainService | undefined;

	constructor(
		private readonly userEnv: IProcessEnvironment,
		@ILogService private readonly logService: ILogService,
		@IStateMainService private readonly stateMainService: IStateMainService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@IInstantiationService private readonly mainInstantiationService: IInstantiationService,
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {
		// We handle uncaught exceptions here to prevent electron from opening a dialog to the user
		setUnexpectedErrorHandler(error => this.onUnexpectedError(error));
		process.on('uncaughtException', error => onUnexpectedError(error));
		process.on('unhandledRejection', (reason: unknown) => onUnexpectedError(reason));

		// Dispose on shutdown
		this.lifecycleMainService.onWillShutdown(() => this.dispose());

		// macOS dock activate
		app.on('activate', (event, hasVisibleWindows) => {
			this.logService.trace('app#activate');

			// Mac only event: open new window when we get activated
			if (!hasVisibleWindows) {
				//this.windowsMainService?.openEmptyWindow({ context: OpenContext.DOCK });
			}
		});

		ipcMain.handle('vscode:fetchShellEnv', event => {

		});
	}

	async startup(): Promise<void> {
		this.logService.debug('Starting Mote');
		this.logService.debug(`from: ${this.environmentMainService.appRoot}`);
		this.logService.debug('args:', this.environmentMainService.args);

		// Main process server (electron IPC based)
		const mainProcessElectronServer = new ElectronIPCServer();
		this.lifecycleMainService.onWillShutdown(e => {
			if (e.reason === ShutdownReason.KILL) {
				// When we go down abnormally, make sure to free up
				// any IPC we accept from other windows to reduce
				// the chance of doing work after we go down. Kill
				// is special in that it does not orderly shutdown
				// windows.
				mainProcessElectronServer.dispose();
			}
		});

		// Resolve unique machine ID
		this.logService.trace('Resolving machine identifier...');
		const machineId = await this.resolveMachineId();
		this.logService.trace(`Resolved machine identifier: ${machineId}`);

		// Shared process
		const { sharedProcess, sharedProcessReady, sharedProcessClient } = this.setupSharedProcess(machineId);

		// Services
		const appInstantiationService = await this.initServices(machineId, sharedProcess, sharedProcessReady);

		// Init Channels
		appInstantiationService.invokeFunction(accessor => this.initChannels(accessor, mainProcessElectronServer, sharedProcessClient));

		// Open Windows
		appInstantiationService.invokeFunction(
			accessor => this.openFirstWindow(accessor)
		);

		// Post Open Windows Tasks
		appInstantiationService.invokeFunction(accessor => this.afterWindowOpen(accessor, sharedProcess));
	}

	private onUnexpectedError(error: Error): void {
		if (error) {

			// take only the message and stack property
			/*
			const friendlyError = {
				message: `[uncaught exception in main]: ${error.message}`,
				stack: error.stack
			};
			*/

			// handle on client side
			//this.windowsMainService?.sendToFocused('vscode:reportError', JSON.stringify(friendlyError));
		}

		this.logService.error(`[uncaught exception in main]: ${error}`);
		if (error.stack) {
			this.logService.error(error.stack);
		}
	}

	private async resolveMachineId(): Promise<string> {

		// We cache the machineId for faster lookups on startup
		// and resolve it only once initially if not cached or we need to replace the macOS iBridge device
		let machineId = this.stateMainService.getItem<string>(machineIdKey);
		if (!machineId || (isMacintosh && machineId === '6c9d2bc8f91b89624add29c0abeae7fb42bf539fa1cdb2e3e57cd668fa9bcead')) {
			machineId = await getMachineId();

			this.stateMainService.setItem(machineIdKey, machineId);
		}

		return machineId;
	}

	private setupSharedProcess(machineId: string): { sharedProcess: SharedProcess; sharedProcessReady: Promise<MessagePortClient>; sharedProcessClient: Promise<MessagePortClient> } {
		const sharedProcess = this._register(this.mainInstantiationService.createInstance(SharedProcess, machineId, this.userEnv));

		const sharedProcessClient = (async () => {
			this.logService.trace('Main->SharedProcess#connect');

			const port = await sharedProcess.connect();

			this.logService.trace('Main->SharedProcess#connect: connection established');

			return new MessagePortClient(port, 'main');
		})();

		const sharedProcessReady = (async () => {
			await sharedProcess.whenReady();

			return sharedProcessClient;
		})();

		return { sharedProcess, sharedProcessReady, sharedProcessClient };
	}

	private async initServices(machineId: string, sharedProcess: SharedProcess, sharedProcessReady: Promise<MessagePortClient>) {
		const services = new ServiceCollection();

		// Update
		switch (process.platform) {
			case 'win32':
				//services.set(IUpdateService, new SyncDescriptor(Win32UpdateService));
				break;

			case 'linux':
				/*
				if (isLinuxSnap) {
					services.set(IUpdateService, new SyncDescriptor(SnapUpdateService, [process.env['SNAP'], process.env['SNAP_REVISION']]));
				} else {
					services.set(IUpdateService, new SyncDescriptor(LinuxUpdateService));
				}
				*/
				break;

			case 'darwin':
				services.set(IUpdateService, new SyncDescriptor(DarwinUpdateService));
				break;
		}

		// Windows
		services.set(IWindowsMainService, new SyncDescriptor(WindowsMainService));

		return this.mainInstantiationService.createChild(services);
	}

	private initChannels(accessor: ServicesAccessor, mainProcessElectronServer: ElectronIPCServer, sharedProcessClient: Promise<MessagePortClient>): void {

		// Channels registered to node.js are exposed to second instances
		// launching because that is the only way the second instance
		// can talk to the first instance. Electron IPC does not work
		// across apps until `requestSingleInstance` APIs are adopted.
	}

	private openFirstWindow(accessor: ServicesAccessor) {
		this.windowsMainService = accessor.get(IWindowsMainService);

		return this.windowsMainService.open({
			context: OpenContext.DESKTOP
		});
	}

	private async afterWindowOpen(accessor: ServicesAccessor, sharedProcess: SharedProcess): Promise<void> {

		// Signal phase: after window open
		this.lifecycleMainService.phase = LifecycleMainPhase.AfterWindowOpen;

		// Observe shared process for errors
		//let willShutdown = false;
		//once(this.lifecycleMainService.onWillShutdown)(() => willShutdown = true);
		this._register(sharedProcess.onDidError(({ type, details }) => {

			// Logging
			let message: string;
			switch (type) {
				case WindowError.UNRESPONSIVE:
					message = 'SharedProcess: detected unresponsive window';
					break;
				case WindowError.CRASHED:
					message = `SharedProcess: crashed (detail: ${details?.reason ?? '<unknown>'}, code: ${details?.exitCode ?? '<unknown>'})`;
					break;
				case WindowError.LOAD:
					message = `SharedProcess: failed to load (detail: ${details?.reason ?? '<unknown>'}, code: ${details?.exitCode ?? '<unknown>'})`;
					break;
			}
			onUnexpectedError(new Error(message));
		}));

		// Initialize update service
		const updateService = accessor.get(IUpdateService);
		if (updateService instanceof DarwinUpdateService) {
			this.logService.trace('initialize updateService');
			await updateService.initialize();
		}
	}
}
