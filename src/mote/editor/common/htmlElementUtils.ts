/* eslint-disable code-no-unexternalized-strings */
export const CLASS_TEXT_MENTION_TOKEN = "caffeine-text-mention-token";
export const CLASS_SELECTABLE_HALO = "caffeine-selectable-halo";
export const CLASS_PAGE_CONTENT = "caffeine-page-content";
export const CLASS_TEXT_EQUATION_TOKEN = "caffeine-text-mention-token";
export const CLASS_IGNORE_TEXT_CONTENT = "caffeine-ignore-text-content";
export const CLASS_TEXT_BUFFER = "caffeine-text-buffer";

export function isNode(node?: Node | null) {
	try {
		return node && void 0 !== node.nodeType;
	} catch (_) {
		return false;
	}
};

export function isElementNode(node?: Node) {
	return isNode(node) && node!.nodeType === Node.ELEMENT_NODE;
}

export function isTextNode(node?: Node | null) {
	return isNode(node) && node!.nodeType === Node.TEXT_NODE;
}

export function isBrNode(node?: Node) {
	if (isElementNode(node)) {
		const element = node as Element;
		return "br" === element.tagName.toLowerCase();
	}
	return false;
}

export function isTextMentionNode(node?: Node) {
	if (isElementNode(node)) {
		const element = node as Element;
		return element.classList.contains(CLASS_TEXT_MENTION_TOKEN);
	}
	return false;
}

function isDataRootElement(e: any) {
	if (isElementNode(e)) {
		const node = e as Element;
		return node.hasAttribute('data-root') || node.className.includes('view-line');
	}
	return false;
}

function isTextEquationTokenElement(e: Element) {
	return isElementNode(e) && e.classList.contains(CLASS_TEXT_EQUATION_TOKEN);
}

export function isIgnoreTextContentElement(e: Element) {
	return isElementNode(e) && e.classList.contains(CLASS_IGNORE_TEXT_CONTENT);
}

export const isTextBufferElement = function (e: any) {
	return isElementNode(e) && e.classList.contains(CLASS_TEXT_BUFFER);
};

export function isContentEditable(e: Node) {
	try {
		const t: any = getElementInParent(e, (e: any) => Boolean(e.getAttribute && e.getAttribute("contenteditable")) || isDataRootElement(e));
		return t && t['isContentEditable'];
	} catch (t) {
		return false;
	}
}

export function isTextBuffNodeContain(e: Node) {
	if (isTextBufferElement(e)) {
		return true;
	}
	try {
		return isTextBufferElement(e.parentNode);
	} catch (err) {
		return false;
	}
}

function getElementInParent(element: Node | null, predict: (element: Node) => boolean): Node | null {
	for (; isNode(element) && !predict(element!);) {
		element = element && element.parentNode;
	}
	return element;
}

export function getDataRootInParent(container: Node) {
	return getElementInParent(container, isDataRootElement);
}

export function getTextEquationTokenElementInParent(e: any) {
	// getElement in parent, until find first TextEquationTokenNode or stop with DataRoot
	const element = getElementInParent(e, e => isTextMentionNode(e) || isDataRootElement(e));
	if (element && isTextMentionNode(element)) {
		return element;
	}
	return undefined;
}

export function getTextMention(container: Node) {
	// Get TextEquationTokenElement at first
	let element: any = getElementInParent(container, e => isTextEquationTokenElement(e as any) || isDataRootElement(e));
	if (element && isTextMentionNode(element)) {
		return element;
	}
	// If we could not get TextEquationTokenElement, then try to get TextEquationTokenElement
	element = getTextEquationTokenElementInParent(container);
	if (element) {
		return element;
	}

	// Try to get IgnoreTextContentElement
	element = getElementInParent(container, e => isIgnoreTextContentElement(e as any) || isDataRootElement(e));
	if (element && isIgnoreTextContentElement(element)) {
		return element;
	}
}

export function flattenNode(container: Node, result: Text[] = []) {

	if (isNode(container)) {
		for (const child of Array.from(container.childNodes)) {
			if (isTextNode(child)) {
				result.push(child as Text);
				continue;
			}
			if (child.childNodes) {
				flattenNode(child, result);
			}
		}
	}
	return result;
}

export const BOM = "\ufeff";
const BOM_REG = new RegExp(BOM, "g");

export function removeBOM(e: string) {
	return e.replace(BOM_REG, "");
}



