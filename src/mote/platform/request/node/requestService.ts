/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as http from 'http';
import * as https from 'https';
import { parse as parseUrl } from 'url';
import { Promises } from 'vs/base/common/async';
import { streamToBufferReadableStream } from 'vs/base/common/buffer';
import { CancellationToken } from 'vs/base/common/cancellation';
import { canceled } from 'vs/base/common/errors';
import { Disposable } from 'vs/base/common/lifecycle';
import * as streams from 'vs/base/common/stream';
import { isBoolean, isNumber } from 'vs/base/common/types';
import { IRequestContext, IRequestOptions } from 'vs/base/parts/request/common/request';
import { INativeEnvironmentService } from 'vs/platform/environment/common/environment';
import { getResolvedShellEnv } from 'vs/platform/shell/node/shellEnv';
import { ILogService } from 'vs/platform/log/common/log';
import { IRequestService } from 'vs/platform/request/common/request';
import { Agent, getProxyAgent } from 'vs/platform/request/node/proxy';
import { createGunzip } from 'zlib';

export interface IRawRequestFunction {
	(options: http.RequestOptions, callback?: (res: http.IncomingMessage) => void): http.ClientRequest;
}

export interface NodeRequestOptions extends IRequestOptions {
	agent?: Agent;
	strictSSL?: boolean;
	getRawRequest?(options: IRequestOptions): IRawRequestFunction;
}

/**
 * This service exposes the `request` API, while using the global
 * or configured proxy settings.
 */
export class RequestService extends Disposable implements IRequestService {

	declare readonly _serviceBrand: undefined;

	private proxyUrl?: string;
	private strictSSL: boolean | undefined;
	private authorization?: string;
	private shellEnvErrorLogged?: boolean;

	constructor(
		@INativeEnvironmentService private readonly environmentService: INativeEnvironmentService,
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	async request(options: NodeRequestOptions, token: CancellationToken): Promise<IRequestContext> {
		this.logService.trace('RequestService#request (node) - begin', options.url);

		const { proxyUrl, strictSSL } = this;

		let shellEnv: typeof process.env | undefined = undefined;
		try {
			shellEnv = await getResolvedShellEnv(this.logService, this.environmentService.args, process.env);
		} catch (error) {
			if (!this.shellEnvErrorLogged) {
				this.shellEnvErrorLogged = true;
				this.logService.error('RequestService#request (node) resolving shell environment failed', error);
			}
		}

		const env = {
			...process.env,
			...shellEnv
		};
		const agent = options.agent ? options.agent : await getProxyAgent(options.url || '', env, { proxyUrl, strictSSL });

		options.agent = agent;
		options.strictSSL = strictSSL;

		if (this.authorization) {
			options.headers = {
				...(options.headers || {}),
				'Proxy-Authorization': this.authorization
			};
		}

		try {
			const res = await this._request(options, token);

			this.logService.trace('RequestService#request (node) - success', options.url);

			return res;
		} catch (error) {
			this.logService.trace('RequestService#request (node) - error', options.url, error);

			throw error;
		}
	}

	private async getNodeRequest(options: IRequestOptions): Promise<IRawRequestFunction> {
		const endpoint = parseUrl(options.url!);
		const module = endpoint.protocol === 'https:' ? await import('https') : await import('http');
		return module.request;
	}

	private _request(options: NodeRequestOptions, token: CancellationToken): Promise<IRequestContext> {

		return Promises.withAsyncBody<IRequestContext>(async (c, e) => {

			const endpoint = parseUrl(options.url!);
			const rawRequest = options.getRawRequest
				? options.getRawRequest(options)
				: await this.getNodeRequest(options);

			const opts: https.RequestOptions = {
				hostname: endpoint.hostname,
				port: endpoint.port ? parseInt(endpoint.port) : (endpoint.protocol === 'https:' ? 443 : 80),
				protocol: endpoint.protocol,
				path: endpoint.path,
				method: options.type || 'GET',
				headers: options.headers,
				agent: options.agent,
				rejectUnauthorized: isBoolean(options.strictSSL) ? options.strictSSL : true
			};

			if (options.user && options.password) {
				opts.auth = options.user + ':' + options.password;
			}

			const req = rawRequest(opts, (res: http.IncomingMessage) => {
				const followRedirects: number = isNumber(options.followRedirects) ? options.followRedirects : 3;
				if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && followRedirects > 0 && res.headers['location']) {
					this._request({
						...options,
						url: res.headers['location'],
						followRedirects: followRedirects - 1
					}, token).then(c, e);
				} else {
					let stream: streams.ReadableStreamEvents<Uint8Array> = res;

					if (res.headers['content-encoding'] === 'gzip') {
						stream = res.pipe(createGunzip());
					}

					c({ res, stream: streamToBufferReadableStream(stream) } as IRequestContext);
				}
			});

			req.on('error', e);

			if (options.timeout) {
				req.setTimeout(options.timeout);
			}

			if (options.data) {
				if (typeof options.data === 'string') {
					req.write(options.data);
				}
			}

			req.end();

			token.onCancellationRequested(() => {
				req.abort();
				e(canceled());
			});
		});
	}

	async resolveProxy(url: string): Promise<string | undefined> {
		return undefined; // currently not implemented in node
	}
}
