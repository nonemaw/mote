import { ConfigurationChangedEvent, EditorOption } from 'mote/editor/common/config/editorOptions';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { ScrollEvent } from 'vs/base/common/scrollable';

export const enum ViewEventType {
	ViewCompositionStart,
	ViewCompositionEnd,
	ViewConfigurationChanged,
	ViewCursorStateChanged,
	ViewDecorationsChanged,
	ViewFlushed,
	ViewFocusChanged,
	ViewLanguageConfigurationChanged,
	ViewLineMappingChanged,
	ViewLinesChanged,
	ViewLinesDeleted,
	ViewLinesInserted,
	ViewRevealRangeRequest,
	ViewScrollChanged,
	ViewThemeChanged,
	ViewTokensChanged,
	ViewTokensColorsChanged,
	ViewZonesChanged,
}

export class ViewCompositionStartEvent {
	public readonly type = ViewEventType.ViewCompositionStart;
	constructor() { }
}

export class ViewCompositionEndEvent {
	public readonly type = ViewEventType.ViewCompositionEnd;
	constructor() { }
}

export class ViewConfigurationChangedEvent {

	public readonly type = ViewEventType.ViewConfigurationChanged;

	public readonly _source: ConfigurationChangedEvent;

	constructor(source: ConfigurationChangedEvent) {
		this._source = source;
	}

	public hasChanged(id: EditorOption): boolean {
		return this._source.hasChanged(id);
	}
}

export class ViewCursorStateChangedEvent {

	public readonly type = ViewEventType.ViewCursorStateChanged;

	public readonly selections: EditorSelection[];

	constructor(selections: EditorSelection[]) {
		this.selections = selections;
	}
}

//#region lines change related events

export class ViewLinesChangedEvent {

	public readonly type = ViewEventType.ViewLinesChanged;

	constructor(
		/**
		 * The first line that has changed.
		 */
		public readonly fromLineNumber: number,
		/**
		 * The number of lines that have changed.
		 */
		public readonly count: number,
	) { }
}

export class ViewLinesInsertedEvent {

	public readonly type = ViewEventType.ViewLinesInserted;

	/**
	 * Before what line did the insertion begin
	 */
	public readonly fromLineNumber: number;
	/**
	 * `toLineNumber` - `fromLineNumber` + 1 denotes the number of lines that were inserted
	 */
	public readonly toLineNumber: number;

	constructor(fromLineNumber: number, toLineNumber: number) {
		this.fromLineNumber = fromLineNumber;
		this.toLineNumber = toLineNumber;
	}
}

export class ViewLinesDeletedEvent {

	public readonly type = ViewEventType.ViewLinesDeleted;

	/**
	 * At what line the deletion began (inclusive).
	 */
	public readonly fromLineNumber: number;
	/**
	 * At what line the deletion stopped (inclusive).
	 */
	public readonly toLineNumber: number;

	constructor(fromLineNumber: number, toLineNumber: number) {
		this.fromLineNumber = fromLineNumber;
		this.toLineNumber = toLineNumber;
	}
}

export class ViewScrollChangedEvent {

	public readonly type = ViewEventType.ViewScrollChanged;

	public readonly scrollWidth: number;
	public readonly scrollLeft: number;
	public readonly scrollHeight: number;
	public readonly scrollTop: number;

	public readonly scrollWidthChanged: boolean;
	public readonly scrollLeftChanged: boolean;
	public readonly scrollHeightChanged: boolean;
	public readonly scrollTopChanged: boolean;

	constructor(source: ScrollEvent) {
		this.scrollWidth = source.scrollWidth;
		this.scrollLeft = source.scrollLeft;
		this.scrollHeight = source.scrollHeight;
		this.scrollTop = source.scrollTop;

		this.scrollWidthChanged = source.scrollWidthChanged;
		this.scrollLeftChanged = source.scrollLeftChanged;
		this.scrollHeightChanged = source.scrollHeightChanged;
		this.scrollTopChanged = source.scrollTopChanged;
	}
}

//#endregion

export type ViewEvent = (
	ViewCompositionStartEvent
	| ViewCompositionEndEvent
	| ViewConfigurationChangedEvent
	| ViewCursorStateChangedEvent
	| ViewLinesChangedEvent
	| ViewLinesInsertedEvent
	| ViewLinesDeletedEvent
	| ViewScrollChangedEvent
);
