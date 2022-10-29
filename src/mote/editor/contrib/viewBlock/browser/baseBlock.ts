import { CSSProperties } from 'mote/base/browser/jsx/style';
import { EditableHandler, EditableHandlerOptions } from 'mote/editor/browser/controller/editableHandler';
import { renderSegments } from 'mote/editor/browser/textRenderer';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { Segment } from 'mote/editor/common/segment';
import BlockStore from 'mote/platform/store/common/blockStore';
import { lightTextColor } from 'mote/platform/theme/common/themeColors';
import { IThemeService, Themable } from 'mote/platform/theme/common/themeService';
import { FastDomNode } from 'vs/base/browser/fastDomNode';

export abstract class BaseBlock extends Themable {
	protected editableHandler: EditableHandler;

	constructor(
		lineNumber: number,
		viewContext: ViewContext,
		viewController: ViewController,
		protected readonly options: EditableHandlerOptions,
		@IThemeService themeService: IThemeService,
	) {
		super(themeService);
		this.editableHandler = this.renderPersisted(lineNumber, viewContext, viewController);
		this.editableHandler.editable.domNode.style.minHeight = '1em';

		const style = this.getStyle();
		if (style) {
			this.editableHandler.applyStyles(style);
		}
		this.editableHandler.style({ textFillColor: this.themeService.getColorTheme().getColor(lightTextColor)! });

		if (viewController.getSelection().lineNumber === lineNumber) {
			this.editableHandler.focusEditable();
		}
	}

	abstract renderPersisted(lineNumber: number, viewContext: ViewContext, viewController: ViewController): EditableHandler;

	protected getStyle(): void | CSSProperties {

	}

	setValue(store: BlockStore) {
		const segments = store.getTitleStore().getValue();
		const html = renderSegments(segments.map(Segment.from)).join('');
		this.editableHandler.setValue(html);
		this.editableHandler.setEnabled(store.canEdit());
	}

	getDomNode(): FastDomNode<HTMLElement> {
		return this.editableHandler.editable;
	}
}
