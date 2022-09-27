/* eslint-disable code-no-unexternalized-strings */
import { app } from "electron";
import { Schemas } from "mote/base/common/network";
import { ILifecycleMainService, LifecycleMainService } from "mote/platform/lifecycle/electron-main/lifecycleMainService";
import { ConsoleLoggerService } from "mote/platform/log/common/consoleLog";
import { IProtocolMainService } from "mote/platform/protocol/electron-main/protocol";
import { ProtocolMainService } from "mote/platform/protocol/electron-main/protocolMainService";
import { IRequestService } from 'mote/platform/request/common/request';
import { IThemeMainService, ThemeMainService } from "mote/platform/theme/electron-main/themeMainService";
import { coalesce, distinct } from "vs/base/common/arrays";
import { IPathWithLineAndColumn, isValidBasename, parseLineAndColumnAware, sanitizeFilePath } from "vs/base/common/extpath";
import { basename, resolve } from "vs/base/common/path";
import { IProcessEnvironment, isMacintosh, isWindows } from "vs/base/common/platform";
import { cwd } from "vs/base/common/process";
import { rtrim, trim } from "vs/base/common/strings";
import { NativeParsedArgs } from "vs/platform/environment/common/argv";
import { EnvironmentMainService, IEnvironmentMainService } from "vs/platform/environment/electron-main/environmentMainService";
import { addArg, parseMainProcessArgv } from "vs/platform/environment/node/argvHelper";
import { createWaitMarkerFile } from "vs/platform/environment/node/wait";
import { IFileService } from "vs/platform/files/common/files";
import { FileService } from "vs/platform/files/common/fileService";
import { DiskFileSystemProvider } from "vs/platform/files/node/diskFileSystemProvider";
import { SyncDescriptor } from "vs/platform/instantiation/common/descriptors";
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from "vs/platform/instantiation/common/instantiationService";
import { ServiceCollection } from "vs/platform/instantiation/common/serviceCollection";
import { ConsoleMainLogger, ILoggerService, ILogService, LogLevel, LogService } from "vs/platform/log/common/log";
import product from "vs/platform/product/common/product";
import { IProductService } from "vs/platform/product/common/productService";
import { RequestMainService } from 'mote/platform/request/electron-main/requestMainService';
import { IStateMainService } from "vs/platform/state/electron-main/state";
import { StateMainService } from "vs/platform/state/electron-main/stateMainService";
import { MoteApplication } from "./app";

class MoteMain {

	main(): void {
		try {
			this.startup();
		} catch (error) {
			console.error(error.message);
			app.exit(1);
		}
	}

	private async startup(): Promise<void> {
		const [instantiationService, instanceEnvironment] = this.createServices();

		// Startup
		await instantiationService.invokeFunction(async accessor => {
			console.log("startup...");

			return instantiationService.createInstance(MoteApplication, instanceEnvironment).startup();
		});
	}

	private createServices(): [IInstantiationService, IProcessEnvironment,] {
		const services = new ServiceCollection();

		// Product
		const productService = { _serviceBrand: undefined, ...product };
		services.set(IProductService, productService);

		// Environment
		const environmentMainService = new EnvironmentMainService(this.resolveArgs(), productService);
		const instanceEnvironment = this.patchEnvironment(environmentMainService); // Patch `process.env` with the instance's environment
		services.set(IEnvironmentMainService, environmentMainService);

		const logService = new LogService(new ConsoleMainLogger(LogLevel.Debug));
		services.set(ILogService, logService);

		// Files
		const fileService = new FileService(logService);
		services.set(IFileService, fileService);
		const diskFileSystemProvider = new DiskFileSystemProvider(logService);
		fileService.registerProvider(Schemas.file, diskFileSystemProvider);

		// Logger
		services.set(ILoggerService, new ConsoleLoggerService(logService));

		// Configuration
		//const configurationService = new ConfigurationService(environmentMainService.settingsResource, fileService);
		//services.set(IConfigurationService, configurationService);

		// Lifecycle
		services.set(ILifecycleMainService, new SyncDescriptor(LifecycleMainService));

		// Request
		services.set(IRequestService, new SyncDescriptor(RequestMainService));

		// State
		const stateMainService = new StateMainService(environmentMainService, logService, fileService);
		services.set(IStateMainService, stateMainService);

		// Themes
		services.set(IThemeMainService, new SyncDescriptor(ThemeMainService));

		// Protocol
		services.set(IProtocolMainService, new SyncDescriptor(ProtocolMainService));

		return [new InstantiationService(services, true), instanceEnvironment];
	}

