import { Button } from 'mote/base/browser/ui/button/button';
import fonts from 'mote/base/browser/ui/fonts';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { EditorPane } from 'mote/workbench/browser/parts/editor/editorPane';
import { Dimension, reset, $, clearNode } from 'vs/base/browser/dom';
import { alert } from 'vs/base/browser/ui/aria/aria';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { IUserProfile } from 'mote/platform/user/common/user';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { CaffeineError } from 'mote/base/common/errors';
import { IntlProvider } from 'mote/base/common/i18n';

export class LoginPage extends EditorPane {
	public static readonly ID = 'loginPage';

	private login = true;

	private container: HTMLElement;

	private error: HTMLElement;

	private inputMap = new Map<String, HTMLInputElement>();

	constructor(
		@IThemeService themeService: IThemeService,
		@IEditorService private readonly editorService: IEditorService,
		@IUserService private readonly userService: IUserService,
	) {
		super(LoginPage.ID, themeService);

		const container = $('.login');
		const error = $('.error');
		this.error = error;
		this.container = container;

		container.style.display = 'flex';
		container.style.alignItems = 'center';
		container.style.flexDirection = 'column';
		container.style.height = 'calc(100% - 11px)';

		error.style.display = 'flex';
		error.style.justifyContent = 'center';
		error.style.color = '#ff4d4f';
		error.style.marginTop = '10px';
	}

	protected createEditor(parent: HTMLElement): void {
		reset(parent, this.container);

		const wrapper = document.createElement('div');
		wrapper.style.maxWidth = '320px';
		wrapper.style.width = '100%';
		wrapper.style.display = 'flex';
		wrapper.style.flexDirection = 'column';
		wrapper.style.alignItems = 'center';

		const header = this.createHeader();
		wrapper.appendChild(header);

		const body = document.createElement('div');
		body.style.marginTop = '25px';
		body.style.width = '100%';

		this.createInput(body, 'email', 'Enter your email address');
		this.createInput(body, 'password', 'Enter your password');
		if (!this.login) {
			this.createInput(body, 'confirm password', 'Enter your password');
		}

		body.appendChild(this.error);

		const submitBtn = this.createButton(
			body,
			IntlProvider.INSTANCE.formatMessage({ id: 'login.continueWithEmail', defaultMessage: 'Continue with email' })
		);
		submitBtn.onDidClick((e) => {
			const password = this.inputMap.get('password')?.value;
			if (!password) {
				alert('You should provide password');
				return;
			}
			let userProfile: Promise<IUserProfile>;

			if (this.login) {
				userProfile = this.userService.login({
					email: this.inputMap.get('email')?.value,
					password: password,
				});
			} else {
				userProfile = this.userService.signup({
					email: this.inputMap.get('email')?.value,
					password: password,
				});
			}

			userProfile.then((user) => {
				this.error.innerText = '';
				this.editorService.closeEditor();
			}).catch((err) => {
				if (err instanceof CaffeineError) {
					this.error.innerText = err.message;
				} else {
					this.error.innerText = 'Request failed';
				}
			});

		});
		if (this.login) {
			const registerBtn = this.createButton(
				body,
				IntlProvider.INSTANCE.formatMessage({ id: 'login.register', defaultMessage: 'Register to create a new user' })
			);
			this._register(registerBtn.onDidClick((e) => {
				this.login = false;
				clearNode(this.container);
				this.createEditor(parent);
			}));
		} else {
			const loginBtn = this.createButton(body,
				IntlProvider.INSTANCE.formatMessage({ id: 'login.loginWithExistAccount', defaultMessage: 'Login with exist account' })
			);
			this._register(loginBtn.onDidClick((e) => {
				this.login = true;
				clearNode(this.container);
				this.createEditor(parent);
			}));
		}

		wrapper.appendChild(body);
		this.container.appendChild(wrapper);
	}

	private createHeader() {
		const header = document.createElement('div');
		header.style.marginTop = '15vh';
		header.style.fontWeight = `${fonts.fontWeight.semibold}`;
		header.style.fontSize = '50px';
		header.innerText = IntlProvider.INSTANCE.formatMessage({ id: 'login.title', defaultMessage: 'Login' });
		return header;
	}

	private createInput(parent: HTMLElement, key: string, placeholder: string) {
		const container = document.createElement('div');
		container.style.marginTop = '20px';
		this.createLabel(container, key);
		this.createInputLine(container, key, placeholder);
		parent.appendChild(container);
	}

	private createLabel(parent: HTMLElement, key: string) {
		const container = document.createElement('div');
		container.style.paddingBottom = '8px';
		const label = document.createElement('label');
		label.innerText = key[0].toUpperCase() + key.slice(1);
		container.appendChild(label);

		parent.appendChild(container);
	}

	private createInputLine(parent: HTMLElement, key: string, placeholder: string) {
		const line = document.createElement('div');
		line.style.minHeight = '32px';
		line.style.lineHeight = '1.5715';
		line.style.width = '100%';

		const container = document.createElement('div');
		container.style.padding = '4px 11px';
		container.style.border = '1px solid #d9d9d9';
		container.style.backgroundColor = '#ffffff';

		const input = document.createElement('input');
		input.style.lineHeight = '1.5715';
		input.style.width = '100%';
		input.style.border = 'none';
		input.placeholder = placeholder;
		if (key.endsWith('password')) {
			input.type = 'password';
		}

		this.inputMap.set(key, input);

		container.appendChild(input);
		line.appendChild(container);
		parent.appendChild(line);
	}

	private createButton(parent: HTMLElement, title: string) {
		const span = document.createElement('span');
		span.innerText = title;
		const btn = new Button(parent, {
			style: {
				marginTop: '20px',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				height: '32px'
			}
		});
		btn.setChildren(span);
		return btn;
	}
	layout(dimension: Dimension): void {

	}

}
