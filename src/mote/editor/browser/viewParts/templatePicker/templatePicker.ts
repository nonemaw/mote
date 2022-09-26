import * as viewEvents from 'mote/editor/common/viewEvents';
import { Button } from 'mote/base/browser/ui/button/button';
import { SVGIcon } from 'mote/base/browser/ui/icon/svgicon';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewPart } from 'mote/editor/browser/view/viewPart';
import { buttonHoverBuleBackground, mediumIconColor, mediumTextColor } from 'mote/platform/theme/common/themeColors';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { clearNode } from 'vs/base/browser/dom';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

interface Template {
	name: string;
	icon: string;
	action(): void;
}

const templates: Template[] = [
	{ icon: 'page', name: 'Import from Text (beta)', action: () => { } },
	{ icon: 'pdf', name: 'Import from PDF (beta)', action: () => { } },
	{ icon: 'page', name: 'Import from Word (beta)', action: () => { } },
];

class TemplateColumn {

	constructor(icon: string, title: string, parent: HTMLElement, themeService: IThemeService) {
		const container = document.createElement('div');
		const button = new Button(container);

		const iconSVG = new SVGIcon(icon as any);
		iconSVG.style({
			iconFill: themeService.getColorTheme().getColor(mediumIconColor),
			width: '25px',
			height: '25px'
		});
		iconSVG.element.style.marginRight = '15px';
		button.element.appendChild(iconSVG.element);
		button.element.appendChild(document.createTextNode(title));
		button.element.style.height = '36px';
		button.element.style.padding = '3px 2px';
		button.element.style.display = 'flex';
		button.element.style.alignItems = 'center';
		button.element.style.borderRadius = '3px';
		button.element.style.color = themeService.getColorTheme().getColor(mediumTextColor)!.toString();
		button.element.style.fontSize = '16px';
		button.style({
			buttonHoverBackground: themeService.getColorTheme().getColor(buttonHoverBuleBackground)
		});

		parent.appendChild(container);
	}
}

/**
 * TemplatePicker is used when a new page was created
 * It provide a quick way to fill page in a template way
 */
export class TemplatePicker extends ViewPart {

	private domNode: FastDomNode<HTMLElement>;

	constructor(
		context: ViewContext,
		linesContent: FastDomNode<HTMLElement>,
		@IThemeService private themeService: IThemeService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super(context);

		this.domNode = createFastDomNode(document.createElement('div'));
		this.domNode.setClassName('mote-template-picker');
	}

	public getDomNode(): FastDomNode<HTMLElement> {
		return this.domNode;
	}

	public prepareRender(): void {

	}

	public render(): void {
		const pageIds: string[] = this.context.contentStore.getValue() || [];
		if (pageIds.length > 0) {
			clearNode(this.domNode.domNode);
			return;
		}
		this.createPlaceholder(this.domNode);
		this.createTemplates(this.domNode);
	}

	private createPlaceholder(parent: FastDomNode<HTMLElement>) {
		const container = createFastDomNode(document.createElement('div'));
		container.domNode.style.width = '100%';
		container.domNode.style.padding = '5px 2px 25px';
		container.setFontSize(16);
		const placeholder = createFastDomNode(document.createElement('div'));
		placeholder.domNode.textContent = 'Press Enter to continue with an empty page';
		placeholder.domNode.style.color = this.themeService.getColorTheme().getColor(mediumTextColor)!.toString();

		container.appendChild(placeholder);
		parent.appendChild(container);
	}

	private createTemplates(parent: FastDomNode<HTMLElement>) {
		const container = createFastDomNode(document.createElement('div'));
		container.setClassName('mote-page-templates');
		parent.appendChild(container);

		templates.forEach(template => {
			new TemplateColumn(template.icon, template.name, container.domNode, this.themeService);
		});
	}

	public override onLinesInserted(e: viewEvents.ViewLinesInsertedEvent): boolean {
		return true;
	}

	public override onLinesDeleted(e: viewEvents.ViewLinesDeletedEvent): boolean {
		return true;
	}

	public override onLinesChanged(e: viewEvents.ViewLinesChangedEvent): boolean {
		return true;
	}
}
