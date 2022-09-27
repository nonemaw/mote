import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { registerEditorContribution } from 'mote/editor/browser/editorExtensions';
import { IEditorContribution } from 'mote/editor/common/editorCommon';
import { TopbarWidget } from 'mote/editor/contrib/topbar/browser/topbarWidget';
import { IContextViewService } from 'mote/platform/contextview/browser/contextView';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { Disposable } from 'vs/base/common/lifecycle';

export class TopbarController extends Disposable implements IEditorContribution {
	public static readonly ID = 'editor.contrib.topbarController';

	private widget!: TopbarWidget;

	constructor(
		readonly editor: IMoteEditor,
		@IUserService userService: IUserService,
		@IThemeService themeService: IThemeService,
		@IContextViewService contextViewService: IContextViewService,
	) {
		super();

		if (userService.currentProfile) {
			this.widget = new TopbarWidget(editor, themeService, contextViewService);
			this.registerListeners();
		}
	}

	private registerListeners() {
		this.widget.onDidShareBtnClick(() => {
			this.showShareSettings();
		});
	}

	private showShareSettings() {

	}
}

registerEditorContribution(TopbarController.ID, TopbarController);
