export interface IUserProfile {
	readonly id: string;
	readonly name: string;
	readonly email?: string;
	readonly token: string;
}

export const LOCAL_USER = 'local';
export const GUEST_USER = 'guest';

export function isLocalUser(userId: string) {
	return userId === LOCAL_USER;
}

export function isGuestUser(userId: string) {
	return userId === GUEST_USER;
}
