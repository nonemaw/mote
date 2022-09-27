import { setStyles } from 'mote/base/browser/jsx/createElement';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { Button } from 'mote/base/browser/ui/button/button';
import fonts from 'mote/base/browser/ui/fonts';
import { IntlProvider } from 'mote/base/common/i18n';
import { ThemedColors, ThemedStyles } from 'mote/base/common/themes';
import { inputBackground, mediumTextColor, outlineButtonBorder, regularTextColor } from 'mote/platform/theme/common/themeColors';
import { IThemeService, Themable } from 'mote/platform/theme/common/themeService';
import { IWorkspaceContextService } from 'mote/platform/workspace/common/workspace';
import { EditorPane } from 'mote/workbench/browser/parts/editor/editorPane';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { Dimension, $, reset, clearNode } from 'vs/base/browser/dom';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';

class OnboardContainer extends Themable {
	create(title: string, subTitle: string | undefined, bodyDom: HTMLElement, footerDom?: HTMLElement) {
		const container = $('.container');
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.justifyContent = 'center';
		container.style.height = '100vh';

		const headerDom = this.createHeader(title, subTitle);
		container.appendChild(headerDom);

		const bodyContainer = $('.container-body');
		bodyContainer.style.display = 'flex';
		bodyContainer.style.flexDirection = 'column';
		bodyContainer.style.paddingBottom = '32px';
		bodyContainer.appendChild(bodyDom);
		container.appendChild(bodyContainer);

		const footerContainer = $('.container-footer');
		if (footerDom) {
			footerContainer.appendChild(footerDom);
		}

		container.appendChild(footerContainer);
		return container;
	}

	createHeader(title: string, subTitle?: string) {
		const header = $('.container-header');
		setStyles(header, this.getHeaderStyle());

		const titleDom = $('.container-title');
		setStyles(titleDom, this.getTitleStyle());
		titleDom.innerText = title;

		header.appendChild(titleDom);

		if (subTitle) {
			const subTitleDom = $('.container-subtitle');
			setStyles(subTitleDom, this.getSubtitleStyle());
			subTitleDom.innerText = subTitle;
			header.appendChild(subTitleDom);
		}
		return header;
	}

	getHeaderStyle(): CSSProperties {
		return {
			position: 'relative',
			textAlign: 'center',
			paddingTop: '42px',
			paddingBottom: '32px',
			marginLeft: 'auto',
			marginRight: 'auto',
			maxWidth: '520px'
		};
	}

	getTitleStyle() {
		return {
			fontWeight: fonts.fontWeight.semibold,
			fontSize: '28px',
			color: this.getColor(regularTextColor)!,
		};
	}

	getSubtitleStyle() {
		return {
			fontSize: '18px',
			lineHeight: 1.3,
			paddingTop: '2px',
			color: this.getColor(mediumTextColor)!,
			fontWeight: fonts.fontWeight.regular
		};
	}
}

interface WorkspacePlan {
	checked?: boolean;
	illustration: string;
	label: string;
	description: string;
	callout: string;
	plan: string;
}

class PlanPicker extends Themable {
	public plan = 'local';

	private container!: HTMLElement;

	create(parent: HTMLElement) {
		const container = $('.picker-container');
		this.container = container;
		setStyles(container, this.getToggleGroupWrap());
		container.style.display = 'inline-flex';
		parent.appendChild(container);
		this.render();
	}

	private render() {
		const isLocalPlan = this.plan === 'local';
		this.createPlan(this.container, {
			checked: isLocalPlan,
			illustration: '/static/sources/image/onboarding/use-case-note.png',
			plan: 'local',
			label: IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspacePlanChoose.local.label', defaultMessage: 'For local usage' }),
			description: IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspacePlanChoose.local.description', defaultMessage: 'Keep you data local. Never sync to cloud. More safe.' }),
			callout: IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspacePlanChoose.local.callout', defaultMessage: 'Free to use' }),
		});
		this.createPlan(this.container, {
			checked: !isLocalPlan,
			illustration: '/static/sources/image/onboarding/team-features-illustration.png',
			plan: 'personal',
			label: IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspacePlanChoose.personal.label', defaultMessage: 'For anywhere' }),
			description: IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspacePlanChoose.personal.description', defaultMessage: 'Save to cloud. Write better. Think more clearly. Stay organized.' }),
			callout: IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspacePlanChoose.personal.callout', defaultMessage: 'Start for free' }),
		});
	}

	handlePlanTypeSelect(plan: string) {
		this.plan = plan;
		clearNode(this.container);
		this.render();
	}

