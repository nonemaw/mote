import { Annotation, IAnnotation } from 'mote/editor/common/annotation';
import { ISegment } from 'mote/editor/common/segmentUtils';


export class Segment {

	static from(source: ISegment) {
		const text = source[0];
		const annotations = (source[1] || []).map(Annotation.from);
		return new Segment(text, annotations);
	}

	constructor(public readonly text: string, private _annotations: IAnnotation[]) {

	}

	public get annotations(): IAnnotation[] {
		return this._annotations;
	}
}
