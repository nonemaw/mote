import { ViewController } from 'mote/editor/browser/view/viewController';
import RecordStore from 'mote/platform/store/common/recordStore';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { ViewLayout } from 'mote/editor/common/viewLayout/viewLayout';

export class ViewContext {

	constructor(
		public readonly configuration: IEditorConfiguration,
		public readonly contentStore: RecordStore,
		public readonly viewLayout: ViewLayout,
		public readonly controller: ViewController
	) {

	}

	public addEventHandler(eventHandler: ViewEventHandler): void {
		this.controller.addViewEventHandler(eventHandler);
	}

	public removeEventHandler(eventHandler: ViewEventHandler): void {
		this.controller.removeViewEventHandler(eventHandler);
	}
}
