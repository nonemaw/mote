import * as browser from 'vs/base/browser/browser';
import * as platform from 'vs/base/common/platform';
import { ClipboardDataToCopy, EditableInput, EditableWrapper, IEditableInputHost } from 'mote/editor/browser/controller/editableInput';
import { ViewPart } from 'mote/editor/browser/view/viewPart';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { ITypeData, _debugComposition } from 'mote/editor/browser/controller/editableState';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { RangeUtils, TextSelection } from 'mote/editor/common/core/rangeUtils';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import { Color } from 'vs/base/common/color';

export interface EditableHandlerOptions {
	placeholder?: string;
	forcePlaceholder?: boolean;
}

export interface ICommandDelegate {

	isEmpty(lineNumber: number): boolean;
	getSelection(): TextSelection;
	type(text: string): void;
	compositionType(text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): void;
	select(e: TextSelection): void;
	backspace(): void;
	enter(): boolean;
}

interface IEditableHandlerStyles {
	textFillColor: Color;
}

export class EditableHandler extends ViewPart {

	public readonly editable: FastDomNode<HTMLDivElement>;
	private editableInput: EditableInput;
	private editableWrapper: EditableWrapper;

	private textFillColor: Color | undefined;

	constructor(
		private readonly lineNumber: number,
		context: ViewContext,
		private readonly command: ICommandDelegate,
		private readonly options: EditableHandlerOptions,
	) {
		super(context);
		this.editable = createFastDomNode(document.createElement('div'));
		this.editable.setAttribute('contenteditable', '');

		const editableInputHost: IEditableInputHost = {
			getDataToCopy: (): ClipboardDataToCopy => {
				return null as any;
			}
		};

		this.editableWrapper = this._register(new EditableWrapper(this.editable.domNode));
		this.editableInput = this._register(new EditableInput(editableInputHost, this.editableWrapper, platform.OS, browser, {}));
		this._applyStyles();
		this.registerListener();
	}

	public prepareRender(): void {

	}
	public render(): void {

	}

	/**
	 * Todo remove it later, use style instead
	 * @param style
	 */
	public applyStyles(style: CSSProperties) {
		setStyles(this.editable.domNode, style);
	}

	public style(style: IEditableHandlerStyles) {
		this.textFillColor = style.textFillColor;
		this._applyStyles();
	}

	private _applyStyles() {
		if (this.options.forcePlaceholder && this.options.placeholder) {
			this.editable.setAttribute('placeholder', this.options.placeholder);
			if (this.isEmpty() && this.textFillColor) {
				this.editable.domNode.style.webkitTextFillColor = this.textFillColor.toString();
			}
		}
	}

	public focusEditable(): void {
		this.editableInput.focusEditable();
	}

	public setEnabled(enabled: boolean) {
		if (enabled) {
			this.editable.setAttribute('contenteditable', 'true');
		} else {
			this.editable.setAttribute('contenteditable', 'false');
		}
	}

	public setValue(value: string) {
		this.editableWrapper.setValue('', value);
		const selection = this.command.getSelection();
		if (this.editableInput.isFocused() && selection.startIndex > 0) {
			this.ensureSelection(selection);
		}
	}

	private isEmpty() {
		return this.command.isEmpty(this.lineNumber);
	}

	//#region view event handlers

	//#endregion

	private registerListener() {
		this._register(this.editableInput.onType((e: ITypeData) => {
			if (e.replacePrevCharCnt || e.replaceNextCharCnt || e.positionDelta) {
				// must be handled through the new command
				if (_debugComposition) {
					console.log(` => compositionType: <<${e.type}>>, ${e.replacePrevCharCnt}, ${e.replaceNextCharCnt}, ${e.positionDelta}`);
				}
				this.command.compositionType(e.text, e.replacePrevCharCnt, e.replaceNextCharCnt, e.positionDelta);
			} else {
				if (_debugComposition) {
					console.log(` => type: <<${e.type}>>`);
				}
				this.command.type(e.text);
			}
			if (!this.isEmpty() && this.options.placeholder) {
				// remove placeholder text style
				this.editable.domNode.style.webkitTextFillColor = '';
			}
		}));
		this._register(this.editableInput.onKeyDown((e) => {
			const event = e as StandardKeyboardEvent;
			if (event.equals(KeyCode.Enter)) {
				if (this.command.enter()) {
					event.preventDefault();
				}
			}
			if (event.equals(KeyCode.Backspace)) {
				this.command.backspace();
			}
		}));
		this._register(this.editableInput.onSelectionChange((e) => {
			e.lineNumber = this.lineNumber;
			this.command.select(e);
		}));
		this._register(this.editableInput.onFocus((e) => {
			// wait 10ms for selection change
			setTimeout(() => {
				// force focus to set range
				this.editable.domNode.focus();
				const selection = this.command.getSelection();
				// line number less than 0 means view controller not initialized yet
				if (selection.lineNumber >= 0 && selection.startIndex >= 0) {
					this.ensureSelection(selection);
				}
			}, 10);

			if (this.options.placeholder && this.isEmpty()) {
				// add placeholder and placeholder text style
				this.editable.setAttribute('placeholder', this.options.placeholder);
				if (this.textFillColor) {
					this.editable.domNode.style.webkitTextFillColor = this.textFillColor.toString();
				}
			}
		}));
		this._register(this.editableInput.onBlur((e) => {
			if (this.options.placeholder && !(this.options.forcePlaceholder === true)) {
				this.editable.removeAttribute('placeholder');
			}
		}));
	}

	private ensureSelection(selection: TextSelection) {
		const rangeFromElement = RangeUtils.create(this.editable.domNode, selection);
		const rangeFromDocument = RangeUtils.get();
		if (!RangeUtils.ensureRange(rangeFromDocument, rangeFromElement)) {
			RangeUtils.set(rangeFromElement);
		}
	}
}
