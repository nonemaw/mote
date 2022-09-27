import * as objects from 'vs/base/common/objects';
import * as browser from 'vs/base/browser/browser';
import * as arrays from 'vs/base/common/arrays';
import * as platform from 'vs/base/common/platform';
import { ElementSizeObserver } from 'mote/editor/browser/config/elementSizeObserver';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { ConfigurationChangedEvent, EditorOption, editorOptionsRegistry, FindComputedEditorOptionValueById, IComputedEditorOptions, IEnvironmentalOptions } from 'mote/editor/common/config/editorOptions';
import { IDimension } from 'mote/editor/common/core/dimension';
import { IEditorOptions } from 'mote/platform/editor/common/editor';
import { Disposable } from 'vs/base/common/lifecycle';
import { IValidatedEditorOptions } from 'mote/editor/common/config/fontInfo';
import { Emitter, Event } from 'vs/base/common/event';

export interface IEditorConstructionOptions extends IEditorOptions {
	/**
	 * The initial editor dimension (to avoid measuring the container).
	 */
	dimension?: IDimension;

	/**
	 * Place overflow widgets inside an external DOM node.
	 * Defaults to an internal DOM node.
	 */
	overflowWidgetsDomNode?: HTMLElement;
}

export interface IEnvConfiguration {
	extraEditorClassName: string;
	outerWidth: number;
	outerHeight: number;
	emptySelectionClipboard: boolean;
	pixelRatio: number;
	//accessibilitySupport: AccessibilitySupport;
}

class ValidatedEditorOptions implements IValidatedEditorOptions {
	private readonly _values: any[] = [];
	public _read<T>(option: EditorOption): T {
		return this._values[option];
	}
	public get<T extends EditorOption>(id: T): FindComputedEditorOptionValueById<T> {
		return this._values[id];
	}
	public _write<T>(option: EditorOption, value: T): void {
		this._values[option] = value;
	}
}

export class ComputedEditorOptions implements IComputedEditorOptions {
	private readonly _values: any[] = [];
	public _read<T>(id: EditorOption): T {
		if (id >= this._values.length) {
			throw new Error('Cannot read uninitialized value');
		}
		return this._values[id];
	}
	public get<T extends EditorOption>(id: T): FindComputedEditorOptionValueById<T> {
		return this._read(id);
	}
	public _write<T>(id: EditorOption, value: T): void {
		this._values[id] = value;
	}
}


export class EditorConfiguration extends Disposable implements IEditorConfiguration {

	private _onDidChange = this._register(new Emitter<ConfigurationChangedEvent>());
	public readonly onDidChange: Event<ConfigurationChangedEvent> = this._onDidChange.event;

	private _onDidChangeFast = this._register(new Emitter<ConfigurationChangedEvent>());
	public readonly onDidChangeFast: Event<ConfigurationChangedEvent> = this._onDidChangeFast.event;

	private readonly containerObserver: ElementSizeObserver;

	private viewLineCount: number = 1;

	/**
	 * Raw options as they were passed in and merged with all calls to `updateOptions`.
	 */
	private readonly rawOptions: IEditorOptions;

	/**
	 * Validated version of `_rawOptions`.
	 */
	private validatedOptions: ValidatedEditorOptions;

	/**
	 * Complete options which are a combination of passed in options and env values.
	 */
	public options: ComputedEditorOptions;

	constructor(
		options: Readonly<IEditorConstructionOptions>,
		container: HTMLElement | null,
	) {
		super();

		this.containerObserver = this._register(new ElementSizeObserver(container, options.dimension));

		this.rawOptions = deepCloneAndMigrateOptions(options);
		this.validatedOptions = EditorOptionsUtil.validateOptions(this.rawOptions);
		this.options = this.computeOptions();

		this.containerObserver.startObserving();

		this._register(this.containerObserver.onDidChange(() => this.recomputeOptions()));
	}

	private recomputeOptions() {
		const newOptions = this.computeOptions();
		const changeEvent = EditorOptionsUtil.checkEquals(this.options, newOptions);
		if (changeEvent === null) {
			// nothing changed!
			return;
		}

		console.log('changeEvent:', newOptions);

		this.options = newOptions;
		this._onDidChangeFast.fire(changeEvent);
		this._onDidChange.fire(changeEvent);
	}

