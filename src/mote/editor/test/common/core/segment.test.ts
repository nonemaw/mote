import * as assert from 'assert';
import { Segment } from 'mote/editor/common/core/segment';
import { TextSelectionMode, TextSelectionState } from 'mote/editor/common/core/selectionUtils';
import { ISegment } from 'mote/editor/common/segmentUtils';
import { createViewController } from 'mote/editor/test/browser/controller/viewController.test';
import RecordStore from 'mote/platform/store/common/recordStore';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';


suite('Editor Core - Segment', () => {
	test('segment update with annotation', () => {
		const lineNumber = 0;
		const [viewController, contentStore] = createViewController();

		// enter to create fist child store
		viewController.enter();

		const lineStore = StoreUtils.createStoreForLineNumber(lineNumber, contentStore);

		viewController.type('1');
		viewController.type('12');
		const textSelectionState = createTextSelectionState(0, 2, lineNumber, lineStore.getTitleStore());

		// case: update annotations in segment without any annotations
		Segment.update(textSelectionState, ['c']);
		let segments: ISegment[] = lineStore.getTitleStore().getValue();
		assert.equal(1, segments.length);
		assert.deepEqual([['12', [['c']]]], segments);

		// case: update annotations in segment without same annotations
		Segment.update(textSelectionState, ['c']);
		segments = lineStore.getTitleStore().getValue();
		assert.equal(segments.length, 1);
		assert.deepEqual(segments, [['12']]);

	});

	test('segment merge', () => {
		const segments: ISegment[] = [['1'], ['2']];
		const result = Segment.merge(segments, { startIndex: 0, endIndex: 2, lineNumber: 0 }, ['c']);
		assert.equal(result.length, 1, 'Merge segments with same annotations will combine it');
		assert.deepEqual(result, [['12', [['c']]]]);
	});
});

function createTextSelectionState(start: number, end: number, lineNumber: number, store?: RecordStore): TextSelectionState {
	return { store, mode: TextSelectionMode.Editing, selection: { startIndex: start, endIndex: end, lineNumber: lineNumber } };
}
