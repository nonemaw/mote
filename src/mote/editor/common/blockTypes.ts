import { BlockTypes } from 'mote/platform/store/common/record';

export const keepLineTypes = new Set([
	BlockTypes.todo,
	BlockTypes.bulletedList,
]);

export const textBasedTypes = new Set([
	BlockTypes.header,
	BlockTypes.quote,
	BlockTypes.todo,
	BlockTypes.heading2,
	BlockTypes.heading3,
	BlockTypes.heading4,
	BlockTypes.code,
	BlockTypes.bulletedList,
]);

export const pureTextTypes = new Set([
	BlockTypes.text,
	BlockTypes.header,
	BlockTypes.heading2,
	BlockTypes.heading3,
	BlockTypes.heading4,
]);

export const mediaTypes = new Set([
	BlockTypes.image
]);

export const contentTypes = new Set([
	...mediaTypes,
	BlockTypes.code
]);
