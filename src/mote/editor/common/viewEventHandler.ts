import { Disposable } from 'vs/base/common/lifecycle';
import * as viewEvents from 'mote/editor/common/viewEvents';


export class ViewEventHandler extends Disposable {
	private _shouldRender: boolean = true;

	public shouldRender(): boolean {
		return this._shouldRender;
	}

	public forceShouldRender(): void {
		this._shouldRender = true;
	}

	protected setShouldRender(): void {
		this._shouldRender = true;
	}

	public onDidRender(): void {
		this._shouldRender = false;
	}

	// --- begin event handlers

	public handleEvents(events: viewEvents.ViewEvent[]): void {
		let shouldRender = false;

		for (let i = 0, len = events.length; i < len; i++) {
			const e = events[i];

			switch (e.type) {
				case viewEvents.ViewEventType.ViewLinesChanged:
					if (this.onLinesChanged(e)) {
						shouldRender = true;
					}
					break;
				case viewEvents.ViewEventType.ViewLinesInserted:
					if (this.onLinesInserted(e)) {
						shouldRender = true;
					}
					break;
				case viewEvents.ViewEventType.ViewScrollChanged:
					if (this.onScrollChanged(e)) {
						shouldRender = true;
					}
					break;
				case viewEvents.ViewEventType.ViewConfigurationChanged:
					if (this.onConfigurationChanged(e)) {
						shouldRender = true;
					}
					break;
				case viewEvents.ViewEventType.ViewLinesDeleted:
					if (this.onLinesDeleted(e)) {
						shouldRender = true;
					}
					break;
			}
		}

		if (shouldRender) {
			this._shouldRender = true;
		}
	}

	public onConfigurationChanged(e: viewEvents.ViewConfigurationChangedEvent): boolean {
		return false;
	}

	public onLinesChanged(e: viewEvents.ViewLinesChangedEvent): boolean {
		return false;
	}
	public onLinesDeleted(e: viewEvents.ViewLinesDeletedEvent): boolean {
		return false;
	}
	public onLinesInserted(e: viewEvents.ViewLinesInsertedEvent): boolean {
		return false;
	}

	public onScrollChanged(e: viewEvents.ViewScrollChangedEvent): boolean {
		return false;
	}
}
