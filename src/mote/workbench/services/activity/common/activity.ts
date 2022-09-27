import { ThemeIcon } from 'mote/platform/theme/common/themeService';

export interface IBadge {
	getDescription(): string;
}

class BaseBadge implements IBadge {

	constructor(readonly descriptorFn: (arg: any) => string) {
		this.descriptorFn = descriptorFn;
	}

	getDescription(): string {
		return this.descriptorFn(null);
	}
}

export class NumberBadge extends BaseBadge {

	constructor(readonly number: number, descriptorFn: (num: number) => string) {
		super(descriptorFn);

		this.number = number;
	}

	override getDescription(): string {
		return this.descriptorFn(this.number);
	}
}

export class TextBadge extends BaseBadge {

	constructor(readonly text: string, descriptorFn: () => string) {
		super(descriptorFn);
	}
}

export class IconBadge extends BaseBadge {
	constructor(readonly icon: ThemeIcon, descriptorFn: () => string) {
		super(descriptorFn);
	}
}

export class ProgressBadge extends BaseBadge { }
