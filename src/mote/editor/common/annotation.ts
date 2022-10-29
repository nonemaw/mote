import { getFirstInArray, getSecondArrayInArray } from 'mote/editor/common/segmentUtils';

export enum AnnotationType {
	Bold = 'b',
	Italics = 'i',
	Strike = 's',
	Code = 'c',
	Underline = '_',
	Link = 'a'
}


export interface IAnnotation {

	type: AnnotationType;
	value(): string[];
	equals(annotation: IAnnotation): boolean;

	toJson(): string[];
}

abstract class AbstractAnnotation implements IAnnotation {

	abstract type: AnnotationType;

	value(): string[] {
		return [];
	}
	equals(annotation: IAnnotation): boolean {
		if (annotation.type === this.type) {
			return true;
		}
		return false;
	}
	toJson(): string[] {
		return [this.type];
	}


}

export class BoldAnnotation extends AbstractAnnotation implements IAnnotation {
	type = AnnotationType.Bold;
}

export class ItalicsAnnotation extends AbstractAnnotation implements IAnnotation {
	type = AnnotationType.Italics;
}

export class StrikeAnnotation extends AbstractAnnotation implements IAnnotation {
	type = AnnotationType.Strike;
}

export class LinkAnnotation implements IAnnotation {
	type = AnnotationType.Link;

	constructor(public scheme: string) {

	}

	value(): string[] {
		return [this.scheme];
	}

	equals(annotation: IAnnotation): boolean {
		if (annotation instanceof LinkAnnotation) {
			if (annotation.scheme === this.scheme) {
				return true;
			}
		}
		return false;
	}

	toJson(): string[] {
		return [AnnotationType.Link, this.scheme];
	}

}

export type Annotation = BoldAnnotation | ItalicsAnnotation | LinkAnnotation;

export namespace Annotation {

	export function from(annotation: string[]): Annotation {
		const type = getFirstInArray(annotation) as AnnotationType;
		switch (type) {
			case AnnotationType.Bold:
				return new BoldAnnotation();
			case AnnotationType.Link:
				return new LinkAnnotation(getSecondArrayInArray(annotation));
			default:
				throw new Error();
		}
	}

	export function isLink(annotation: IAnnotation) {
		return annotation.type === AnnotationType.Link;
	}

	export function findLink(annotations: IAnnotation[]): LinkAnnotation | undefined {
		return annotations.find(isLink) as (LinkAnnotation | undefined);
	}
}
