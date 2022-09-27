
import zhCN from 'mote/base/common/i18n/zh-CN';

export const LOCALE_ZH_CN = 'zh-CN';
export const LOCALE_EN_US = 'en-US';
export const DEFAULT_LOCALE = LOCALE_EN_US;

export type LOCALE = (typeof LOCALE_ZH_CN | typeof LOCALE_EN_US);

export function loadTranslation(locale: LOCALE): Record<string, string> {
	try {
		let translation;

		switch (locale) {
			case LOCALE_ZH_CN:
				translation = zhCN;
				break;
			default:
				translation = {};
				break;
		}

		return translation;
	} catch (error) {
		console.error('No Translation found', error);
		return {};
	}
}

export interface MessageDescriptor {
	id?: string;
	description?: string | object;
	defaultMessage?: string;
}

interface IntlShapeProps {
	locale: string;
	defaultLocale: string;
	messages: Record<string, string>;
}

class IntlShape {
	//private locale: string;
	//private defaultLocale: string;
	private messages: Record<string, string>;

	constructor(props: IntlShapeProps) {
		//this.locale = props.locale;
		//this.defaultLocale = props.defaultLocale;
		this.messages = props.messages;
	}

	formatMessage(descriptor: MessageDescriptor): string {
		let message = descriptor.defaultMessage;
		if (descriptor.id) {
			message = this.messages[descriptor.id] ?? message;
		}
		return message!;
	}
}

class IntlHolder {
	public static INSTANCE: IntlHolder = new IntlHolder();

	private intl!: IntlShape;

	constructor() {
		this.load(LOCALE_EN_US);
	}

	public load(locale: LOCALE) {
		this.intl = new IntlShape({
			locale: locale,
			defaultLocale: DEFAULT_LOCALE,
			messages: loadTranslation(locale)
		});
	}

	formatMessage(descriptor: MessageDescriptor) {
		return this.intl.formatMessage(descriptor);
	}
}

export namespace IntlProvider {
	export const INSTANCE = IntlHolder.INSTANCE;
	export function formatMessage(descriptor: MessageDescriptor) {
		return IntlHolder.INSTANCE.formatMessage(descriptor);
	}
}
