import { Scrollable } from 'vs/base/common/scrollable';

export interface IViewLayout {

	getScrollable(): Scrollable;
}

export class Viewport {
	readonly _viewportBrand: void = undefined;

	readonly top: number;
	readonly left: number;
	readonly width: number;
	readonly height: number;

	constructor(top: number, left: number, width: number, height: number) {
		this.top = top | 0;
		this.left = left | 0;
		this.width = width | 0;
		this.height = height | 0;
	}
}
