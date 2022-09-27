import { Prism } from 'mote/base/browser/prism/prism';

export namespace Prismhelper {
	export function tokenize(text: string, language: string) {
		const env: Prism.Environment = {
			code: text,
			grammar: Prism.languages[language],
			language: language
		};
		Prism.hooks.run('before-tokenize', env);
		env.tokens = Prism.tokenize(env.code!, env.grammar!);
		Prism.hooks.run('after-tokenize', env);
		return env.tokens;
	}

	export function simplify(tokenStream: any) {
		return tokenStream
			.map(innerSimple)
			.filter((value: any) => !(typeof value === 'string' && isBlank(value)));

		function innerSimple(value: string | Prism.Token): string | [string, string | Prism.TokenStream] {
			if (typeof value === 'object') {
				if (Array.isArray(value.content)) {
					return [value.type, simplify(value.content)];
				} else {
					return [value.type, value.content];
				}
			} else {
				return value;
			}
		}
	}

	function isBlank(str: string) {
		return str.length === 0;
	}

}
