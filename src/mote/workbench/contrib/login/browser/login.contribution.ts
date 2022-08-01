import { EditorPaneDescriptor, IEditorPaneRegistry } from 'mote/workbench/browser/editor';
import { EditorExtensions } from 'mote/workbench/common/editor';
import { LoginPage } from 'mote/workbench/contrib/login/browser/login';
import { LoginInput } from 'mote/workbench/contrib/login/browser/loginInput';
import { localize } from 'vs/nls';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		LoginPage,
		LoginPage.ID,
		localize('login', "Login")
	),
	[new SyncDescriptor(LoginInput)]
);
