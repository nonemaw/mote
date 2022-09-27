import * as dom from 'vs/base/browser/dom';
import * as strings from 'vs/base/common/strings';
import { nodeToString } from 'mote/editor/common/textSerialize';
import { Emitter, Event } from 'vs/base/common/event';
import { getSelectionFromRange, TextSelection } from 'mote/editor/common/core/selectionUtils';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { IKeyboardEvent, StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { EditableState, IEditableWrapper, ITypeData, _debugComposition } from 'mote/editor/browser/controller/editableState';
import { OperatingSystem } from 'vs/base/common/platform';
import { KeyCode } from 'vs/base/common/keyCodes';

interface EditableOptions {
	getSelection?(): TextSelection | undefined;
	placeholder?: string;
}

export interface ClipboardStoredMetadata {
	version: 1;
	isFromEmptySelection: boolean | undefined;
	multicursorText: string[] | null | undefined;
	mode: string | null;
}

export interface IPasteData {
	text: string;
	metadata: ClipboardStoredMetadata | null;
}

export interface ClipboardDataToCopy {
	isFromEmptySelection: boolean;
	multicursorText: string[] | null | undefined;
	text: string;
	html: string | null | undefined;
	mode: string | null;
}

export interface IEditableInputHost {
	getDataToCopy(): ClipboardDataToCopy;
	//getScreenReaderContent(currentState: TextAreaState): TextAreaState;
	//deduceModelPosition(viewAnchorPosition: Position, deltaOffset: number, lineFeedCnt: number): Position;
}

interface InMemoryClipboardMetadata {
	lastCopiedValue: string;
	data: ClipboardStoredMetadata;
}

/**
 * Every time we write to the clipboard, we record a bit of extra metadata here.
 * Every time we read from the cipboard, if the text matches our last written text,
 * we can fetch the previous metadata.
 */
export class InMemoryClipboardMetadataManager {
	public static readonly INSTANCE = new InMemoryClipboardMetadataManager();

	private _lastState: InMemoryClipboardMetadata | null;

	constructor() {
		this._lastState = null;
	}

	public set(lastCopiedValue: string, data: ClipboardStoredMetadata): void {
		this._lastState = { lastCopiedValue, data };
	}

	public get(pastedText: string): ClipboardStoredMetadata | null {
		if (this._lastState && this._lastState.lastCopiedValue === pastedText) {
			// match!
			return this._lastState.data;
		}
		this._lastState = null;
		return null;
	}
}

export interface ICompositionStartEvent {
	data: string;
}

export interface ICompleteEditableWrapper extends IEditableWrapper {
	readonly onInput: Event<InputEvent>;
	readonly onClick: Event<MouseEvent>;
	readonly onKeyDown: Event<KeyboardEvent>;
	readonly onFocus: Event<FocusEvent>;
	readonly onBlur: Event<FocusEvent>;

	setIgnoreSelectionChangeTime(reason: string): void;
	getIgnoreSelectionChangeTime(): number;
	resetSelectionChangeTime(): void;

	hasFocus(): boolean;
}

export interface IBrowser {
	isAndroid: boolean;
	isFirefox: boolean;
	isChrome: boolean;
	isSafari: boolean;
}

class CompositionContext {

	private _lastTypeTextLength: number;

	constructor() {
		this._lastTypeTextLength = 0;
	}

	public handleCompositionUpdate(text: string | null | undefined): ITypeData {
		text = text || '';
		const typeInput: ITypeData = {
			text: text,
			replacePrevCharCnt: this._lastTypeTextLength,
			replaceNextCharCnt: 0,
			positionDelta: 0,
			type: ''
		};
		this._lastTypeTextLength = text.length;
		return typeInput;
	}
}

export class EditableInput extends Disposable {

	//#region events

	private _onFocus = this._register(new Emitter<void>());
	public readonly onFocus: Event<void> = this._onFocus.event;

	private _onBlur = this._register(new Emitter<void>());
	public readonly onBlur: Event<void> = this._onBlur.event;

	private _onKeyDown = this._register(new Emitter<IKeyboardEvent>());
	public readonly onKeyDown: Event<IKeyboardEvent> = this._onKeyDown.event;

	private _onKeyUp = this._register(new Emitter<IKeyboardEvent>());
	public readonly onKeyUp: Event<IKeyboardEvent> = this._onKeyUp.event;

	private _onCut = this._register(new Emitter<void>());
	public readonly onCut: Event<void> = this._onCut.event;

	private _onPaste = this._register(new Emitter<IPasteData>());
	public readonly onPaste: Event<IPasteData> = this._onPaste.event;

	private _onType = this._register(new Emitter<ITypeData>());
	public readonly onType: Event<ITypeData> = this._onType.event;

	private _onClick = this._register(new Emitter<void>());
	public readonly onClick: Event<void> = this._onClick.event;

	private _onSelectionChange = this._register(new Emitter<TextSelection>());
	public readonly onSelectionChange: Event<TextSelection> = this._onSelectionChange.event;

	//#endregion

	private _onDidChange = this._register(new Emitter<string>());
	public readonly onDidChange: Event<string> = this._onDidChange.event;

	private editableState: EditableState = EditableState.EMPTY;
	private selectionChangeListener: IDisposable | null = null;

	private hasFocus: boolean = false;
	private currentComposition: CompositionContext | null = null;

	constructor(
		host: IEditableInputHost,
		private readonly editable: ICompleteEditableWrapper,
		private readonly OS: OperatingSystem,
		browser: IBrowser,
		options: EditableOptions
	) {
		super();

		this.registerListener();
	}

	private registerListener() {
		let lastKeyDown: IKeyboardEvent | null = null;

		this._register(this.editable.onInput((e) => {
			if (_debugComposition) {
				console.log(`[input]`, e);
			}

			if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
				return;
			}

			const newState = EditableState.readFromEditable(this.editable);
			const typeInput = EditableState.deduceInput(this.editableState, newState, /*couldBeEmojiInput*/this.OS === OperatingSystem.Macintosh);

			if (typeInput.replacePrevCharCnt === 0 && typeInput.text.length === 1 && strings.isHighSurrogate(typeInput.text.charCodeAt(0))) {
				// Ignore invalid input but keep it around for next time
				return;
			}
			this.editableState = newState;
			if (
				typeInput.text !== ''
				|| typeInput.replacePrevCharCnt !== 0
				|| typeInput.replaceNextCharCnt !== 0
				|| typeInput.positionDelta !== 0
			) {
				this._onType.fire(typeInput);
			}
		}));

		this._register(this.editable.onKeyDown((e) => {
			const event = new StandardKeyboardEvent(e);
			if (event.keyCode === KeyCode.KEY_IN_COMPOSITION
				|| (this.currentComposition && event.keyCode === KeyCode.Backspace)) {
				// Stop propagation for keyDown events if the IME is processing key input
				event.stopPropagation();
			}
			if (event.equals(KeyCode.Escape)) {
				// Prevent default always for `Esc`, otherwise it will generate a keypress
				// See https://msdn.microsoft.com/en-us/library/ie/ms536939(v=vs.85).aspx
				event.preventDefault();
			}

			lastKeyDown = event;
			this._onKeyDown.fire(event);
		}));

		this._register(this.editable.onFocus(() => {
			this.setHasFocus(true);
		}));
		this._register(this.editable.onBlur(() => {
			this.setHasFocus(false);
		}));
		this._register(this.editable.onClick(() => {
			this._onClick.fire();
		}));

		if (lastKeyDown) {

		}
	}

	private installSelectionChangeListener(): IDisposable {
		// `selectionchange` events often come multiple times for a single logical change
		// so throttle multiple `selectionchange` events that burst in a short period of time.
		let previousSelectionChangeEventTime = 0;
		return dom.addDisposableListener(document, 'selectionchange', (e) => {
			if (!this.hasFocus) {
				return;
			}

			const now = Date.now();

			const delta1 = now - previousSelectionChangeEventTime;
			previousSelectionChangeEventTime = now;
			if (delta1 < 5) {
				// received another `selectionchange` event within 5ms of the previous `selectionchange` event
				// => ignore it
				return;
			}

			const delta2 = now - this.editable.getIgnoreSelectionChangeTime();
			this.editable.resetSelectionChangeTime();
			if (delta2 < 100) {
				// received a `selectionchange` event within 100ms since we touched the textarea
				// => ignore it, since we caused it
				return;
			}

			const selectionWithOptions = getSelectionFromRange();
			if (selectionWithOptions) {
				this._onSelectionChange.fire(selectionWithOptions.selection);
			}
		});
	}

	public focusEditable(): void {
		// Setting this.hasFocus and writing the screen reader content
		// will result in a focus() and setSelectionRange() in the textarea
		this.setHasFocus(true);

		// If the editor is off DOM, focus cannot be really set, so let's double check that we have managed to set the focus
		//this.refreshFocusState();
	}

	public isFocused(): boolean {
		return this.hasFocus;
	}

	private setHasFocus(newHasFocus: boolean): void {
		if (this.hasFocus === newHasFocus) {
			// no change
			return;
		}
		this.hasFocus = newHasFocus;

		if (this.selectionChangeListener) {
			this.selectionChangeListener.dispose();
			this.selectionChangeListener = null;
		}
		if (this.hasFocus) {
			this.selectionChangeListener = this.installSelectionChangeListener();
		}

		if (this.hasFocus) {
			this._onFocus.fire();
		} else {
			this._onBlur.fire();
		}
	}

	public override dispose(): void {
		super.dispose();
		if (this.selectionChangeListener) {
			this.selectionChangeListener.dispose();
			this.selectionChangeListener = null;
		}
	}

}

