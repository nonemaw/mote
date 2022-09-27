/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { request } from 'vs/base/parts/request/browser/request';
import { IRequestContext, IRequestOptions } from 'vs/base/parts/request/common/request';
import { ILogService } from 'vs/platform/log/common/log';
import { IRequestService } from 'mote/platform/request/common/request';

/**
 * This service exposes the `request` API, while using the global
 * or configured proxy settings.
 */
export class BrowserRequestService implements IRequestService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService
	) {
	}

	async request(options: IRequestOptions, token: CancellationToken): Promise<IRequestContext> {
		this.logService.trace('RequestService#request (browser) - begin', options.url);


		try {
			const res = await request(options, token);

			this.logService.trace('RequestService#request (browser) - success', options.url);

			return res;
		} catch (error) {
			this.logService.error('RequestService#request (browser) - error', options.url, error);

			throw error;
		}
	}

	async resolveProxy(url: string): Promise<string | undefined> {
		return undefined; // not implemented in the web
	}
}
