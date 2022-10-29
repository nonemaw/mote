import { AnchorAlignment, AnchorAxisAlignment } from 'mote/base/browser/ui/contextview/contextview';
import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { TextSelectionState } from 'mote/editor/common/core/selectionUtils';
import { IAction, IActionRunner } from 'vs/base/common/actions';
import { BrandedService, createDecorator, IConstructorSignature } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';

export interface IQuickMenuOptions {

}

export interface IQuickMenuDelegate {
	getActions(): readonly IAction[];
	/**
	 * Current store
	 */
	state: TextSelectionState;
	anchorAlignment?: AnchorAlignment;
	anchorAxisAlignment?: AnchorAxisAlignment;
	actionRunner?: IActionRunner;
	domForShadowRoot?: HTMLElement;
}

export const IQuickMenuService = createDecorator<IQuickMenuService>('quickMenuService');

export interface IQuickMenuService {

	readonly _serviceBrand: undefined;

	showQuickMenu(delegate: IQuickMenuDelegate): void;
}

// QuickMenu extension points
export const QuickMenuExtensions = {
	QuickMenuContributions: 'workbench.quickmenu.contributions'
};

export type IQuickMenuContributionCtor = IConstructorSignature<IQuickMenuContribution, [IMoteEditor]>;

export interface IQuickMenuContributionDescription {
	id: string;
	ctor: IQuickMenuContributionCtor;
}

export interface IQuickMenuContribution {

}

class QuickMenuContributionRegistry {
	public static readonly INSTANCE = new QuickMenuContributionRegistry();

	private readonly actionContributions: Map<string, IQuickMenuContributionDescription> = new Map();

	public registerQuickMenuContribution<Services extends BrandedService[]>(
		id: string, ctor: {
			new(
				editor: IMoteEditor, ...services: Services
			): IQuickMenuContribution;
		}
	): void {
		this.actionContributions.set(id, { id, ctor: ctor as IQuickMenuContributionCtor });
	}

	public getQuickMenuContributions(): Map<string, IQuickMenuContributionDescription> {
		return this.actionContributions;
	}
}

export function registerQuickMenuContribution<Services extends BrandedService[]>(
	id: string, ctor: {
		new(
			editor: IMoteEditor, ...services: Services
		): IQuickMenuContribution;
	}
): void {
	QuickMenuContributionRegistry.INSTANCE.registerQuickMenuContribution(id as any, ctor);
}

Registry.add(QuickMenuExtensions.QuickMenuContributions, QuickMenuContributionRegistry.INSTANCE);

