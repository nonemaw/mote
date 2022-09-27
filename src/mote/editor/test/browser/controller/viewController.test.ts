import * as assert from 'assert';
import { EditorConfiguration } from 'mote/editor/browser/config/editorConfiguration';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { collectValueFromSegment, ISegment } from 'mote/editor/common/segmentUtils';
import BlockStore from 'mote/platform/store/common/blockStore';
import { Pointer } from 'mote/platform/store/common/record';
import RecordCacheStore from 'mote/platform/store/common/recordCacheStore';
import RecordStore from 'mote/platform/store/common/recordStore';
import { IStoreService } from 'mote/platform/store/common/store';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';


class TestStoreService implements IStoreService {
	addSubscription(userId: string, pointer: Pointer): void {
	}

}


const storeService = new TestStoreService();


suite('Editor Controller - View Controller Commands', () => {
	test('view controller type command', () => {
		const [viewController, contentStore] = createViewController();

		// enter to create fist child store
		viewController.enter();

		// move to first line
		let lineNumber = 0;

		// type on first child
		viewController.type('1');

		const lineStore = StoreUtils.createStoreForLineNumber(lineNumber, contentStore);
		let segments: ISegment[] = lineStore.getTitleStore().getValue();
		assert.equal('1', collectValueFromSegment(segments));

		// move selection to doesn't exist line
		lineNumber++;
		let selection = viewController.getSelection();
		selection.lineNumber = lineNumber;
		viewController.select(selection);

		// type more character
		viewController.type('12');

		// nothing changed due to invalid line move
		segments = lineStore.getTitleStore().getValue();
		assert.equal('1', collectValueFromSegment(segments));

		// Move back
		selection = viewController.getSelection();
		selection.lineNumber = 0;
		viewController.select(selection);

		// type more character
		viewController.type('12');

		segments = lineStore.getTitleStore().getValue();
		assert.equal(1, segments.length);

	});

	test('view controller type on header', () => {
		const [viewController, contentStore] = createViewController();
		const pageStore = contentStore.recordStoreParentStore as BlockStore;

		viewController.select({ startIndex: 0, endIndex: 0, lineNumber: -1 });

		viewController.type('1');

		assert.equal('1', collectValueFromSegment(pageStore.getTitleStore().getValue()));


	});

	test('view controller isEmpty on header', () => {
		const [viewController] = createViewController();

		viewController.select({ startIndex: 0, endIndex: 0, lineNumber: -1 });

		viewController.type('1');

		assert.equal(false, viewController.isEmpty(-1));

	});
});

export function createViewController(): [ViewController, RecordStore<string[]>] {
	const config = new EditorConfiguration({}, document.createElement('div'));
	const store = new BlockStore({ table: 'page', id: '1' }, '1', [], RecordCacheStore.Default, storeService);
	const contentStore = store.getContentStore();
	const viewController = new ViewController(config, contentStore);
	return [viewController, contentStore];
}
