/*---------------------------------------------------------------------------------------------
 * Copyright (c) Mote team. All rights reserved.
 *  Licensed under the GPLv3 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { setStyles } from 'mote/base/browser/jsx/createElement';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import fonts from 'mote/base/browser/ui/fonts';
import { ThemedBase, ThemedColors } from 'mote/base/common/themes';
import { Annotation, IAnnotation } from 'mote/editor/common/annotation';
import { Segment } from 'mote/editor/common/segment';

const annotationStyles: { [key: string]: CSSProperties } = {
	b: {
		fontWeight: fonts.fontWeight.semibold
	},
	i: {
		fontStyle: 'italic'
	},
	c: {
		//fontFamily: font_config.fontFamily.githubMono,
		lineHeight: 'normal',
		background: ThemedBase.light.gray.alpha(.15).css(),
		color: ThemedColors.red,
		borderRadius: '3px',
		fontSize: '85%',
		padding: '0.2em 0.4em'
	},
	a: {
		cursor: 'pointer',
		color: 'inherit',
		wordWrap: 'break-word'
	},
	s: {
		textDecoration: 'line-through'
	},
	_: {
		borderBottom: '0.05em solid',
		wordWrap: 'break-word'
	},
	'+': {

	},
	'-': {
		opacity: .4,
		marginBottom: 6,
		textDecoration: 'line-through'
	},
	z: {
		paddingBottom: 2
	},
	st: {
		borderRadius: 1,
	}
};

export function renderSegments(segments: Segment[]) {

	if (!Array.isArray(segments)) {
		segments = [];
	}

	return segments.map(segment => {
		const text = segment.text;
		const annotations = segment.annotations;

		if (annotations.length === 0) {
			return text;
		}

		const inlineStyle = buildStyles(annotations);

		const linkAnnotation = Annotation.findLink(segment.annotations);
		if (linkAnnotation) {
			const scheme = linkAnnotation.scheme;
			if (scheme) {
				const linkNode = createLinkNode(segment.text, scheme);
				setStyles(linkNode, inlineStyle);
				return linkNode.outerHTML;
			}
		}

		const node = document.createElement('span');
		setStyles(node, inlineStyle);
		node.appendChild(createTextNode(text));
		return node.outerHTML;
	});
}

function createLinkNode(text: string, scheme: string) {
	const link = document.createElement('a');
	link.href = scheme;

	const span = document.createElement('span');

	link.appendChild(span);
	span.appendChild(createTextNode(text));

	return link;
}

function createTextNode(text: string) {
	return document.createTextNode(text);
}

function buildStyles(annotations: IAnnotation[]) {
	const styles = {};
	for (const annotation of annotations) {
		const inlineStyle = annotationStyles[annotation.type];
		if (inlineStyle) {
			Object.assign(styles, inlineStyle);
		}
	}
	return styles;
}
