import { setStyles } from 'mote/base/browser/jsx/createElement';
import fonts from 'mote/base/browser/ui/fonts';
import { Color } from 'vs/base/common/color';
import { IThemable } from 'vs/base/common/styler';

export interface IItemContainerOptions {
	isSmall?: boolean;
	isInline?: boolean;
	isSecondaryColor?: boolean;
}

interface IItemContainerStyles {
	lightTextColor?: Color;
	mediumTextColor?: Color;
	regularTextColor?: Color;
}


export class ItemContainer implements IThemable {
	private domNode: HTMLElement;

	constructor(private readonly options: IItemContainerOptions = {}) {
		if (options.isInline) {
			this.domNode = document.createElement('span');
		} else {
			this.domNode = document.createElement('div');
		}
		setStyles(this.domNode, this.getStyle());
	}

	private getStyle() {
		return Object.assign({}, this.getFontSize());
	}

	private getFontSize() {
		const fontSize = this.options.isSmall ? fonts.fontSize.UISmall.desktop : fonts.fontSize.UIRegular.desktop;
		return { fontSize: `${fontSize}px` };
	}


	getContainer() {
		return this.domNode;
	}

	style(style: IItemContainerStyles) {

		const regularColor = style.regularTextColor ? `${style.regularTextColor}` : '';
		const mediumTextColor = style.mediumTextColor ? `${style.mediumTextColor}` : '';

		const color = this.options.isSmall ? mediumTextColor : regularColor;

		this.domNode.style.color = color;
	}
}
