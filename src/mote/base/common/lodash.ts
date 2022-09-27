export class Lodash {
	static isEqual(value: any, other: any): boolean {
		if (value === other) {
			return true;
		}
		else if ((typeof value === 'object' && value !== null) && (typeof other === 'object' && other !== null)) {
			if (Object.keys(value).length !== Object.keys(other).length) {
				return false;
			}
			for (const prop in value) {
				if (other.hasOwnProperty(prop)) {
					if (!Lodash.isEqual(value[prop], other[prop])) {
						return false;
					}
				}
				else {
					return false;
				}
			}

			return true;
		}
		return false;
	}

	static throttle<T extends (...args: any) => any>(func: T, wait: number): T {
		let waiting = false;
		let result: any;
		return function (...args: any) {
			if (!waiting) {
				result = func(...args);
				waiting = true;
				setTimeout(function () {
					waiting = false;
				}, wait);
			}
			return result;
		} as any;
	}

	static uniqWith<T>(collection: ArrayLike<T>, comparator: (value: T, other: T) => boolean) {
		const result: T[] = [];
		for (let i = 0; i < collection.length; i++) {
			for (let j = i + 1; j < collection.length; j++) {
				if (comparator(collection[i], collection[j])) {
					break;
				}
			}
			result.push(collection[i]);
		}
		return result;
	}

	static find<T>(collection: ArrayLike<T>, predicate: (value: T, index: number, collection: ArrayLike<T>) => boolean) {
		for (let i = 0; i < collection.length; i++) {
			if (predicate(collection[i], i, collection)) {
				return collection[i];
			}
		}
		return undefined;
	}

	static findIndex<T>(collection: ArrayLike<T>, predicate: (value: T, index: number, collection: ArrayLike<T>) => boolean) {
		for (let i = 0; i < collection.length; i++) {
			if (predicate(collection[i], i, collection)) {
				return i;
			}
		}
		return -1;
	}

	static every<T>(collection: Array<T>, predicate: (value: T, index: number, collection: ArrayLike<T>) => boolean) {
		for (let i = 0; i < collection.length; i++) {
			if (!predicate(collection[i], i, collection)) {
				return false;
			}
		}
		return true;
	}

	static any<T>(collection: Array<T>, predicate: (value: T, index: number, collection: ArrayLike<T>) => boolean) {
		for (let i = 0; i < collection.length; i++) {
			if (predicate(collection[i], i, collection)) {
				return true;
			}
		}
		return false;
	}
}
