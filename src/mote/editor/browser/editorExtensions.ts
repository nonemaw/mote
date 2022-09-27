import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { IEditorContribution } from 'mote/editor/common/editorCommon';
import { CommandsRegistry, ICommandHandlerDescription } from 'mote/platform/commands/common/commands';
import { ThemeIcon } from 'mote/platform/theme/common/themeService';
import { MenuId } from 'vs/platform/actions/common/actions';
import { ContextKeyExpression } from 'vs/platform/contextkey/common/contextkey';
import { BrandedService, IConstructorSignature, ServicesAccessor as InstantiationServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';

export type ServicesAccessor = InstantiationServicesAccessor;
export type IEditorContributionCtor = IConstructorSignature<IEditorContribution, [IMoteEditor]>;

export interface IEditorContributionDescription {
	id: string;
	ctor: IEditorContributionCtor;
}

//#region Command

export interface ICommandMenuOptions {
	menuId: MenuId;
	group: string;
	order: number;
	when?: ContextKeyExpression;
	title: string;
	icon?: ThemeIcon;
}

export interface ICommandOptions {
	id: string;
	precondition: ContextKeyExpression | undefined;
	//kbOpts?: ICommandKeybindingsOptions | ICommandKeybindingsOptions[];
	description?: ICommandHandlerDescription;
	menuOpts?: ICommandMenuOptions | ICommandMenuOptions[];
}

export abstract class Command {

	public readonly id: string;
	public readonly precondition: ContextKeyExpression | undefined;

	//private readonly menuOpts: ICommandMenuOptions | ICommandMenuOptions[] | undefined;
	private readonly description: ICommandHandlerDescription | undefined;

	constructor(opts: ICommandOptions) {
		this.id = opts.id;
		this.precondition = opts.precondition;
		//this.menuOpts = opts.menuOpts;
		this.description = opts.description;
	}

	public register(): void {
		CommandsRegistry.registerCommand({
			id: this.id,
			handler: (accessor, args) => this.runCommand(accessor, args),
			description: this.description
		});
	}

	public abstract runCommand(accessor: ServicesAccessor, args: any): void | Promise<void>;
}

//#endregion


//#region EditorCommand

export abstract class EditorCommand extends Command {

}

//#endregion

//#region EditorAction

export abstract class EditorAction extends EditorCommand {

}

//#endregion

//#region Registration of commands and actions

export function registerEditorContribution<Services extends BrandedService[]>(id: string, ctor: { new(editor: IMoteEditor, ...services: Services): IEditorContribution }): void {
	EditorContributionRegistry.INSTANCE.registerEditorContribution(id, ctor);
}

export namespace EditorExtensionsRegistry {

	export function getEditorCommand(commandId: string): EditorCommand {
		return EditorContributionRegistry.INSTANCE.getEditorCommand(commandId);
	}

	export function getEditorActions(): EditorAction[] {
		return EditorContributionRegistry.INSTANCE.getEditorActions();
	}

	export function getEditorContributions(): IEditorContributionDescription[] {
		return EditorContributionRegistry.INSTANCE.getEditorContributions();
	}

	export function getSomeEditorContributions(ids: string[]): IEditorContributionDescription[] {
		return EditorContributionRegistry.INSTANCE.getEditorContributions().filter(c => ids.indexOf(c.id) >= 0);
	}
}

//#endregion

// Editor extension points
const EditorExtensions = {
	EditorCommonContributions: 'editor.contributions'
};

class EditorContributionRegistry {

	public static readonly INSTANCE = new EditorContributionRegistry();

	private readonly editorContributions: IEditorContributionDescription[];
	private readonly editorActions: EditorAction[];
	private readonly editorCommands: { [commandId: string]: EditorCommand };

	constructor() {
		this.editorContributions = [];
		this.editorActions = [];
		this.editorCommands = Object.create(null);
	}

	public registerEditorContribution<Services extends BrandedService[]>(id: string, ctor: { new(editor: IMoteEditor, ...services: Services): IEditorContribution }): void {
		this.editorContributions.push({ id, ctor: ctor as IEditorContributionCtor });
	}

	public getEditorContributions(): IEditorContributionDescription[] {
		return this.editorContributions.slice(0);
	}

	public registerEditorAction(action: EditorAction) {
		action.register();
		this.editorActions.push(action);
	}

	public getEditorActions(): EditorAction[] {
		return this.editorActions.slice(0);
	}

	public registerEditorCommand(editorCommand: EditorCommand) {
		editorCommand.register();
		this.editorCommands[editorCommand.id] = editorCommand;
	}

	public getEditorCommand(commandId: string): EditorCommand {
		return (this.editorCommands[commandId] || null);
	}

}

Registry.add(EditorExtensions.EditorCommonContributions, EditorContributionRegistry.INSTANCE);
