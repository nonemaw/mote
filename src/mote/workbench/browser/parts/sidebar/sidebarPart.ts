import { Event } from 'vs/base/common/event';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { IWorkspaceContextService } from 'mote/platform/workspace/common/workspace';
import { PaneComposite, PaneCompositeDescriptor, PaneCompositeExtensions, PaneCompositeRegistry } from 'mote/workbench/browser/panecomposite';
import { CompositePart } from 'mote/workbench/browser/parts/compositePart';
import { IPaneCompositePart } from 'mote/workbench/browser/parts/paneCompositePart';
import { IPaneComposite } from 'mote/workbench/common/panecomposite';
import { SIDE_BAR_BACKGROUND } from 'mote/workbench/common/theme';
import { IWorkbenchLayoutService, Parts } from 'mote/workbench/services/layout/browser/layoutService';
import { assertIsDefined } from 'vs/base/common/types';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { Registry } from 'vs/platform/registry/common/platform';

export class SidebarPart extends CompositePart<PaneComposite> implements IPaneCompositePart {

	declare readonly _serviceBrand: undefined;


	readonly minimumWidth: number = 250;
	readonly maximumWidth: number = 450;
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;

	get onDidPaneCompositeOpen(): Event<IPaneComposite> { return Event.map(this.onDidCompositeOpen.event, compositeEvent => <IPaneComposite>compositeEvent.composite); }
	get onDidPaneCompositeClose(): Event<IPaneComposite> { return this.onDidCompositeClose.event as Event<IPaneComposite>; }


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

	override updateStyles(): void {
		super.updateStyles();

		// Part container
		const container = assertIsDefined(this.getContainer());
		container.style.backgroundColor = this.getColor(SIDE_BAR_BACKGROUND) || '';
	}

	override layout(width: number, height: number, top: number, left: number): void {
		if (!this.layoutService.isVisible(Parts.SIDEBAR_PART)) {
			return;
		}

		super.layout(width, height, top, left);
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

	getActivePaneComposite(): IPaneComposite | undefined {
		return <IPaneComposite>this.getActiveComposite();
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

	//#endregion

	toJSON(): object {
		return {
			type: Parts.SIDEBAR_PART
		};
	}

	hideActivePaneComposite(): void {
		this.hideActiveComposite();
	}
}
