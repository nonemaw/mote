import { Event } from 'vs/base/common/event';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { Position } from 'mote/editor/common/core/position';
import { TextSelection } from 'mote/editor/common/core/rangeUtils';
import * as editorCommon from 'mote/editor/common/editorCommon';
import BlockStore from 'mote/platform/store/common/blockStore';
import { FastDomNode } from 'vs/base/browser/fastDomNode';

/**
 * Type of hit element with the mouse in the editor.
 */
export const enum MouseTargetType {
	/**
	 * Mouse is on top of an unknown element.
	 */
	UNKNOWN,
	/**
	 * Mouse is on top of the glyph margin
	 */
	GUTTER_GLYPH_MARGIN,
	/**
	 * Mouse is on top of the line numbers
	 */
	GUTTER_LINE_NUMBERS,
	/**
	 * Mouse is on top of the line decorations
	 */
	GUTTER_LINE_DECORATIONS,
	/**
	 * Mouse is on top of the whitespace left in the gutter by a view zone.
	 */
	GUTTER_VIEW_ZONE,
	/**
	 * Mouse is on top of text in the content.
	 */
	CONTENT_TEXT,
	/**
	 * Mouse is on top of empty space in the content (e.g. after line text or below last line)
	 */
	CONTENT_EMPTY,
	/**
	 * Mouse is on top of a view zone in the content.
	 */
	CONTENT_VIEW_ZONE,
	/**
	 * Mouse is on top of a content widget.
	 */
	CONTENT_WIDGET,
	/**
	 * Mouse is on top of the decorations overview ruler.
	 */
	OVERVIEW_RULER,
	/**
	 * Mouse is on top of a scrollbar.
	 */
	SCROLLBAR,
	/**
	 * Mouse is on top of an overlay widget.
	 */
	OVERLAY_WIDGET,
	/**
	 * Mouse is outside of the editor.
	 */
	OUTSIDE_EDITOR,
}

export interface IBaseMouseTarget {
	/**
	 * The target element
	 */
	readonly element: Element | null;
	/**
	 * The 'approximate' editor position
	 */
	readonly position: Position | null;
	/**
	 * Desired mouse column (e.g. when position.column gets clamped to text length -- clicking after text on a line).
	 */
	readonly mouseColumn: number;
	/**
	 * The 'approximate' editor range
	 */
	readonly range: EditorRange | null;
}

export interface IMouseTargetUnknown extends IBaseMouseTarget {
	readonly type: MouseTargetType.UNKNOWN;
}

export interface IMouseTargetContentTextData {
	readonly mightBeForeignElement: boolean;
	/**
	 * @internal
	 */
	readonly injectedText: any | null;
}

export interface IMouseTargetContentText extends IBaseMouseTarget {
	readonly type: MouseTargetType.CONTENT_TEXT;
	readonly position: Position;
	readonly range: EditorRange;
	readonly detail: IMouseTargetContentTextData;
}

/**
 * Target hit with the mouse in the editor.
 */
export type IMouseTarget = (
	IMouseTargetUnknown
	| IMouseTargetContentText
);

/**
 * A positioning preference for rendering overlay widgets.
 */
export const enum OverlayWidgetPositionPreference {
	/**
	 * Position the overlay widget in the top right corner
	 */
	TOP_RIGHT_CORNER,

	/**
	 * Position the overlay widget in the bottom right corner
	 */
	BOTTOM_RIGHT_CORNER,

	/**
	 * Position the overlay widget in the top center
	 */
	TOP_CENTER
}
/**
 * A position for rendering overlay widgets.
 */
export interface IOverlayWidgetPosition {
	/**
	 * The position preference for the overlay widget.
	 */
	preference: OverlayWidgetPositionPreference | null;
}
/**
 * An overlay widgets renders on top of the text.
 */
export interface IOverlayWidget {
	/**
	 * Get a unique identifier of the overlay widget.
	 */
	getId(): string;
	/**
	 * Get the dom node of the overlay widget.
	 */
	getDomNode(): HTMLElement;
	/**
	 * Get the placement of the overlay widget.
	 * If null is returned, the overlay widget is responsible to place itself.
	 */
	getPosition(): IOverlayWidgetPosition | null;
}


/**
 * A rich code editor.
 */
export interface IMoteEditor extends editorCommon.IEditor {

	readonly onDidChangeSelection: Event<TextSelection>;

	/**
	 * Add an overlay widget. Widgets must have unique ids, otherwise they will be overwritten.
	 */
	addOverlayWidget(widget: IOverlayWidget): void;

	setStore(store: BlockStore): void;

	getStore(): BlockStore | null;

	/**
	 * Directly trigger a handler or an editor action.
	 * @param source The source of the call.
	 * @param handlerId The id of the handler or the id of a contribution.
	 * @param payload Extra data to be sent to the handler.
	 */
	trigger(source: string | null | undefined, handlerId: string, payload: any): void;
}


export interface IViewLineContribution {
	setValue(store: BlockStore): void;
	getDomNode(): FastDomNode<HTMLElement>;
}
