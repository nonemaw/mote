
export type IAnnotation = [string];

export type ISegment = [string, IAnnotation[]?];

export function getFirstInArray<T>(e: T[]) {
	return e[0];
}

export function getSecondArrayInArray(e: any[]) {
	return e && e[1] && e[1] || [];
}

export function combineArray(e: any, t: any[]) {
	return t && t.length > 0 ? [e, t] : [e];
}

export function emptyOrArray<T>(e?: T[]) {
	return e && Array.isArray(e) ? e : [];
}

function sliceArray(content: string[], startIndex: number, endIndex?: number) {
	return content.slice(Math.max(0, startIndex), endIndex);
}

export function merge(record: ISegment[], segments: ISegment[], startIndex: number) {
	record = emptyOrArray(record);
	if (record.length > 0) {
		const newRecord: ISegment[] = [];
		let bias = 0;
		let flag = false;
		for (const segment of record) {
			const content = getFirstInArray(segment) as string;
			const annotations = getSecondArrayInArray(segment) as IAnnotation[];
			const contentInArray = Array.from(content);
			const currentBias = bias;
			const endIndex = bias + contentInArray.length;
			// The cursor index greater than last segment postion and less than current segment end position
			// [prevSegment]([contentBefore](cursor)[contentAfter])[Next]
			if (startIndex >= currentBias && startIndex <= endIndex && !flag) {
				const index = startIndex - currentBias;
				const contentBefore = sliceArray(contentInArray, 0, index);
				const contentAfter = sliceArray(contentInArray, index);
				if (contentBefore.length > 0) {
					newRecord.push(combineArray(contentBefore.join(''), annotations) as ISegment);
				}
				for (const newSegment of segments) {
					if (newRecord.length > 0) {
						const prevRecord = newRecord[newRecord.length - 1];
						const currentAnnotations = getSecondArrayInArray(newSegment) as IAnnotation[];
						const prevAnnotations = getSecondArrayInArray(prevRecord);
						if (annotationsEqual(prevAnnotations, currentAnnotations)) {
							// Merge prev segment with same annotations
							prevRecord[0] = prevRecord[0] + newSegment[0];
						} else {
							newRecord.push(newSegment);
						}
					} else {
						newRecord.push(newSegment);
					}
				}
				if (contentAfter.length > 0) {
					newRecord.push(combineArray(contentAfter.join(''), annotations) as ISegment);
				}
				flag = true;
			} else {
				newRecord.push(segment);
			}
			bias = endIndex;
		}
		return newRecord;
	}
	return segments;
}

export function remove(record: ISegment[], startIndex: number, endIndex: number) {
	record = emptyOrArray(record);
	const newRecord: ISegment[] = [];
	let offset = 0;
	for (const segment of record) {
		const content = getFirstInArray(segment) as string;
		const annotations = getSecondArrayInArray(segment) as IAnnotation[];
		const contentInArray = Array.from(content);
		const currentOffset = offset;
		const currentEndIndex = offset + contentInArray.length;
		// case 1: the content that need to removed not in current segment
		if (currentEndIndex <= startIndex && currentEndIndex <= endIndex || currentOffset >= startIndex && currentOffset >= endIndex) {
			newRecord.push(segment);
		}
		// case 2: the content that need to removed in current segment
		else if (currentOffset >= startIndex && currentEndIndex <= endIndex) {
			// skip to add it to new record
		}
		else {
			const currentStartIndex = startIndex - currentOffset;
			const currentEndIndex = currentStartIndex + endIndex - startIndex;
			const newContent = contentInArray.filter((char, idx) => !(idx >= currentStartIndex && idx <= currentEndIndex - 1));
			newRecord.push(combineArray(newContent.join(""), annotations) as ISegment);
		}
		offset = currentEndIndex;
	}
	return newRecord;
}

export function slice(record: ISegment[], startIndex: number, endIndex: number) {
	record = emptyOrArray(record);
	const newRecord: ISegment[] = [];
	let recordOffset = 0;
	let offset = 0;
	while (recordOffset < record.length && offset < endIndex) {
		const segment = record[recordOffset];
		if (offset >= startIndex) {
			const contentInArray = Array.from(getFirstInArray(segment) as any) as string[];
			if (!(offset + contentInArray.length <= endIndex)) {
				const annotations = getSecondArrayInArray(segment) as IAnnotation[];
				const index = endIndex - offset;
				const content = contentInArray.slice(0, index).join("");
				newRecord.push(combineArray(content, annotations) as ISegment);
				break;
			}
			newRecord.push(segment);
			offset += contentInArray.length;
			recordOffset += 1;
		} else {
			const contentInArray = Array.from(getFirstInArray(segment) as any) as string[];
			if (offset + contentInArray.length > startIndex) {
				const annotations = getSecondArrayInArray(segment) as IAnnotation[];
				if (!(offset + contentInArray.length <= endIndex)) {
					const currentStartIndex = startIndex - offset;
					const currentEndIndex = endIndex - offset;
					const content = contentInArray.slice(currentStartIndex, currentEndIndex).join("");
					newRecord.push(combineArray(content, annotations) as ISegment);
					break;
				}
				const currentStartIndex = startIndex - offset;
				const content = contentInArray.slice(currentStartIndex).join("");
				newRecord.push(combineArray(content, annotations) as ISegment);
				offset += contentInArray.length;
				recordOffset += 1;
			} else {
				offset += contentInArray.length;
				recordOffset += 1;
			}
		}
	}
	return newRecord;
}

/**
 * Return block value without annotations
 * @param segments
 * @returns block text value
 */
export function collectValueFromSegment(segments: ISegment[]) {
	return emptyOrArray(segments).map(segment => getFirstInArray(segment)).join('');
}

export function annotationsEqual(value: IAnnotation[], other: IAnnotation[]) {
	if (value && other) {
		if (value.length !== other.length) {
			return false;
		}
		value.sort();
		other.sort();
		for (let i = 0; i < value.length; i++) {
			if (value[i][0] !== other[i][0]) {
				return false;
			}
		}
		return true;
	}
	return false;
}
