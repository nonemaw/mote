/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { domContentLoaded, detectFullscreen, getCookieValue } from 'vs/base/browser/dom';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ILogService, ConsoleLogger, MultiplexLogService, LogLevel } from 'vs/platform/log/common/log';
import { ConsoleLogInAutomationLogger } from 'vs/platform/log/browser/log';
import { Disposable, DisposableStore, toDisposable } from 'vs/base/common/lifecycle';
import { BrowserWorkbenchEnvironmentService, IBrowserWorkbenchEnvironmentService } from 'vs/workbench/services/environment/browser/environmentService';
import { Workbench } from 'mote/workbench/browser/workbench';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IProductService } from 'vs/platform/product/common/productService';
import product from 'mote/platform/product/common/product';
import { RemoteAuthorityResolverService } from 'vs/platform/remote/browser/remoteAuthorityResolverService';
import { IRemoteAuthorityResolverService } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { IWorkbenchFileService } from 'vs/workbench/services/files/common/files';
import { FileService } from 'vs/platform/files/common/fileService';
import { Schemas, connectionTokenCookieName } from 'mote/base/common/network';
import { onUnexpectedError } from 'vs/base/common/errors';
import { setFullscreen } from 'vs/base/browser/browser';
import { URI } from 'vs/base/common/uri';
import { ISignService } from 'vs/platform/sign/common/sign';
import { SignService } from 'vs/platform/sign/browser/signService';
import { IWorkbenchConstructionOptions, IWorkbench } from 'mote/workbench/browser/web.api';
import { BrowserStorageService } from 'vs/workbench/services/storage/browser/storageService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { BufferLogService } from 'vs/platform/log/common/bufferLog';
import { FileLogger } from 'vs/platform/log/common/fileLog';
import { toLocalISOString } from 'vs/base/common/date';
import { isWorkspaceToOpen, isFolderToOpen } from 'vs/platform/window/common/window';
import { getSingleFolderWorkspaceIdentifier, getWorkspaceIdentifier } from 'mote/workbench/services/workspaces/browser/workspaces';
import { coalesce } from 'vs/base/common/arrays';
import { InMemoryFileSystemProvider } from 'vs/platform/files/common/inMemoryFilesystemProvider';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IndexedDBFileSystemProvider } from 'vs/platform/files/browser/indexedDBFileSystemProvider';
import { ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { localize } from 'vs/nls';
import { BrowserWindow } from 'mote/workbench/browser/window';
import { HTMLFileSystemProvider } from 'vs/platform/files/browser/htmlFileSystemProvider';
import { mixin, safeStringify } from 'vs/base/common/objects';
import { IndexedDB } from 'vs/base/browser/indexedDB';
import { IWorkspace } from 'vs/workbench/services/host/browser/browserHostService';
import { WebFileSystemAccess } from 'vs/platform/files/browser/webFileSystemAccess';
import { DelayedLogChannel } from 'vs/workbench/services/output/common/delayedLogChannel';
import { dirname, joinPath } from 'vs/base/common/resources';
import { UserService } from 'mote/workbench/services/user/common/userService';
import { RemoteService } from 'mote/workbench/services/remote/browser/remoteService';
import { IRemoteService } from 'mote/platform/remote/common/remote';
import { IUserService } from 'mote/workbench/services/user/common/user';

export class BrowserMain extends Disposable {

	private readonly onWillShutdownDisposables = this._register(new DisposableStore());
	private readonly indexedDBFileSystemProviders: IndexedDBFileSystemProvider[] = [];

	constructor(
		private readonly domElement: HTMLElement,
		private readonly configuration: IWorkbenchConstructionOptions
	) {
		super();

		this.init();
	}

	private init(): void {

		// Browser config
		setFullscreen(!!detectFullscreen());
	}

	async open(): Promise<IWorkbench> {

		// Init services and wait for DOM to be ready in parallel
		const [services] = await Promise.all([this.initServices(), domContentLoaded()]);

		// Create Workbench
		const workbench = new Workbench(this.domElement, undefined, services.serviceCollection, services.logService);

		// Listeners
		this.registerListeners(workbench);

		// Startup
		const instantiationService = workbench.startup();

		// Window
		this._register(instantiationService.createInstance(BrowserWindow));

		// Logging
		services.logService.trace('workbench#open with configuration', safeStringify(this.configuration));

		// Return API Facade
		return instantiationService.invokeFunction(accessor => {
			const commandService = accessor.get(ICommandService);
			const lifecycleService = accessor.get(ILifecycleService);
			//const openerService = accessor.get(IOpenerService);
			const productService = accessor.get(IProductService);
			//const telemetryService = accessor.get(ITelemetryService);
			//const progessService = accessor.get(IProgressService);
			const environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
			const instantiationService = accessor.get(IInstantiationService);
			//const remoteExplorerService = accessor.get(IRemoteExplorerService);
			//const labelService = accessor.get(ILabelService);

			const embedderLogger = instantiationService.createInstance(DelayedLogChannel, 'webEmbedder', productService.embedderIdentifier || localize('vscode.dev', "vscode.dev"), joinPath(dirname(environmentService.logFile), `webEmbedder.log`));

			return {
				commands: {
					executeCommand: (command, ...args) => commandService.executeCommand(command, ...args)
				},
				env: {
					telemetryLevel: null as any,//telemetryService.telemetryLevel,
					async getUriScheme(): Promise<string> {
						return productService.urlProtocol;
					},
					async openUri(uri: URI): Promise<boolean> {
						return Promise.resolve(true); //openerService.open(uri, {});
					}
				},
				logger: {
					log: (level, message) => {
						embedderLogger.log(level, message);
					}
				},
				window: {
					withProgress: (options, task) => null as any//progessService.withProgress(options, task)
				},
				shutdown: () => lifecycleService.shutdown(),
			};
		});
	}

	private registerListeners(workbench: Workbench): void {

		// Workbench Lifecycle
		//this._register(workbench.onWillShutdown(() => this.onWillShutdownDisposables.clear()));
		//this._register(workbench.onDidShutdown(() => this.dispose()));
	}

	private async initServices(): Promise<{ serviceCollection: ServiceCollection; logService: ILogService }> {
		const serviceCollection = new ServiceCollection();


		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		//
		// NOTE: Please do NOT register services here. Use `registerSingleton()`
		//       from `workbench.common.main.ts` if the service is shared between
		//       desktop and web or `workbench.web.main.ts` if the service
		//       is web only.
		//
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


		const payload = this.resolveWorkspaceInitializationPayload();

		// Product
		const productService: IProductService = mixin({ _serviceBrand: undefined, ...product }, this.configuration.productConfiguration);
		serviceCollection.set(IProductService, productService);

		// Environment
		const logsPath = URI.file(toLocalISOString(new Date()).replace(/-|:|\.\d+Z$/g, '')).with({ scheme: 'vscode-log' });
		const environmentService = new BrowserWorkbenchEnvironmentService(payload.id, logsPath, this.configuration, productService);
		serviceCollection.set(IBrowserWorkbenchEnvironmentService, environmentService);

		// Log
		const logService = new BufferLogService(LogLevel.Debug);//getLogLevel(environmentService);
		serviceCollection.set(ILogService, logService);

		// Remote
		const connectionToken = environmentService.options.connectionToken || getCookieValue(connectionTokenCookieName);
		const remoteAuthorityResolverService = new RemoteAuthorityResolverService(productService, connectionToken, this.configuration.resourceUriProvider);
		serviceCollection.set(IRemoteAuthorityResolverService, remoteAuthorityResolverService);

		// Signing
		const signService = new SignService(connectionToken);
		serviceCollection.set(ISignService, signService);


		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		//
		// NOTE: Please do NOT register services here. Use `registerSingleton()`
		//       from `workbench.common.main.ts` if the service is shared between
		//       desktop and web or `workbench.web.main.ts` if the service
		//       is web only.
		//
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

		// Files
		const fileService = this._register(new FileService(logService));
		serviceCollection.set(IWorkbenchFileService, fileService);
		await this.registerFileSystemProviders(environmentService, fileService, logService, logsPath);

		// Storage
		const storageService = await this.createStorageService({ id: 'mote' }, logService);
		serviceCollection.set(IStorageService, storageService);

		// Remote
		const remoteService = new RemoteService(productService);
		serviceCollection.set(IRemoteService, remoteService);

		// User
		const userService = new UserService(storageService, remoteService);
		serviceCollection.set(IUserService, userService);

		remoteService.userService = userService;

		// Workspace
		//const workspaceService = await this.createWorkspaceService(userService, remoteService, storageService, logService);
		//serviceCollection.set(IWorkspaceContextService, workspaceService);


		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		//
		// NOTE: Please do NOT register services here. Use `registerSingleton()`
		//       from `workbench.common.main.ts` if the service is shared between
		//       desktop and web or `workbench.web.main.ts` if the service
		//       is web only.
		//
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

		// Credentials Service
		//const credentialsService = new BrowserCredentialsService(environmentService, remoteAgentService, productService);
		//serviceCollection.set(ICredentialsService, credentialsService);


		return { serviceCollection, logService };
	}

	private async registerFileSystemProviders(environmentService: IWorkbenchEnvironmentService, fileService: IWorkbenchFileService, logService: BufferLogService, logsPath: URI): Promise<void> {

		// IndexedDB is used for logging and user data
		let indexedDB: IndexedDB | undefined;
		const userDataStore = 'vscode-userdata-store';
		const logsStore = 'vscode-logs-store';
		const handlesStore = 'vscode-filehandles-store';
		try {
			indexedDB = await IndexedDB.create('vscode-web-db', 3, [userDataStore, logsStore, handlesStore]);

			// Close onWillShutdown
			this.onWillShutdownDisposables.add(toDisposable(() => indexedDB?.close()));
		} catch (error) {
			logService.error('Error while creating IndexedDB', error);
		}

		// Logger
		if (indexedDB) {
			const logFileSystemProvider = new IndexedDBFileSystemProvider(logsPath.scheme, indexedDB, logsStore, false);
			this.indexedDBFileSystemProviders.push(logFileSystemProvider);
			fileService.registerProvider(logsPath.scheme, logFileSystemProvider);
		} else {
			fileService.registerProvider(logsPath.scheme, new InMemoryFileSystemProvider());
		}

		logService.logger = new MultiplexLogService(coalesce([
			new ConsoleLogger(logService.getLevel()),
			new FileLogger('window', environmentService.logFile, logService.getLevel(), false, fileService),
			// Extension development test CLI: forward everything to test runner
			environmentService.isExtensionDevelopment && !!environmentService.extensionTestsLocationURI ? new ConsoleLogInAutomationLogger(logService.getLevel()) : undefined
		]));

		// User data
		let userDataProvider;
		if (indexedDB) {
			userDataProvider = new IndexedDBFileSystemProvider(Schemas.userData, indexedDB, userDataStore, true);
			this.indexedDBFileSystemProviders.push(userDataProvider);
			//this.registerDeveloperActions(<IndexedDBFileSystemProvider>userDataProvider);
		} else {
			logService.info('Using in-memory user data provider');
			userDataProvider = new InMemoryFileSystemProvider();
		}
		fileService.registerProvider(Schemas.userData, userDataProvider);

		// Remote file system
		//this._register(RemoteFileSystemProviderClient.register(remoteAgentService, fileService, logService));

		// Local file access (if supported by browser)
		if (WebFileSystemAccess.supported(window)) {
			fileService.registerProvider(Schemas.file, new HTMLFileSystemProvider(indexedDB, handlesStore, logService));
		}

		// In-memory
		fileService.registerProvider(Schemas.tmp, new InMemoryFileSystemProvider());
	}

	private async createStorageService(payload: any, logService: ILogService) {
		const storageService = new BrowserStorageService(payload, { currentProfile: '' } as any, logService);

		try {
			await storageService.initialize();
		} catch (error) {
			onUnexpectedError(error);
			logService.error(error);

			return storageService;
		}

		return storageService;
	}

	private resolveWorkspaceInitializationPayload(): any {
		let workspace: IWorkspace | undefined = undefined;
		if (this.configuration.workspaceProvider) {
			workspace = this.configuration.workspaceProvider.workspace;
		}

		// Multi-root workspace
		if (workspace && isWorkspaceToOpen(workspace)) {
			return getWorkspaceIdentifier(workspace.workspaceUri);
		}

		// Single-folder workspace
		if (workspace && isFolderToOpen(workspace)) {
			return getSingleFolderWorkspaceIdentifier(workspace.folderUri);
		}

		return { id: 'empty-window' };
	}
}
