/* eslint-disable code-no-unexternalized-strings */
import { CSSProperties } from 'mote/base/browser/jsx';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import * as DOM from 'vs/base/browser/dom';
import { addDisposableListener, EventType, IFocusTracker, trackFocus } from 'vs/base/browser/dom';
import { EventType as TouchEventType, Gesture } from 'vs/base/browser/touch';
import { Color } from 'vs/base/common/color';
import { Emitter, Event as BaseEvent } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';


export interface ListItemOptions {
	enableClick: boolean;
	style?: CSSProperties;
	isMobile?: boolean;
}

interface IListItemStyles {
	hoverBackground: Color;
}

export class ListItem extends Disposable {

	private options: ListItemOptions;

	protected _element: HTMLElement;

	private leftContainer?: HTMLElement;
	private rightContainer?: HTMLElement;
	private iconContainer?: HTMLElement;
	private childContainer?: HTMLElement;

	private hoverBackground: Color | undefined;

	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	private focusTracker: IFocusTracker;

	constructor(element: HTMLElement, options: ListItemOptions) {
		super();

		this.options = options;

		this._element = element;
		setStyles(this._element, this.getStyle());

		this._register(Gesture.addTarget(this._element));

		// Click event
		[DOM.EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._register(DOM.addDisposableListener(this._element, eventType, e => {
				if (!options.enableClick) {
					DOM.EventHelper.stop(e);
					return;
				}
				this._onDidClick.fire(e);
			}));
		});

		this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, e => {
			if (!this._element.classList.contains('disabled')) {
				this.updateByState(true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, e => {
			this.updateByState(false); // restore standard styles
		}));

		// Also set hover background when button is focused for feedback
		this.focusTracker = this._register(trackFocus(this._element));
		this._register(this.focusTracker.onDidFocus(() => this.updateByState(true)));
		this._register(this.focusTracker.onDidBlur(() => this.updateByState(false))); // restore standard styles
	}

	public create() {
		if (this.leftContainer) {
			this._element.append(this.leftContainer);
		}
		if (this.iconContainer) {
			setStyles(this.iconContainer, this.getIconStyle());
			this._element.append(this.iconContainer);
		}
		if (this.childContainer) {
			this._element.append(this.childContainer);
		}
		if (this.rightContainer) {
			this._element.append(this.rightContainer);
		}
	}

	public set left(value: HTMLElement) {
		if (!this.leftContainer) {
			this.leftContainer = DOM.$("");
		}
		if (this.leftContainer.lastChild) {
			this.leftContainer.removeChild(this.leftContainer.lastChild);
		}
		this.leftContainer.append(value);
	}

	public set icon(value: HTMLElement) {
		if (!this.iconContainer) {
			this.iconContainer = DOM.$("");
		}
		if (this.iconContainer.lastChild) {
			this.iconContainer.removeChild(this.iconContainer.lastChild);
		}
		this.iconContainer.append(value);
	}

	public set right(value: HTMLElement) {

	}

	public set child(value: HTMLElement) {
		if (!this.childContainer) {
			this.childContainer = DOM.$('');
		}
		this.update(this.childContainer, value);
	}

	private update(container: HTMLElement, value: HTMLElement) {
		if (container.lastChild) {
			container.removeChild(container.lastChild);
		}
		container.append(value);
	}

	private updateByState(focused: boolean) {
		if (focused && this.hoverBackground) {
			this._element.style.backgroundColor = this.hoverBackground.toString();
		} else {
			this._element.style.backgroundColor = '';
		}
	}

	public style(styles: IListItemStyles) {
		this.hoverBackground = styles.hoverBackground;
		//this.applyStyles();
	}

	getStyle() {
		const style = Object.assign({}, styles.column_wrapStyle) as CSSProperties;
		if (this.options.style?.paddingLeft && "number" === typeof (this.options.style.paddingLeft)) {
			style.paddingLeft = this.options.style.paddingLeft;
		}
		return Object.assign({}, style, this.options.style);
	}

	getLeftStyle() {
		return {
			flexShrink: 0,
			flexGrow: 0,
			borderRadius: '3px',
			//color: themedStyles.mediumTextColor,
			width: this.options.isMobile ? '26px' : '22px',
			height: this.options.isMobile ? '24px' : '22px',
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			//marginRight: props.icon ? 0 : 8
		};
	}

	getIconStyle() {
		return {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			flexGrow: 0,
			width: this.options.isMobile ? "28px" : "22px",
			height: this.options.isMobile ? "24px" : "18px",
			marginRight: "4px"
		};
	}
}

const styles = {
	column_wrapStyle: {
		display: "flex",
		alignItems: "center",
		minHeight: "27px",
		fontSize: "14px",
		paddingTop: "2px",
		paddingBottom: "2px",
		paddingLeft: "14px",
		paddingRight: "14px",
		cursor: "pointer"
	}
}
