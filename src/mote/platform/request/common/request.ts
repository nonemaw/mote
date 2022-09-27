import { CancellationToken } from 'vs/base/common/cancellation';
import { IRequestContext, IRequestOptions } from 'vs/base/parts/request/common/request';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IRequestService = createDecorator<IRequestService>('requestService');

export interface IRequestService {
	readonly _serviceBrand: undefined;

	request(options: IRequestOptions, token: CancellationToken): Promise<IRequestContext>;

	resolveProxy(url: string): Promise<string | undefined>;
}