	createPlan(parent: HTMLElement, plan: WorkspacePlan) {

		const button = new Button(parent, {
			style: this.getToggleButtonStyle(plan.checked),
			hoverStyle: this.getToggleButtonHoveredStyle()
		});

		const header = $('header');
		header.innerText = plan.label;
		setStyles(header, this.getButtonHeadingStyle());
		const description = $('p');
		description.innerText = plan.description;
		setStyles(description, this.getButtonSubheadingStyle());
		const callout = $('p');
		callout.innerText = plan.callout;
		setStyles(callout, this.getCalloutStyle(plan.checked));

		const main = $('main');
		setStyles(main, this.getButtonTextStyle());
		main.appendChild(header);
		main.appendChild(description);
		main.appendChild(callout);

		const checkMarkImg: HTMLImageElement = $('img');
		setStyles(checkMarkImg, this.getButtonCheckmarkStyle());
		checkMarkImg.src = `/static/sources/image/onboarding/${plan.checked ? 'checked.svg' : 'unchecked.svg'}`;

		const illustration = $('div');
		illustration.style.height = '90px';
		const illustrationImg: HTMLImageElement = $('img');
		illustrationImg.src = plan.illustration;
		illustrationImg.style.height = '100%';
		illustration.appendChild(illustrationImg);

		button.element.appendChild(checkMarkImg);
		button.element.appendChild(illustration);
		button.element.appendChild(main);

		button.onDidClick(() => this.handlePlanTypeSelect(plan.plan));
	}

	getToggleButtonHoveredStyle() {
		return {
			opacity: 1,
			background: 'white'
		};
	}

	getButtonTextStyle() {
		return {
			margin: '20px',
			flex: 1
		};
	}

	getButtonCheckmarkStyle(): CSSProperties {
		return {
			position: 'absolute',
			top: '12px',
			right: '12px',
			height: '24px',
			width: '24px'
		};
	}

	getButtonHeadingStyle() {
		return {
			fontWeight: fonts.fontWeight.semibold,
			fontSize: '18px',
			marginTop: '30px',
			color: '#37352f'
		};
	}

	getBaseSubheadingStyle() {
		return {
			color: '#37352fa6',
			fontSize: '14px',
			lineHeight: 1.4,
			transition: 'all 200ms ease'
		};
	}

	getButtonSubheadingStyle() {
		return Object.assign({}, this.getBaseSubheadingStyle(), {
			marginTop: '12px',
			marginBottom: '8px'
		});
	}

	getCalloutStyle(checked?: boolean) {
		return Object.assign({}, this.getBaseSubheadingStyle(), {
			opacity: checked ? 1 : .7,
			filter: checked ? void 0 : 'grayscale(100%)',
			color: ThemedColors.blue,
			marginTop: '12px',
			fontWeight: 500,
			lineHeight: 1
		});
	}

	getToggleGroupWrap(): CSSProperties {
		return {
			marginTop: '10px',
			marginBottom: '32px',
			display: 'inline-flex',
			width: '100%',
			justifyContent: 'center'
		};
	}

	getToggleButtonStyle(checked?: boolean): CSSProperties {
		const buttonBorder = this.getColor(outlineButtonBorder)!;
		const style: CSSProperties = {
			margin: '12px',
			textAlign: 'center',
			width: '230px',
			height: '218px',
			borderRadius: '5px',
			padding: '40px 0',
			boxShadow: "".concat(buttonBorder, " 0 0 0 1px, rgba(167, 167, 167, 0.25) 0px 1px 2px")
		};

		const checkedStyle = {
			boxShadow: "".concat(ThemedColors.blue, " 0 0 0 2px, rgba(182, 182, 182, 0.25) 0px 8px 12px")
		};

		const uncheckdStyle = {
			opacity: 0.7
		};

		return Object.assign({}, {
			alignItems: "center",
			justifyContent: "center",
			whiteSpace: "normal" as any,
			borderRadius: 5,
			fontSize: 14,
			lineHeight: 1.2,
			background: "white",
			position: "relative" as any,
			transition: "all 200ms ease"
		}, style, {}, checked ? checkedStyle : uncheckdStyle);
	}

}

export class OnboardWorkspacePage extends EditorPane {
	public static readonly ID = 'onboardWorkspacePage';

	private container: HTMLElement;
	private stage: string;
	private plan: string = '';

	constructor(
		@IThemeService themeService: IThemeService,
		@IDialogService dialogService: IDialogService,
		@IWorkspaceContextService private workspaceService: IWorkspaceContextService,
		@IUserService private userService: IUserService,
		@IEditorService private editorService: IEditorService,
	) {
		super(OnboardWorkspacePage.ID, themeService);

		this.stage = 'workspace_plan_choose';

		const container = $('.onboard');
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.justifyContent = 'center';
		this.container = container;
	}

