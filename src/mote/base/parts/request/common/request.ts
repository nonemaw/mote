import { generateUuid } from 'vs/base/common/uuid';
import { OfflineError } from 'vs/base/parts/request/common/request';

export const config = {
	apiDev: 'http://localhost:7071',
	apiProd: 'https://caffeine-function.azurewebsites.net',
	apiDomain: '',
};


export async function doFetch<T>(url: string, payload: any, method: string): Promise<T> {
	if (!navigator.onLine) {
		throw new OfflineError();
	}
	let contentType = '';
	if (payload instanceof File) {
		contentType = payload.type;
	} else if (payload instanceof FormData) {

	}
	else {
		contentType = 'application/json';
		payload = JSON.stringify(payload);
	}
	const uuid = generateUuid();
	const requestId = uuid.replaceAll('-', '');
	const token = sessionStorage.getItem('auth_token');
	url = `${config.apiDomain}${url}`;
	try {
		const headers: HeadersInit = {
			'Accept': 'application/json',
			'X-Request-ID': requestId,
			'Authorization': `Bearer ${token}`
		};
		if (contentType) {
			headers['Content-Type'] = contentType;
		}
		const response = await fetch(url, {
			headers: headers,
			mode: 'cors',
			method: method,
			body: payload
		});
		return response.json();
	} catch (err) {
		return Promise.reject(err);
	}
}
