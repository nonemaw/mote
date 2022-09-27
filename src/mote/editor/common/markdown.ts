import { Lodash } from 'mote/base/common/lodash';
import { EditOperation } from 'mote/editor/common/core/editOperation';
import { TextSelection } from 'mote/editor/common/core/selectionUtils';
import { Transaction } from 'mote/editor/common/core/transaction';
import { collectValueFromSegment } from 'mote/editor/common/segmentUtils';
import BlockStore from 'mote/platform/store/common/blockStore';
import { BlockTypes } from 'mote/platform/store/common/record';
import RecordStore from 'mote/platform/store/common/recordStore';

export interface ICommandExecutor {
	readonly store: RecordStore;
	readonly selection: TextSelection;
	readonly transaction: Transaction;
	setSelection(selection: TextSelection): void;
	delete(transaction: Transaction, store: RecordStore, selection: TextSelection): void;
}


interface MarkdownBlockParseRule {
	matchRegex: RegExp;
	toBlockType(content: string): string;
	insertTextAfter: boolean;
}

interface ParseMarkdownBlockProps extends MarkdownBlockParseRule {
	executor: ICommandExecutor;
}

const markdownBlockParseRules: MarkdownBlockParseRule[] = [];

// Image tag
markdownBlockParseRules.push({
	matchRegex: /^\!\[\]$/,
	toBlockType: () => BlockTypes.image,
	insertTextAfter: false,
});

// Todo tag
markdownBlockParseRules.push({
	matchRegex: /^\[\]$/,
	toBlockType: () => BlockTypes.todo,
	insertTextAfter: false,
});

// Add H3 tag
markdownBlockParseRules.push({
	matchRegex: /^### $/,
	toBlockType: () => BlockTypes.heading3,
	insertTextAfter: false,
});

// Add H2 tag
markdownBlockParseRules.push({
	matchRegex: /^## $/,
	toBlockType: () => BlockTypes.heading2,
	insertTextAfter: false,
});

// Add H1 tag
markdownBlockParseRules.push({
	matchRegex: /^# $/,
	toBlockType: () => BlockTypes.header,
	insertTextAfter: false,
});

// Add Code tag
markdownBlockParseRules.push({
	matchRegex: /^```$/,
	toBlockType: () => BlockTypes.code,
	insertTextAfter: false,
});

// Add Quote tag
markdownBlockParseRules.push({
	matchRegex: /^["“|] $/,
	toBlockType: () => BlockTypes.quote,
	insertTextAfter: false,
});

// Add BulletedList tag
markdownBlockParseRules.push({
	matchRegex: /^[-\*\+] $/,
	toBlockType: () => BlockTypes.bulletedList,
	insertTextAfter: false,
});

export class Markdown {
	public static parse(executor: ICommandExecutor): boolean {
		const storeValue = executor.store.getRecordStoreAtRootPath().getValue();
		const blockType = storeValue.type;
		if (blockType !== BlockTypes.code) {
			// Only match one block level markdown rule and take action
			const ruleMatched = Lodash.find(markdownBlockParseRules, (rule) => {
				return this.tryParse({ ...rule, executor });
			});
			return ruleMatched !== undefined;
		}
		return false;
	}

	private static tryParse(props: ParseMarkdownBlockProps): boolean {
		const { executor, toBlockType, matchRegex } = props;
		const { selection, store, transaction } = props.executor;
		const fullText = collectValueFromSegment(store.getValue());
		// Get store text value based on selection
		const text = fullText.slice(0, selection.endIndex);
		// Try to get matched markdown tag
		const markdownTag = matchRegex.exec(text);
		if (!markdownTag) {
			return false;
		}

		// Get blockType, only text block support markdown
		const parentStore = store.recordStoreParentStore;
		if (!(parentStore && parentStore instanceof BlockStore)) {
			return false;
		}
		const parentStoreType = parentStore.getType() || 'text';

		if (BlockTypes.text !== parentStoreType) {
			return false;
		}

		const blockType = toBlockType(markdownTag.toString());
		if (blockType && blockType !== parentStoreType) {
			if (parentStore instanceof BlockStore) {

				EditOperation.turnInto(parentStore, blockType as any, transaction);
			}
			const endIndex = (markdownTag && markdownTag[0].length) || 0;
			executor.delete(transaction, store, {
				startIndex: 0,
				endIndex: endIndex,
				lineNumber: selection.lineNumber
			});
			const index = fullText.length - endIndex;
			executor.setSelection({ startIndex: index, endIndex: index, lineNumber: selection.lineNumber });
			return true;
		}

		return false;
	}
}