	protected createEditor(parent: HTMLElement): void {
		reset(parent, this.container);
		parent.append(this.container);
		this.render();
	}

	private render() {
		clearNode(this.container);
		switch (this.stage) {
			case 'workspace_plan_choose':
				this.createPlanPicker(this.container);
				break;
			case 'workspace_create':
				this.createWorkspace(this.container);
				break;
		}
	}

	private createWorkspace(parent: HTMLElement) {
		const container = new OnboardContainer(this.themeService);

		const formDom = $('.onboard-form');
		formDom.style.alignSelf = 'center';
		formDom.style.width = '280px';

		const label = $('div');
		label.style.marginTop = '16px';
		label.style.marginBottom = '5px';
		label.style.color = this.getColor(mediumTextColor)!;
		label.innerText = IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspaceCreate.inputHelp', defaultMessage: 'Workspace name' });

		const input: HTMLInputElement = $('input');
		input.placeholder = 'Mote space';
		input.style.width = '100%';
		input.style.padding = '0px';
		input.style.background = 'none';
		input.style.color = 'inherit';
		input.style.border = 'none';
		input.style.minHeight = '20px';

		const inputContainer = $('');
		setStyles(inputContainer, this.getBaseInputStyle());
		inputContainer.appendChild(input);

		parent.appendChild(container.create(
			IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspaceCreate.title', defaultMessage: 'Create a new workspace' }),
			IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspaceCreate.subtitle', defaultMessage: 'Fill in some details for your workspace.' }),
			formDom
		));

		formDom.appendChild(label);
		formDom.appendChild(inputContainer);

		const button = new Button(formDom, { style: this.getButtonStyle() });
		button.element.style.marginTop = '15px';
		button.element.innerText = IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspaceCreate.continue', defaultMessage: 'Continue' });
		button.onDidClick(() => {
			const userId = this.plan === 'local' ? 'local' : this.userService.currentProfile?.id;
			this.workspaceService.createWorkspace(userId!, input.value);
			this.editorService.closeEditor();
		});
	}

	getBaseInputStyle(): CSSProperties {
		return {
			display: 'flex',
			alignItems: 'center',
			width: '100%',
			fontSize: '14px',
			lineHeight: '20px',
			paddingTop: '4px',
			paddingBottom: '4px',
			paddingLeft: '10px',
			paddingRight: '10px',
			position: 'relative',
			borderRadius: '3px',
			boxShadow: ThemedStyles.inputBoxShadow.dark,
			background: this.getColor(inputBackground)!,
			cursor: 'text'
		};
	}

	private createPlanPicker(parent: HTMLElement) {
		const container = new OnboardContainer(this.themeService);

		const pickerDom = $('.onboard-picker');
		pickerDom.style.display = 'flex';
		pickerDom.style.flexDirection = 'column';
		pickerDom.style.justifyContent = 'center';
		pickerDom.style.alignItems = 'center';

		const planPicker = new PlanPicker(this.themeService);
		planPicker.create(pickerDom);
		parent.appendChild(container.create(
			IntlProvider.INSTANCE.formatMessage({
				id: 'onboarding.workspacePlanChoose.title',
				defaultMessage: 'How are you planning to use Mote?'
			}),
			IntlProvider.INSTANCE.formatMessage({
				id: 'onboarding.workspacePlanChoose.subtitle',
				defaultMessage: 'We’ll streamline your setup experience accordingly.'
			}),
			pickerDom
		));

		const button = new Button(pickerDom, { style: this.getButtonStyle() });
		button.element.innerText = IntlProvider.INSTANCE.formatMessage({ id: 'onboarding.workspacePlanChoose.continue', defaultMessage: 'Continue' });
		button.onDidClick(() => {
			this.plan = planPicker.plan;
			this.stage = 'workspace_create';
			this.render();
		});
	}

	getButtonStyle(): CSSProperties {
		return {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			whiteSpace: "nowrap",
			borderRadius: '3px',
			boxShadow: ThemedStyles.buttonBoxShadow.light,
			background: ThemedColors.blue,
			color: ThemedColors.white,
			fill: ThemedColors.white,
			lineHeight: 1.2,
			paddingLeft: '12px',
			paddingRight: '12px',
			fontSize: '14px',
			fontWeight: fonts.fontWeight.medium,
			width: "280px",
			height: '32px',
			marginBottom: '42px'
		};
	}

	layout(dimension: Dimension): void {

	}
}
