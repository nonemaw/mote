import { EditableHandlerOptions } from 'mote/editor/browser/controller/editableHandler';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { IViewLineContribution } from 'mote/editor/browser/editorBrowser';
import { BlockType } from 'mote/platform/store/common/record';
import { BrandedService, IConstructorSignature } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';

export type IViewLineContributionCtor = IConstructorSignature<IViewLineContribution, [number, ViewContext, ViewController, EditableHandlerOptions]>;

export interface IViewLineContributionDescription {
	id: BlockType;
	ctor: IViewLineContributionCtor;
}

export function registerViewLineContribution<Services extends BrandedService[]>(
	id: string, ctor: {
		new(
			lineNumber: number, viewContext: ViewContext, viewController: ViewController,
			options: EditableHandlerOptions, ...services: Services
		): IViewLineContribution;
	}
): void {
	ViewLineContributionRegistry.INSTANCE.registerEditorContribution(id as any, ctor);
}

export namespace ViewLineExtensionsRegistry {

	export function getViewLineContributions(): Map<String, IViewLineContributionDescription> {
		return ViewLineContributionRegistry.INSTANCE.getEditorContributions();
	}

	export function getViewLineContribution(id: BlockType): IViewLineContributionDescription | undefined {
		return ViewLineContributionRegistry.INSTANCE.getEditorContributions().get(id);
	}
}

// Editor extension points
const EditorExtensions = {
	ViewLineContributions: 'editor.viewline.contributions'
};

class ViewLineContributionRegistry {
	public static readonly INSTANCE = new ViewLineContributionRegistry();

	private readonly viewLineContributions: Map<BlockType, IViewLineContributionDescription> = new Map();

	public registerEditorContribution<Services extends BrandedService[]>(
		id: BlockType, ctor: {
			new(
				lineNumber: number, viewContext: ViewContext, viewController: ViewController,
				options: EditableHandlerOptions, ...services: Services
			): IViewLineContribution;
		}
	): void {
		this.viewLineContributions.set(id, { id, ctor: ctor as IViewLineContributionCtor });
	}

	public getEditorContributions(): Map<BlockType, IViewLineContributionDescription> {
		return this.viewLineContributions;
	}
}

Registry.add(EditorExtensions.ViewLineContributions, ViewLineContributionRegistry.INSTANCE);
