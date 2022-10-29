import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { IQuickMenuContribution, registerQuickMenuContribution } from 'mote/workbench/services/quickmenu/browser/quickmenu';

class BoldMenu implements IQuickMenuContribution {

	public static readonly ID = 'quickmenu.bold';

	constructor(editor: IMoteEditor) {

	}


}

// Register Explorer views
registerQuickMenuContribution(BoldMenu.ID, BoldMenu);