	private computeOptions() {
		const partialEnv = this.readEnvConfiguration();
		const env: IEnvironmentalOptions = {
			outerWidth: partialEnv.outerWidth,
			outerHeight: partialEnv.outerHeight,
			extraEditorClassName: partialEnv.extraEditorClassName,
			viewLineCount: this.viewLineCount,
			pixelRatio: partialEnv.pixelRatio,
		};
		return EditorOptionsUtil.computeOptions(this.validatedOptions, env);
	}

	protected readEnvConfiguration(): IEnvConfiguration {
		return {
			extraEditorClassName: getExtraEditorClassName(),
			outerWidth: this.containerObserver.getWidth(),
			outerHeight: this.containerObserver.getHeight(),
			emptySelectionClipboard: browser.isWebKit || browser.isFirefox,
			pixelRatio: browser.PixelRatio.value,
		};
	}

	public setViewLineCount(viewLineCount: number): void {
		if (this.viewLineCount === viewLineCount) {
			return;
		}
		this.viewLineCount = viewLineCount;
		this.recomputeOptions();
	}

	observeContainer(dimension?: IDimension | undefined): void {
		this.containerObserver.observe(dimension);
	}

}

class EditorOptionsUtil {

	public static validateOptions(options: IEditorOptions): ValidatedEditorOptions {
		const result = new ValidatedEditorOptions();
		for (const editorOption of editorOptionsRegistry) {
			const value = (editorOption.name === '_never_' ? undefined : (options as any)[editorOption.name]);
			result._write(editorOption.id, editorOption.validate(value));
		}
		return result;
	}

	public static computeOptions(options: ValidatedEditorOptions, env: IEnvironmentalOptions): ComputedEditorOptions {
		const result = new ComputedEditorOptions();
		for (const editorOption of editorOptionsRegistry) {
			result._write(editorOption.id, editorOption.compute(env, result, options._read(editorOption.id)));
		}
		return result;
	}

	private static _deepEquals<T>(a: T, b: T): boolean {
		if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
			return a === b;
		}
		if (Array.isArray(a) || Array.isArray(b)) {
			return (Array.isArray(a) && Array.isArray(b) ? arrays.equals(a, b) : false);
		}
		if (Object.keys(a as unknown as object).length !== Object.keys(b as unknown as object).length) {
			return false;
		}
		for (const key in a) {
			if (!EditorOptionsUtil._deepEquals(a[key], b[key])) {
				return false;
			}
		}
		return true;
	}

	public static checkEquals(a: ComputedEditorOptions, b: ComputedEditorOptions): ConfigurationChangedEvent | null {
		const result: boolean[] = [];
		let somethingChanged = false;
		for (const editorOption of editorOptionsRegistry) {
			const changed = !EditorOptionsUtil._deepEquals(a._read(editorOption.id), b._read(editorOption.id));
			result[editorOption.id] = changed;
			if (changed) {
				somethingChanged = true;
			}
		}
		return (somethingChanged ? new ConfigurationChangedEvent(result) : null);
	}

	/**
	 * Returns true if something changed.
	 * Modifies `options`.
	*/
	public static applyUpdate(options: IEditorOptions, update: Readonly<IEditorOptions>): boolean {
		let changed = false;
		for (const editorOption of editorOptionsRegistry) {
			if (update.hasOwnProperty(editorOption.name)) {
				const result = editorOption.applyUpdate((options as any)[editorOption.name], (update as any)[editorOption.name]);
				(options as any)[editorOption.name] = result.newValue;
				changed = changed || result.didChange;
			}
		}
		return changed;
	}
}

function deepCloneAndMigrateOptions(_options: Readonly<IEditorOptions>): IEditorOptions {
	const options = objects.deepClone(_options);
	//migrateOptions(options);
	return options;
}

function getExtraEditorClassName(): string {
	let extra = '';
	if (!browser.isSafari && !browser.isWebkitWebView) {
		// Use user-select: none in all browsers except Safari and native macOS WebView
		extra += 'no-user-select ';
	}
	if (browser.isSafari) {
		// See https://github.com/microsoft/vscode/issues/108822
		extra += 'enable-user-select ';
	}
	if (platform.isMacintosh) {
		extra += 'mac ';
	}
	return extra;
}
