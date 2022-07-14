/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { hash } from 'vs/base/common/hash';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { joinPath } from 'vs/base/common/resources';
import { isUndefined, UriDto } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IFileService } from 'vs/platform/files/common/files';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { ISingleFolderWorkspaceIdentifier, IWorkspaceIdentifier } from 'vs/platform/workspace/common/workspace';

/**
 * Flags to indicate whether to use the default profile or not.
 */
export type UseDefaultProfileFlags = {
	settings?: boolean;
	keybindings?: boolean;
	tasks?: boolean;
	snippets?: boolean;
	extensions?: boolean;
	uiState?: boolean;
};

export interface IUserDataProfile {
	readonly id: string;
	readonly isDefault: boolean;
	readonly name: string;
	readonly location: URI;
	readonly globalStorageHome: URI;
	readonly settingsResource: URI;
	readonly keybindingsResource: URI;
	readonly tasksResource: URI;
	readonly snippetsHome: URI;
	readonly extensionsResource: URI | undefined;
	readonly useDefaultFlags?: UseDefaultProfileFlags;
}

export function isUserDataProfile(thing: unknown): thing is IUserDataProfile {
	const candidate = thing as IUserDataProfile | undefined;

	return !!(candidate && typeof candidate === 'object'
		&& typeof candidate.id === 'string'
		&& typeof candidate.isDefault === 'boolean'
		&& typeof candidate.name === 'string'
		&& URI.isUri(candidate.location)
		&& URI.isUri(candidate.globalStorageHome)
		&& URI.isUri(candidate.settingsResource)
		&& URI.isUri(candidate.keybindingsResource)
		&& URI.isUri(candidate.tasksResource)
		&& URI.isUri(candidate.snippetsHome)
		&& (isUndefined(candidate.extensionsResource) || URI.isUri(candidate.extensionsResource))
	);
}

export const PROFILES_ENABLEMENT_CONFIG = 'workbench.experimental.settingsProfiles.enabled';

export type EmptyWindowWorkspaceIdentifier = 'empty-window';
export type WorkspaceIdentifier = ISingleFolderWorkspaceIdentifier | IWorkspaceIdentifier | EmptyWindowWorkspaceIdentifier;

export type DidChangeProfilesEvent = { readonly added: IUserDataProfile[]; readonly removed: IUserDataProfile[]; readonly all: IUserDataProfile[] };

export const IUserDataProfilesService = createDecorator<IUserDataProfilesService>('IUserDataProfilesService');
export interface IUserDataProfilesService {
	readonly _serviceBrand: undefined;

	readonly profilesHome: URI;
	readonly defaultProfile: IUserDataProfile;

	readonly onDidChangeProfiles: Event<DidChangeProfilesEvent>;
	readonly profiles: IUserDataProfile[];

	createProfile(name: string, useDefaultFlags?: UseDefaultProfileFlags, workspaceIdentifier?: WorkspaceIdentifier): Promise<IUserDataProfile>;
	setProfileForWorkspace(profile: IUserDataProfile, workspaceIdentifier: WorkspaceIdentifier): Promise<void>;
	getProfile(workspaceIdentifier: WorkspaceIdentifier): IUserDataProfile;
	removeProfile(profile: IUserDataProfile): Promise<void>;
}

export function reviveProfile(profile: UriDto<IUserDataProfile>, scheme: string): IUserDataProfile {
	return {
		id: profile.id,
		isDefault: profile.isDefault,
		name: profile.name,
		location: URI.revive(profile.location).with({ scheme }),
		globalStorageHome: URI.revive(profile.globalStorageHome).with({ scheme }),
		settingsResource: URI.revive(profile.settingsResource).with({ scheme }),
		keybindingsResource: URI.revive(profile.keybindingsResource).with({ scheme }),
		tasksResource: URI.revive(profile.tasksResource).with({ scheme }),
		snippetsHome: URI.revive(profile.snippetsHome).with({ scheme }),
		extensionsResource: URI.revive(profile.extensionsResource)?.with({ scheme })
	};
}

export const EXTENSIONS_RESOURCE_NAME = 'extensions.json';

export function toUserDataProfile(name: string, location: URI, useDefaultFlags?: UseDefaultProfileFlags): IUserDataProfile {
	return {
		id: hash(location.path).toString(16),
		name: name,
		location: location,
		isDefault: false,
		globalStorageHome: joinPath(location, 'globalStorage'),
		settingsResource: joinPath(location, 'settings.json'),
		keybindingsResource: joinPath(location, 'keybindings.json'),
		tasksResource: joinPath(location, 'tasks.json'),
		snippetsHome: joinPath(location, 'snippets'),
		extensionsResource: joinPath(location, EXTENSIONS_RESOURCE_NAME),
		useDefaultFlags
	};
}

export class UserDataProfilesService extends Disposable implements IUserDataProfilesService {
	readonly _serviceBrand: undefined;

	readonly profilesHome: URI;

	get defaultProfile(): IUserDataProfile { return this.profiles[0]; }
	protected _profiles: IUserDataProfile[] = [this.createDefaultUserDataProfile(false)];
	get profiles(): IUserDataProfile[] { return this._profiles; }

	protected readonly _onDidChangeProfiles = this._register(new Emitter<DidChangeProfilesEvent>());
	readonly onDidChangeProfiles = this._onDidChangeProfiles.event;

	constructor(
		@IEnvironmentService protected readonly environmentService: IEnvironmentService,
		@IFileService protected readonly fileService: IFileService,
		@ILogService protected readonly logService: ILogService
	) {
		super();
		this.profilesHome = joinPath(this.environmentService.userRoamingDataHome, 'profiles');
	}

	protected createDefaultUserDataProfile(extensions: boolean): IUserDataProfile {
		const profile = toUserDataProfile(localize('defaultProfile', "Default"), this.environmentService.userRoamingDataHome);
		return { ...profile, isDefault: true, extensionsResource: extensions ? profile.extensionsResource : undefined };
	}

	createProfile(name: string, useDefaultFlags?: UseDefaultProfileFlags, workspaceIdentifier?: WorkspaceIdentifier): Promise<IUserDataProfile> { throw new Error('Not implemented'); }
	setProfileForWorkspace(profile: IUserDataProfile, workspaceIdentifier: WorkspaceIdentifier): Promise<void> { throw new Error('Not implemented'); }
	getProfile(workspaceIdentifier: WorkspaceIdentifier): IUserDataProfile { throw new Error('Not implemented'); }
	removeProfile(profile: IUserDataProfile): Promise<void> { throw new Error('Not implemented'); }
}
