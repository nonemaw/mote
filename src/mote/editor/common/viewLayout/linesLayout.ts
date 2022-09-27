import { Event } from 'vs/base/common/event';
import { ElementSizeObserver } from 'mote/editor/browser/config/elementSizeObserver';
import { Disposable } from 'vs/base/common/lifecycle';

/**
 * Layouting of objects that take vertical space (by having a height) and push down other objects.
 *
 * These objects are basically either text (lines) or spaces between those lines (whitespaces).
 * This provides commodity operations for working with lines that contain whitespace that pushes lines lower (vertically).
 */
export class LinesLayout extends Disposable {

	private readonly containerObserver: ElementSizeObserver;

	public readonly onDidChange: Event<void>;

	constructor(
		container: HTMLElement
	) {
		super();
		this.containerObserver = this._register(new ElementSizeObserver(container, undefined));

		this.containerObserver.startObserving();

		this.onDidChange = this.containerObserver.onDidChange;
	}
}
