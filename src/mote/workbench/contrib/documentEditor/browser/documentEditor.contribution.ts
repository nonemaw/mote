import { EditorPaneDescriptor, IEditorPaneRegistry } from 'mote/workbench/browser/editor';
import { IWorkbenchContributionsRegistry, WorkbenchExtensions } from 'mote/workbench/common/contributions';
import { EditorExtensions } from 'mote/workbench/common/editor';
import { DocumentEditorInput } from 'mote/workbench/contrib/documentEditor/browser/documentEditorInput';
import { DocumentEditor, DocumentEditorResolverContribution } from 'mote/workbench/contrib/documentEditor/browser/view/documentEditor';
import { LifecyclePhase } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { localize } from 'vs/nls';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		DocumentEditor,
		DocumentEditor.ID,
		localize('name', "Merge Editor")
	),
	[
		new SyncDescriptor(DocumentEditorInput)
	]
);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(DocumentEditorResolverContribution, LifecyclePhase.Starting);