	private patchEnvironment(environmentMainService: IEnvironmentMainService): IProcessEnvironment {
		const instanceEnvironment: IProcessEnvironment = {
			VSCODE_IPC_HOOK: environmentMainService.mainIPCHandle
		};

		['VSCODE_NLS_CONFIG', 'VSCODE_PORTABLE'].forEach(key => {
			const value = process.env[key];
			if (typeof value === 'string') {
				instanceEnvironment[key] = value;
			}
		});

		Object.assign(process.env, instanceEnvironment);

		return instanceEnvironment;
	}

	private resolveArgs(): NativeParsedArgs {

		// Parse arguments
		const args = this.validatePaths(parseMainProcessArgv(process.argv));

		// If we are started with --wait create a random temporary file
		// and pass it over to the starting instance. We can use this file
		// to wait for it to be deleted to monitor that the edited file
		// is closed and then exit the waiting process.
		//
		// Note: we are not doing this if the wait marker has been already
		// added as argument. This can happen if Code was started from CLI.
		if (args.wait && !args.waitMarkerFilePath) {
			const waitMarkerFilePath = createWaitMarkerFile(args.verbose);
			if (waitMarkerFilePath) {
				addArg(process.argv, '--waitMarkerFilePath', waitMarkerFilePath);
				args.waitMarkerFilePath = waitMarkerFilePath;
			}
		}

		return args;
	}

	private validatePaths(args: NativeParsedArgs): NativeParsedArgs {

		// Track URLs if they're going to be used
		if (args['open-url']) {
			args._urls = args._;
			args._ = [];
		}

		// Normalize paths and watch out for goto line mode
		if (!args['remote']) {
			const paths = this.doValidatePaths(args._, args.goto);
			args._ = paths;
		}

		return args;
	}

	private doValidatePaths(args: string[], gotoLineMode?: boolean): string[] {
		const currentWorkingDir = cwd();
		const result = args.map(arg => {
			let pathCandidate = String(arg);

			let parsedPath: IPathWithLineAndColumn | undefined = undefined;
			if (gotoLineMode) {
				parsedPath = parseLineAndColumnAware(pathCandidate);
				pathCandidate = parsedPath.path;
			}

			if (pathCandidate) {
				pathCandidate = this.preparePath(currentWorkingDir, pathCandidate);
			}

			const sanitizedFilePath = sanitizeFilePath(pathCandidate, currentWorkingDir);

			const filePathBasename = basename(sanitizedFilePath);
			if (filePathBasename /* can be empty if code is opened on root */ && !isValidBasename(filePathBasename)) {
				return null; // do not allow invalid file names
			}

			if (gotoLineMode && parsedPath) {
				parsedPath.path = sanitizedFilePath;

				return this.toPath(parsedPath);
			}

			return sanitizedFilePath;
		});

		const caseInsensitive = isWindows || isMacintosh;
		const distinctPaths = distinct(result, path => path && caseInsensitive ? path.toLowerCase() : (path || ''));

		return coalesce(distinctPaths);
	}

	private preparePath(cwd: string, path: string): string {

		// Trim trailing quotes
		if (isWindows) {
			path = rtrim(path, '"'); // https://github.com/microsoft/vscode/issues/1498
		}

		// Trim whitespaces
		path = trim(trim(path, ' '), '\t');

		if (isWindows) {

			// Resolve the path against cwd if it is relative
			path = resolve(cwd, path);

			// Trim trailing '.' chars on Windows to prevent invalid file names
			path = rtrim(path, '.');
		}

		return path;
	}

	private toPath(pathWithLineAndCol: IPathWithLineAndColumn): string {
		const segments = [pathWithLineAndCol.path];

		if (typeof pathWithLineAndCol.line === 'number') {
			segments.push(String(pathWithLineAndCol.line));
		}

		if (typeof pathWithLineAndCol.column === 'number') {
			segments.push(String(pathWithLineAndCol.column));
		}

		return segments.join(':');
	}

	//#endregion
}

// Main Startup
const mote = new MoteMain();
mote.main();
