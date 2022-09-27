import { CSSProperties } from 'mote/base/browser/jsx';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import { ThemedColors } from 'mote/base/common/themes';
import { $, addDisposableListener, EventHelper, EventType, reset } from 'vs/base/browser/dom';
import { Gesture, EventType as TouchEventType } from 'vs/base/browser/touch';
import { Color } from 'vs/base/common/color';
import { Emitter, Event as BaseEvent } from 'vs/base/common/event';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { mixin } from 'vs/base/common/objects';
import { IThemable } from 'vs/base/common/styler';

export interface IButton extends IDisposable {
	readonly element: HTMLElement;
	readonly onDidClick: BaseEvent<Event | undefined>;
}

export interface IButtonOptions extends IButtonStyles {
	style?: CSSProperties;
	hoverStyle?: CSSProperties;
}

interface IButtonStyles {
	buttonBackground?: Color;
	buttonHoverBackground?: Color;
	buttonForeground?: Color;
	buttonBorderColor?: Color;
}

const defaultOptions: IButtonStyles = {
	//buttonBackground: Color.fromHex('#0E639C'),
	buttonHoverBackground: Color.fromHex('#37352f14'),
	buttonForeground: Color.white,
};

export class Button extends Disposable implements IButton {

	protected _element: HTMLElement;
	protected options: IButtonOptions;

	private buttonHoverBackground: Color | undefined;
	private buttonBackground: Color | undefined;

	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	constructor(container: HTMLElement, options?: IButtonOptions) {
		super();

		this.options = options || Object.create(null);
		mixin(this.options, defaultOptions, false);
		this.buttonHoverBackground = this.options.buttonHoverBackground;
		this.buttonBackground = this.options.buttonBackground;

		this._element = $('div');

		container.appendChild(this._element);

		this._register(Gesture.addTarget(this._element));

		[EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._register(addDisposableListener(this._element, eventType, e => {
				if (!this.enabled) {
					EventHelper.stop(e);
					return;
				}

				this._onDidClick.fire(e);
			}));
		});

		this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, e => {
			if (!this._element.classList.contains('disabled')) {
				this.setHoverBackground();
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, e => {
			this.applyStyles(); // restore standard styles
		}));

		this.applyStyles();
	}

	public style(style: IButtonStyles) {
		this.buttonHoverBackground = style.buttonHoverBackground;
		if (style.buttonBorderColor) {
			this.element.style.border = `1px solid ${style.buttonBorderColor}`;
		}

		this.applyStyles();
	}

	private setHoverBackground(): void {
		const style = Object.assign({
			backgroundColor: this.buttonHoverBackground?.toString()
		}, this.options.hoverStyle);
		setStyles(this._element, style);
	}

	private applyStyles(): void {
		if (this._element) {
			const style = Object.assign({
				cursor: 'pointer',
				backgroundColor: this.buttonBackground || '',
				transition: 'background 20ms ease-in 0s'
			}, this.options.style);
			setStyles(this._element, style);
		}
	}

	setChildren(...value: Array<Node | string>) {
		reset(this._element, ...value);
	}

	set enabled(value: boolean) {
		if (value) {
			this._element.classList.remove('disabled');
			this._element.setAttribute('aria-disabled', String(false));
			this._element.tabIndex = 0;
		} else {
			this._element.classList.add('disabled');
			this._element.setAttribute('aria-disabled', String(true));
		}
	}

	get enabled() {
		return !this._element.classList.contains('disabled');
	}

	focus(): void {
		this._element.focus();
	}

	get element(): HTMLElement {
		return this._element;
	}
}

interface ISwitchButtonStyles extends IButtonStyles {
	switchTurnOnBackground?: Color;
	switchTurnOffBackground?: Color;
	switchShadow?: Color;
	circleBackground?: Color;
	circleShadow?: Color;
}


export class SwitchButton extends Disposable implements IThemable {

	private button: Button;

	public onDidSwitch: BaseEvent<Event>;

	private _turnOn: boolean;

	private switcherDomNode: HTMLElement;
	private circleDomNode: HTMLElement;

	private styles: ISwitchButtonStyles = {};

	constructor(parent: HTMLElement, turnOn = false) {
		super();

		this.button = new Button(parent);
		this.onDidSwitch = this.button.onDidClick;
		this._turnOn = turnOn;

		this.button.onDidClick(() => {
			this._turnOn = !this._turnOn;
			this.update();
		});

		this.switcherDomNode = document.createElement('div');
		this.circleDomNode = document.createElement('div');
		this.switcherDomNode.appendChild(this.circleDomNode);
		this.button.element.appendChild(this.switcherDomNode);

		setStyles(this.switcherDomNode, this.getStyle());
		setStyles(this.circleDomNode, this.getCircleStyle());
	}

	public style(styles: ISwitchButtonStyles) {
		this.styles = styles;
		this.button.style(styles);
		this.update();
	}

	private update() {
		const translateXArg = this.turnOn ? 16 - 2 * this.getCircleSpacing() : 0;

		const swictherBackground = this.turnOn ? `${this.styles.switchTurnOnBackground}` : `${this.styles.switchTurnOffBackground}`;
		//const circleBackground = this.turnOn ? ThemedColors.blue : ThemedColors.white;
		const switchBoxShadow = this.turnOn ? '' : `inset 0 0 0 1px ${this.styles.switchShadow}`;

		this.switcherDomNode.style.background = swictherBackground;
		this.switcherDomNode.style.boxShadow = switchBoxShadow;

		//this.circleDomNode.style.background = circleBackground;
		this.circleDomNode.style.transform = `translateX(${translateXArg}px)`;

	}

	private getStyle(): CSSProperties {
		return {
			display: 'flex',
			flexShrink: 0,
			height: `${18 - 2 * this.getCircleSpacing()}px`,
			width: `${30 - 2 * this.getCircleSpacing()}px`,
			borderRadius: '44px',
			padding: `${this.getCircleSpacing()}px`,
			boxSizing: 'content-box',
			boxShadow: this._turnOn ? '' : `inset 0 0 0 1px ${this.styles.switchShadow}`,
			transition: 'background 200ms, box-shadow 200ms'
		};
	}

	private getCircleStyle() {
		const translateXArg = this.turnOn ? 16 - 2 * this.getCircleSpacing() : 0;
		const size = 18 - 2 * this.getCircleSpacing();
		return {
			width: `${size}px`,
			height: `${size}px`,
			borderRadius: '44px',
			background: ThemedColors.white,
			transition: 'transform 200ms ease-out, background 200ms ease-out',
			transform: `translateX(${translateXArg}px)`
		};
	}

	private getCircleSpacing() {
		return 2;
	}

	get turnOn() {
		return this._turnOn;
	}

	getContainer() {
		return this.button.element;
	}
}
