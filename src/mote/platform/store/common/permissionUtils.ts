import { Lodash } from 'mote/base/common/lodash';
import { Permission, PermissionRecord, Role } from 'mote/platform/store/common/record';

export class PermissionUtils {

	static canPublicView(permissions: PermissionRecord[]) {
		if (!permissions) {
			return false;
		}
		return Lodash.any(permissions, (permission) => permission.type === Permission.Public);
	}

	static canRead(role: Role) {
		return role === Role.Reader || role === Role.CommmetOnly || role === Role.ReadAndWrite || role === Role.Editor;
	}

	static canComment(role: Role) {
		return role === Role.CommmetOnly || role === Role.ReadAndWrite || role === Role.Editor;
	}

	static canEdit(role: Role) {
		return role === Role.ReadAndWrite || role === Role.Editor;
	}
}