export class EditableWrapper extends Disposable implements ICompleteEditableWrapper {
	//#region events

	public readonly onKeyDown = this._register(dom.createEventEmitter(this._actual, 'keydown')).event;
	public readonly onKeyPress = this._register(dom.createEventEmitter(this._actual, 'keypress')).event;
	public readonly onKeyUp = this._register(dom.createEventEmitter(this._actual, 'keyup')).event;
	public readonly onCompositionStart = this._register(dom.createEventEmitter(this._actual, 'compositionstart')).event;
	public readonly onCompositionUpdate = this._register(dom.createEventEmitter(this._actual, 'compositionupdate')).event;
	public readonly onCompositionEnd = this._register(dom.createEventEmitter(this._actual, 'compositionend')).event;
	public readonly onBeforeInput = this._register(dom.createEventEmitter(this._actual, 'beforeinput')).event;
	public readonly onInput = <Event<InputEvent>>this._register(dom.createEventEmitter(this._actual, 'input')).event;
	public readonly onCut = this._register(dom.createEventEmitter(this._actual, 'cut')).event;
	public readonly onCopy = this._register(dom.createEventEmitter(this._actual, 'copy')).event;
	public readonly onPaste = this._register(dom.createEventEmitter(this._actual, 'paste')).event;
	public readonly onFocus = this._register(dom.createEventEmitter(this._actual, 'focus')).event;
	public readonly onBlur = this._register(dom.createEventEmitter(this._actual, 'blur')).event;
	public readonly onClick = this._register(dom.createEventEmitter(this._actual, 'click')).event;

