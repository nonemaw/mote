import { Color } from 'vs/base/common/color';
import SVGData from './svgdata';

export interface ISVGIconStyles {
	iconFill?: Color;
	width?: string;
	height?: string;
}

export type SVGProperty = keyof typeof SVGData;

export class SVGIcon {

	private _element: SVGSVGElement;

	private iconFill: Color | undefined;

	constructor(name: SVGProperty) {
		const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		element.style.width = '100%';
		element.style.height = '100%';
		element.style.display = 'block';
		element.style.flexShrink = '0';

		const data = SVGData[name];
		element.setAttribute('viewBox', data.viewBox);
		element.classList.add(data.className);
		element.appendChild(data.svg.cloneNode(true));

		this._element = element;
	}

	get element() {
		return this._element;
	}

	style(styles: ISVGIconStyles): void {
		this.iconFill = styles.iconFill;
		if (styles.height) {
			this._element.style.height = styles.height;
		}
		if (styles.width) {
			this._element.style.width = styles.width;
		}

		this.applyStyles();
	}

	private applyStyles(): void {
		if (this._element) {
			const iconFill = this.iconFill ? this.iconFill.toString() : '';
			this._element.style.fill = iconFill;
		}
	}
}
