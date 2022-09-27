import { IMenuLike } from 'mote/base/browser/ui/menu/menu';
import { IntlProvider } from 'mote/base/common/i18n';
import { IContextViewService } from 'mote/platform/contextview/browser/contextView';
import { BrowserContextViewBasedService } from 'mote/platform/contextview/browser/contextViewBasedService';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { IWorkspaceContextService } from 'mote/platform/workspace/common/workspace';
import { WorkspaceHeaderView } from 'mote/workbench/contrib/pages/browser/views/workspaceHeaderView';
import { WorkspacesPicker } from 'mote/workbench/contrib/pages/browser/views/workspacesPicker';
import { addDisposableListener, clearNode, EventType } from 'vs/base/browser/dom';
import { Gesture, EventType as TouchEventType } from 'vs/base/browser/touch';
import { IMenuOptions } from 'vs/base/browser/ui/menu/menu';
import { IAction, Separator } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class WorkspacesController extends BrowserContextViewBasedService {

	static readonly HEIGHT = 45;

	private headerView!: WorkspaceHeaderView;

	private picker!: WorkspacesPicker;

	constructor(
		private readonly container: HTMLElement,
		@IThemeService themeService: IThemeService,
		@IContextViewService contextViewService: IContextViewService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super(themeService, contextViewService);

		container.style.height = '45px';
		container.style.alignItems = 'center';
		container.style.display = 'flex';
		container.style.cursor = 'pointer';

		this.headerView = new WorkspaceHeaderView(themeService);
		this.headerView.create(container, this.getTitle());

		this._register(workspaceService.onDidChangeWorkspace(() => {
			clearNode(container);
			this.headerView = new WorkspaceHeaderView(themeService);
			this.headerView.create(container, this.getTitle());
		}));

		this._register(Gesture.addTarget(container));

		[EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._register(addDisposableListener(container, eventType, e => this.onDidClick()));
		});
		this.configure({ blockMouse: false });
	}

	createMenu(container: HTMLElement, actions: readonly IAction[], options: IMenuOptions): IMenuLike {
		this.picker = this.instantiationService.createInstance(WorkspacesPicker, container);
		return this.picker;
	}

	onDidClick() {
		this.showContextMenu({
			getActions: () => [new Separator()],
			getAnchor: () => this.container
		});
	}

	getTitle() {
		const spaceStore = this.workspaceService.getSpaceStore();
		if (spaceStore) {
			return spaceStore && spaceStore.getSpaceName() || 'Untitled Space';
		}
		return IntlProvider.INSTANCE.formatMessage({ id: 'sidebar.createWorkspace', defaultMessage: 'Create a new space' });
	}
}
