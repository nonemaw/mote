import { isBrNode, isTextMentionNode, isTextNode } from './htmlElementUtils';

const unescapeInfo = new Map<number, string>([
	[160, ' '], // '&nbsp;'
]);

export function serializeNode(node: Node) {
	let result = '';
	if (isTextMentionNode(node)) {

	}
	else if (isBrNode(node)) {
		result += '\n';
	}
	else if (isTextNode(node)) {
		if (node.textContent) {
			const text = Array.from(node.textContent).map(char => unescapeInfo.get(char.charCodeAt(0)) ?? char);
			result += text.join('');
		}
	}
	else {
		for (const childNode of Array.from(node.childNodes)) {
			result += serializeNode(childNode);
		}
	}
	return result;
}

export function nodeToString(element: Node) {
	let serialized = serializeNode(element);
	if ('\n' === serialized[serialized.length - 1]) {
		serialized = serialized.substring(0, serialized.length - 1);
	}
	return serialized;
}
