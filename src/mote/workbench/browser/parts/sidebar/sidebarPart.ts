/* eslint-disable code-no-unexternalized-strings */
import { ThemedStyles } from "mote/base/common/themes";
import { IThemeService } from "mote/platform/theme/common/themeService";
import { IWorkspaceContextService } from 'mote/platform/workspace/common/workspace';
import { PaneComposite, PaneCompositeDescriptor, PaneCompositeExtensions, PaneCompositeRegistry } from "mote/workbench/browser/panecomposite";
import { CompositePart } from "mote/workbench/browser/parts/compositePart";
import { IPaneCompositePart } from "mote/workbench/browser/parts/paneCompositePart";
import { IPaneComposite } from "mote/workbench/common/panecomposite";
import { IWorkbenchLayoutService, Parts } from "mote/workbench/services/layout/browser/layoutService";
import { assertIsDefined } from "vs/base/common/types";
import { IInstantiationService } from "vs/platform/instantiation/common/instantiation";
import { ILogService } from "vs/platform/log/common/log";
import { Registry } from "vs/platform/registry/common/platform";

export class SidebarPart extends CompositePart<PaneComposite> implements IPaneCompositePart {

	declare readonly _serviceBrand: undefined;


	readonly minimumWidth: number = 250;
	readonly maximumWidth: number = 450;
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;

	private readonly viewletRegistry = Registry.as<PaneCompositeRegistry>(PaneCompositeExtensions.Viewlets);

	private blockOpeningViewlet = false;

	constructor(
		@ILogService logService: ILogService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
	) {
		super(
			logService,
			layoutService,
			themeService,
			instantiationService,
			Registry.as<PaneCompositeRegistry>(PaneCompositeExtensions.Viewlets),
			'sideBar',
			Parts.SIDEBAR_PART, { hasTitle: false }
		);
	}

	override create(parent: HTMLElement, options?: object): void {
		this.element = parent;

		super.create(parent);

	}

	override createTitleArea(parent: HTMLElement): HTMLElement {

		const titleArea = super.createTitleArea(parent);

		/*
		titleArea.style.padding = '2px 14px';
		titleArea.style.fontSize = '14px';
		titleArea.style.height = '45px';
		titleArea.style.alignItems = 'center';
		titleArea.style.fontWeight = `${fonts.fontWeight.medium}px`;
		*/
		return titleArea;
	}

	override updateStyles(): void {
		super.updateStyles();

		// Part container
		const container = assertIsDefined(this.getContainer());
		container.style.backgroundColor = ThemedStyles.sidebarBackground.dark;
	}

	async openPaneComposite(id: string | undefined, focus?: boolean): Promise<IPaneComposite | undefined> {
		this.logService.debug(`[SidebarPart] openPaneComposite: <${id}>`);

		if (typeof id === 'string' && this.getPaneComposite(id)) {
			return this.doOpenViewlet(id, focus);
		}

		if (typeof id === 'string' && this.getPaneComposite(id)) {
			return this.doOpenViewlet(id, focus);
		}

		return undefined;
	}

	private doOpenViewlet(id: string, focus?: boolean): PaneComposite | undefined {
		this.logService.debug(`[SidebarPart]#doOpenViewlet <id=${id}>`);
		if (this.blockOpeningViewlet) {
			return undefined; // Workaround against a potential race condition
		}

		// First check if sidebar is hidden and show if so
		if (!this.layoutService.isVisible(Parts.SIDEBAR_PART)) {
			try {
				this.blockOpeningViewlet = true;
				this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
			} finally {
				this.blockOpeningViewlet = false;
			}
		}

		return this.openComposite(id, focus) as PaneComposite;
	}

	getPaneComposite(id: string): PaneCompositeDescriptor | undefined {
		return this.getPaneComposites().filter(viewlet => viewlet.id === id)[0];
	}

	getPaneComposites(): PaneCompositeDescriptor[] {
		return this.viewletRegistry.getPaneComposites().sort((v1, v2) => {
			if (typeof v1.order !== 'number') {
				return -1;
			}

			if (typeof v2.order !== 'number') {
				return 1;
			}

			return v1.order - v2.order;
		});
	}

	toJSON(): object {
		return {
			type: Parts.SIDEBAR_PART
		};
	}
}