	//#endregion

	private _ignoreSelectionChangeTime: number = 0;

	constructor(
		private readonly _actual: HTMLDivElement
	) {
		super();
	}

	public hasFocus(): boolean {
		const shadowRoot = dom.getShadowRoot(this._actual);
		if (shadowRoot) {
			return shadowRoot.activeElement === this._actual;
		} else if (dom.isInDOM(this._actual)) {
			return document.activeElement === this._actual;
		} else {
			return false;
		}
	}

	public setIgnoreSelectionChangeTime(reason: string): void {
		this._ignoreSelectionChangeTime = Date.now();
	}

	public getIgnoreSelectionChangeTime(): number {
		return this._ignoreSelectionChangeTime;
	}

	public resetSelectionChangeTime(): void {
		this._ignoreSelectionChangeTime = 0;
	}

	getValue(): string {
		return nodeToString(this._actual);
	}

	setValue(reason: string, value: string): void {
		const editable = this._actual;
		if (editable.innerHTML === value) {
			// No change
			return;
		}
		editable.innerHTML = value;
	}
	getSelection(): TextSelection {
		const selectionWithOptions = getSelectionFromRange();
		if (selectionWithOptions) {
			return selectionWithOptions?.selection;
		}
		return { startIndex: 0, endIndex: 0, lineNumber: -1 };
	}
	getSelectionStart(): number {
		const selectionWithOptions = getSelectionFromRange();
		if (selectionWithOptions) {
			return selectionWithOptions?.selection.startIndex;
		}
		return 0;
	}
	getSelectionEnd(): number {
		const selectionWithOptions = getSelectionFromRange();
		if (selectionWithOptions) {
			return selectionWithOptions?.selection.endIndex;
		}
		return 0;
	}
	setSelectionRange(reason: string, selectionStart: number, selectionEnd: number): void {
		throw new Error('Method not implemented.');
	}
}
