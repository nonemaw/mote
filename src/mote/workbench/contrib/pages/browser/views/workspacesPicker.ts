import { CSSProperties } from 'mote/base/browser/jsx/style';
import { Button } from 'mote/base/browser/ui/button/button';
import { IMenuLike } from 'mote/base/browser/ui/menu/menu';
import { ThemedStyles } from 'mote/base/common/themes';
import { Emitter, Event as BaseEvent } from 'vs/base/common/event';
import { IWorkspaceContextService } from 'mote/platform/workspace/common/workspace';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { OnboardWorkspaceInput } from 'mote/workbench/contrib/onboardWorkspace/browser/onboardWorkspaceInput';
import { IntlProvider } from 'mote/base/common/i18n';
import { IThemeService, Themable } from 'mote/platform/theme/common/themeService';
import { buttonHoverBackground, iconBackground } from 'mote/platform/theme/common/themeColors';

interface ILayoutInfo {
	maxHeight: number;
	width: number;
	arrowSize: number;
	arrowOffset: number;
	inputHeight: number;
}

class PickerFooter extends Themable {

	get onDidJoinOrCreate(): BaseEvent<Event> { return this.joinOrCreate.onDidClick; }
	get onDidLogOut(): BaseEvent<Event> { return this.logOut.onDidClick; }

	protected readonly domNode: HTMLDivElement;
	private joinOrCreate!: Button;
	private logOut!: Button;

	constructor(parent: HTMLElement, themeService: IThemeService) {
		super(themeService);
		this.domNode = document.createElement('div');
		this.domNode.style.paddingTop = '6px';
		this.domNode.style.paddingBottom = '6px';
		this.domNode.style.boxShadow = 'rgb(255 255 255 / 9%) 0px -1px 0px';

		this.joinOrCreate = this.createAction(
			this.domNode,
			IntlProvider.INSTANCE.formatMessage({
				id: 'sidebar.createWorkspace',
				defaultMessage: 'Join or create workspace',
			})
		);
		this.logOut = this.createAction(
			this.domNode,
			IntlProvider.INSTANCE.formatMessage({
				id: 'sidebar.logout',
				defaultMessage: 'Log out'
			}));
		parent.append(this.domNode);
	}

	private createAction(parent: HTMLElement, name: string) {
		const container = document.createElement('div');

		const span = document.createElement('span');
		span.innerText = name;

		const actionContainer = document.createElement('div');
		actionContainer.style.minHeight = '28px';
		actionContainer.style.marginLeft = '12px';
		actionContainer.style.marginRight = '12px';
		actionContainer.style.alignItems = 'center';
		actionContainer.style.display = 'flex';
		actionContainer.appendChild(span);

		const btn = new Button(container, {
			style: {
				marginLeft: '4px',
				marginRight: '4px'
			}
		});
		btn.setChildren(actionContainer);
		btn.style({ buttonHoverBackground: this.themeService.getColorTheme().getColor(buttonHoverBackground)! });

		parent.appendChild(container);
		return btn;
	}
}

export class WorkspacesPicker extends Themable implements IMenuLike {

	private _onDidBlur = this._register(new Emitter<void>());
	readonly onDidBlur = this._onDidBlur.event;

	private _onDidCancel = this._register(new Emitter<void>({ onFirstListenerAdd: () => this.cancelHasListener = true }));
	readonly onDidCancel = this._onDidCancel.event;
	private cancelHasListener = false;

	protected readonly domNode: HTMLDivElement;
	protected arrow!: HTMLDivElement;
	protected treeContainer!: HTMLDivElement;
	protected layoutInfo!: ILayoutInfo;

	constructor(
		parent: HTMLElement,
		@IThemeService themeService: IThemeService,
		@IUserService private readonly userService: IUserService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
	) {
		super(themeService);

		this.domNode = document.createElement('div');
		parent.appendChild(this.domNode);

		const spaceStores = this.workspaceService.getSpaceStores();
		spaceStores.forEach((spaceStore) => {
			const spaceName = spaceStore.getSpaceName() || 'Untitled Space';
			this.renderWorkspace(this.domNode, spaceStore.id, spaceName);
		});

		const footer = new PickerFooter(this.domNode, this.themeService);
		this._register(footer.onDidJoinOrCreate(() => {
			this.editorService.openEditor(new OnboardWorkspaceInput());
			this._onDidBlur.fire();
		}));
		this._register(footer.onDidLogOut(() => {
			this.userService.logout();
			this._onDidBlur.fire();
		}));
	}
	getContainer(): HTMLElement {
		return this.domNode;
	}

	private renderWorkspace(element: HTMLElement, spaceId: string, title: string) {
		if (this.cancelHasListener) {

		}
		const container = document.createElement('div');
		container.style.display = 'flex';
		container.style.padding = '4px 14px';
		container.style.lineHeight = '120%';
		container.style.marginBottom = '1px';
		container.style.height = '48px';
		container.style.alignItems = 'center';

		container.appendChild(this.createIcon(title));
		container.appendChild(this.createWorkspaceDesc(title));

		const btn = new Button(element, { style: this.getButtonStyle() });
		btn.style({ buttonHoverBackground: this.themeService.getColorTheme().getColor(buttonHoverBackground)! });
		btn.setChildren(container);
		btn.onDidClick(() => {
			this.editorService.closeEditor();
			this.workspaceService.enterWorkspace(spaceId);
			this._onDidBlur.fire();
		});
	}

	private createIcon(label: string) {
		const iconContainer = document.createElement('div');
		iconContainer.style.borderRadius = '3px';
		iconContainer.style.height = '32px';
		iconContainer.style.width = '32px';
		iconContainer.style.backgroundColor = this.getColor(iconBackground)!;
		iconContainer.style.alignItems = 'center';
		iconContainer.style.justifyContent = 'center';
		iconContainer.style.display = 'flex';
		iconContainer.style.marginRight = '8px';

		const icon = document.createElement('div');
		icon.style.lineHeight = '1';
		icon.innerText = label[0];

		iconContainer.appendChild(icon);

		return iconContainer;
	}

	private createWorkspaceDesc(title: string) {
		const workspaceDesc = document.createElement('span');
		workspaceDesc.innerText = title;
		workspaceDesc.style.display = 'flex';
		workspaceDesc.style.alignItems = 'center';
		return workspaceDesc;
	}

	getBorderRight = () => {
		return {
			marginRight: 1,
			boxShadow: `1px 0 0 ${ThemedStyles.regularDividerColor.dark}`
		};
	};

	getButtonStyle = (): CSSProperties => {
		return Object.assign({
			display: 'flex',
			alignItems: 'center',
			padding: '0 8px',
			whiteSpace: 'nowrap' as any,
			height: '100%'
		}, this.getBorderRight());
	};

	style() {

	}
}
