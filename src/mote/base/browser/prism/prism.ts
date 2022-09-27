



/**
 * The expansion of a simple `RegExp` literal to support additional properties.
 */
export interface TokenObject {
	/**
	 * The regular expression of the token.
	 */
	pattern: RegExp;

	/**
	 * If `true`, then the first capturing group of `pattern` will (effectively) behave as a lookbehind
	 * group meaning that the captured text will not be part of the matched text of the new token.
	 */
	lookbehind?: boolean | undefined;

	/**
	 * Whether the token is greedy.
	 *
	 * @default false
	 */
	greedy?: boolean | undefined;

	/**
	 * An optional alias or list of aliases.
	 */
	alias?: string | string[] | undefined;

	/**
	 * The nested tokens of this token.
	 *
	 * This can be used for recursive language definitions.
	 *
	 * Note that this can cause infinite recursion.
	 */
	inside?: Grammar | undefined;
}

export type GrammarValue = RegExp | TokenObject | Array<RegExp | TokenObject>;
export type Grammar = GrammarRest | Record<string, GrammarValue>;

export interface GrammarRest {
	keyword?: GrammarValue | undefined;
	number?: GrammarValue | undefined;
	function?: GrammarValue | undefined;
	string?: GrammarValue | undefined;
	boolean?: GrammarValue | undefined;
	operator?: GrammarValue | undefined;
	punctuation?: GrammarValue | undefined;
	atrule?: GrammarValue | undefined;
	url?: GrammarValue | undefined;
	selector?: GrammarValue | undefined;
	property?: GrammarValue | undefined;
	important?: GrammarValue | undefined;
	style?: GrammarValue | undefined;
	comment?: GrammarValue | undefined;
	'class-name'?: GrammarValue | undefined;

	/**
	 * An optional grammar object that will appended to this grammar.
	 */
	rest?: Grammar | undefined;
}

class LinkedListNode<T> {
	constructor(
		public value: T | null,
		public prev: LinkedListNode<T> | null,
		public next: LinkedListNode<T> | null,
	) {

	}
}

class LinkedList<T> {

	public head: LinkedListNode<T>;
	public tail: LinkedListNode<T>;
	public length: number;

	constructor() {
		this.head = new LinkedListNode<T>(null, null, null);
		this.tail = new LinkedListNode<T>(null, this.head, null);
		this.head.next = this.tail;
		this.length = 0;
	}
}

interface RematchOptions {
	cause: string;
	reach: number;
}

// The grammar object for plaintext
const plainTextGrammar = {
};

let uniqueId = 0;

export namespace Prism {

	export interface Environment extends Record<string, any> {
		selector?: string | undefined;
		element?: Element | undefined;
		language?: string | undefined;
		grammar?: Grammar | undefined;
		code?: string | undefined;
		highlightedCode?: string | undefined;
		type?: string | undefined;
		content?: string | undefined;
		tag?: string | undefined;
		classes?: string[] | undefined;
		attributes?: Record<string, string> | undefined;
		parent?: Array<string | Token> | undefined;
	}

	/**
	 * A namespace for utility methods.
	 *
	 * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
	 * change or disappear at any time.
	 */
	export namespace util {

		/** Encode raw strings in tokens in preparation to display as HTML */
		export function encode(tokens: TokenStream): TokenStream {
			if (tokens instanceof Token) {
				return new Token(tokens.type, encode(tokens.content), tokens.alias);
			} else if (Array.isArray(tokens)) {
				return tokens.map(encode) as TokenStream;
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		}

		export function deepClone<T extends Object>(o: T, visited?: Record<number, any>) {
			visited = visited || {};

			let clone: any; let id;
			switch (Prism.util.type(o)) {
				case 'Object':
					id = Prism.util.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = /** @type {Record<string, any>} */ ({});
					visited[id] = clone;

					for (const key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = deepClone(o[key] as any, visited);
						}
					}

					return /** @type {any} */ (clone);

				case 'Array':
					id = Prism.util.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = [];
					visited[id] = clone;

					(o as any).forEach(function (v: any, i: any) {
						clone[i] = deepClone(v, visited);
					});

					return /** @type {any} */ (clone);

				default:
					return o;
			}
		}

		export function objId(obj: any) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		}

		export function type(o: any) {
			return Object.prototype.toString.call(o).slice(8, -1);
		}
	}

	export type Languages = LanguageMapProtocol & LanguageMap;

	export interface LanguageMap {
		/**
		 * Get a defined language's definition.
		 */
		[language: string]: Grammar;
	}

	export interface LanguageMapProtocol {
		/**
		 * Creates a deep copy of the language with the given id and appends the given tokens.
		 *
		 * If a token in `redef` also appears in the copied language, then the existing token in the copied language
		 * will be overwritten at its original position.
		 *
		 * @param id The id of the language to extend. This has to be a key in `Prism.languages`.
		 * @param redef The new tokens to append.
		 * @returns The new language created.
		 * @example
		 * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
		 *     'color': /\b(?:red|green|blue)\b/
		 * });
		 */
		extend(id: string, redef: Grammar): Grammar;


	}

	export const languages: LanguageMap = {
		txt: plainTextGrammar,
		clike: plainTextGrammar,
	};

	/**
	 * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
	 */
	export namespace language {
		export function extend(id: string, redef: Grammar): Grammar {
			const lang: Grammar = Prism.util.deepClone(Prism.languages[id] || {});

			for (const key in redef) {
				(lang as any)[key] = (redef as any)[key];
			}

			return lang;
		}

		/**
		 * Inserts tokens _before_ another token in a language definition or any other grammar.
		 *
		 * As this needs to recreate the object (we cannot actually insert before keys in object literals),
		 * we cannot just provide an object, we need an object and a key.
		 *
		 * If the grammar of `inside` and `insert` have tokens with the same name, the tokens in `inside` will be ignored.
		 *
		 * All references of the old object accessible from `Prism.languages` or `insert` will be replace with the new one.
		 *
		 * @param inside The property of `root` that contains the object to be modified.
		 *
		 * This is usually a language id.
		 * @param before The key to insert before.
		 * @param insert An object containing the key-value pairs to be inserted.
		 * @param [root] The object containing `inside`, i.e. the object that contains the object that will be modified.
		 *
		 * Defaults to `Prism.languages`.
		 * @returns The new grammar created.
		 * @example
		 * Prism.languages.insertBefore('markup', 'cdata', {
		 *     'style': { ... }
		 * });
		 */
		export function insertBefore(inside: string, before: string, insert: Grammar, root?: LanguageMap): Grammar {
			root = root || (Prism.languages);
			const grammar = root[inside];
			const ret: Grammar = {};

			for (const token in grammar) {
				if (grammar.hasOwnProperty(token)) {

					if (token === before) {
						for (const newToken in insert) {
							if (insert.hasOwnProperty(newToken)) {
								(ret as any)[newToken] = (insert as any)[newToken];
							}
						}
					}

					// Do not insert token which also occur in insert. See #1525
					if (!insert.hasOwnProperty(token)) {
						(ret as any)[token] = (grammar as any)[token];
					}
				}
			}

			//const old = root[inside];
			root[inside] = ret;

			// Update references in other language definitions
			/*
			Prism.languages.DFS(Prism.languages, function (key:string, value:any) {
				if (value === old && key !== inside) {
					Prism.languages.DFS[key] = ret;
				}
			});
			*/

			return ret;
		}
	}

	export namespace hooks {
		/**
		 * @param env The environment variables of the hook.
		 */
		type HookCallback = (env: Environment) => void;

		const all: { [key: string]: HookCallback[] } = {};

		/**
		 * Adds the given callback to the list of callbacks for the given hook.
		 *
		 * The callback will be invoked when the hook it is registered for is run.
		 * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
		 *
		 * One callback function can be registered to multiple hooks and the same hook multiple times.
		 *
		 * @param name The name of the hook.
		 * @param callback The callback function which is given environment variables.
		 */
		export function add(name: string, callback: HookCallback) {
			const hooks = all;
			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		}

		/**
		 * Runs a hook invoking all registered callbacks with the given environment variables.
		 *
		 * Callbacks will be invoked synchronously and in the order in which they were registered.
		 *
		 * @param name The name of the hook.
		 * @param env The environment variables of the hook passed to all callbacks registered.
		 */
		export function run(name: string, env: Environment) {
			const callbacks = all[name];
			if (!callbacks || !callbacks.length) {
				return;
			}

			for (let i = 0, callback; (callback = callbacks[i++]);) {
				callback(env);
			}
		}
	}

	/**
	 * A token stream is an array of strings and {@link Token Token} objects.
	 *
	 * Token streams have to fulfill a few properties that are assumed by most functions (mostly internal ones) that process
	 * them.
	 *
	 * 1. No adjacent strings.
	 * 2. No empty strings.
	 *
	 *    The only exception here is the token stream that only contains the empty string and nothing else.
	 *
	 */
	export type TokenStream = string | Token | Array<string | Token>;

	export class Token {

		public readonly length: number;

		constructor(
			/**
			 * The type of the token.
			 * This is usually the key of a pattern in a {@link Grammar}.
			 */
			public type: string,
			/**
			 * The strings or tokens contained by this token.
			 * This will be a token stream if the pattern matched also defined an `inside` grammar.
			 */
			public content: string | TokenStream,
			/**
			 * The alias(es) of the token.
			 */
			public alias: string | string[],
			/**
			 * A copy of the full string this token was created from.
			 */
			public matchedStr: string = ''
		) {
			// Copy of the full string this token was created from
			this.length = (matchedStr || '').length | 0;
		}

		/**
		 *
		 * @param o The token or token stream to be converted.
		 * @param language The name of current language.
		 * @returns The HTML representation of the token or token stream.
		 */
		static stringify(o: string | Token | TokenStream, language: string): string {
			if (typeof o === 'string') {
				return o;
			}
			if (Array.isArray(o)) {
				let s = '';
				o.forEach(function (e) {
					s += Token.stringify(e, language);
				});
				return s;
			}

			const env: Environment = {
				type: o.type,
				content: Token.stringify(o.content, language),
				tag: 'span',
				classes: ['token', o.type],
				attributes: {},
				language: language
			};

			const aliases = o.alias;
			if (aliases) {
				if (Array.isArray(aliases)) {
					Array.prototype.push.apply(env.classes, aliases);
				} else {
					env.classes!.push(aliases);
				}
			}

			Prism.hooks.run('wrap', env);

			let attributes = '';
			for (const name in env.attributes) {
				attributes += ' ' + name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
			}

			return '<' + env.tag + ' class="' + env.classes!.join(' ') + '"' + attributes + '>' + env.content + '</' + env.tag + '>';
		}
	}
	/**
	 * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
	 * and the language definitions to use, and returns an array with the tokenized code.
	 *
	 * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
	 *
	 * This method could be useful in other contexts as well, as a very crude parser.
	 *
	 * @param text A string with the code to be highlighted.
	 * @param grammar An object containing the tokens to use.
	 */
	export function tokenize(text: string, grammar: Grammar): TokenStream {
		const rest = grammar.rest;
		if (rest) {
			for (const token in rest) {
				(grammar as any)[token] = (rest as any)[token];
			}

			delete grammar.rest;
		}

		const tokenList = new LinkedList<string>();
		addAfter(tokenList, tokenList.head, text);

		matchGrammar(text, tokenList, grammar, tokenList.head, 0);

		return toArray(tokenList);
	}

	/**
	 * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
	 * and the language definitions to use, and returns a string with the HTML produced.
	 *
	 * The following hooks will be run:
	 * 1. `before-tokenize`
	 * 2. `after-tokenize`
	 * 3. `wrap`: On each {@link Token}.
	 *
	 * @param text A string with the code to be highlighted.
	 * @param grammar An object containing the tokens to use.
	 * Usually a language definition like `Prism.languages.markup`.
	 * @param language The name of the language definition passed to `grammar`.
	 * @returns The highlighted HTML.
	 */
	export function highlight(text: string, grammar: Grammar, language: string): string {
		const env: Environment = {
			code: text,
			grammar: grammar,
			language: language
		};
		Prism.hooks.run('before-tokenize', env);
		env.tokens = Prism.tokenize(env.code!, env.grammar!);
		Prism.hooks.run('after-tokenize', env);
		return Token.stringify(Prism.util.encode(env.tokens), env.language!);
	}

	function matchGrammar(
		text: string, tokenList: LinkedList<string | Token>, grammar: any,
		startNode: LinkedListNode<string | Token>,
		startPos: number, rematch?: RematchOptions
	) {
		for (const token in grammar) {
			if (!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			let patterns = grammar[token];
			patterns = Array.isArray(patterns) ? patterns : [patterns];

			for (let j = 0; j < patterns.length; ++j) {
				if (rematch && rematch.cause === token + ',' + j) {
					return;
				}

				const patternObj = patterns[j];
				const inside = patternObj.inside;
				const lookbehind = !!patternObj.lookbehind;
				const greedy = !!patternObj.greedy;
				const alias = patternObj.alias;

				if (greedy && !patternObj.pattern.global) {
					// Without the global flag, lastIndex won't work
					const flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
					patternObj.pattern = RegExp(patternObj.pattern.source, flags + 'g');
				}

				/** @type {RegExp} */
				const pattern = patternObj.pattern || patternObj;

				for ( // iterate the token list and keep track of the current token/string position
					let currentNode = startNode.next!, pos = startPos;
					currentNode !== tokenList.tail;
					pos += currentNode.value!.length, currentNode = currentNode.next!
				) {

					if (rematch && pos >= rematch.reach) {
						break;
					}

					let str = currentNode.value!;

					if (tokenList.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					let removeCount = 1; // this is the to parameter of removeBetween
					let match;

					if (greedy) {
						match = matchPattern(pattern, pos, text, lookbehind);
						if (!match || match.index >= text.length) {
							break;
						}

						const from = match.index;
						const to = match.index + match[0].length;
						let p = pos;

						// find the node that contains the match
						p += currentNode.value!.length;
						while (from >= p) {
							currentNode = currentNode.next!;
							p += currentNode.value!.length;
						}
						// adjust pos (and p)
						p -= currentNode.value!.length;
						pos = p;

						// the current node is a Token, then the match starts inside another Token, which is invalid
						if (currentNode.value instanceof Token) {
							continue;
						}

						// find the last node which is affected by this match
						for (
							let k = currentNode;
							k !== tokenList.tail && (p < to || typeof k.value === 'string');
							k = k.next!
						) {
							removeCount++;
							p += k.value!.length;
						}
						removeCount--;

						// replace with the new match
						str = text.slice(pos, p);
						match.index -= pos;
					} else {
						match = matchPattern(pattern, 0, str, lookbehind);
						if (!match) {
							continue;
						}
					}

					// eslint-disable-next-line no-redeclare
					const from = match.index;
					const matchStr = match[0];
					const before = str.slice(0, from);
					const after = str.slice(from + matchStr.length);

					const reach = pos + str.length;
					if (rematch && reach > rematch.reach) {
						rematch.reach = reach;
					}

					let removeFrom = currentNode.prev!;

					if (before) {
						removeFrom = addAfter(tokenList, removeFrom, before);
						pos += before.length;
					}

					removeRange(tokenList, removeFrom, removeCount);

					const wrapped = new Token(token, inside ? Prism.tokenize(matchStr, inside) : matchStr, alias, matchStr);
					currentNode = addAfter(tokenList, removeFrom, wrapped);

					if (after) {
						addAfter(tokenList, currentNode, after);
					}

					if (removeCount > 1) {
						// at least one Token object was removed, so we have to do some rematching
						// this can only happen if the current pattern is greedy

						/** @type {RematchOptions} */
						const nestedRematch = {
							cause: token + ',' + j,
							reach: reach
						};
						matchGrammar(text, tokenList, grammar, currentNode.prev!, pos, nestedRematch);

						// the reach might have been extended because of the rematching
						if (rematch && nestedRematch.reach > rematch.reach) {
							rematch.reach = nestedRematch.reach;
						}
					}
				}
			}
		}
	}

	function matchPattern(pattern: RegExp, pos: number, text: string, lookbehind: boolean): RegExpExecArray | null {
		pattern.lastIndex = pos;
		const match = pattern.exec(text);
		if (match && lookbehind && match[1]) {
			// change the match to remove the text matched by the Prism lookbehind group
			const lookbehindLength = match[1].length;
			match.index += lookbehindLength;
			match[0] = match[0].slice(lookbehindLength);
		}
		return match;
	}

	/**
	 * Adds a new node with the given value to the list.
	 */
	function addAfter<T>(list: LinkedList<T>, node: LinkedListNode<T>, value: T): LinkedListNode<T> {
		// assumes that node != list.tail && values.length >= 0
		const next = node.next!;

		const newNode = { value: value, prev: node, next: next };
		node.next = newNode;
		next.prev = newNode;
		list.length++;

		return newNode;
	}

	/**
	 * Removes `count` nodes after the given node. The given node will not be removed.
	 *
	 */
	function removeRange<T>(list: LinkedList<T>, node: LinkedListNode<T>, count: number) {
		let next = node.next!;
		let i = 0;
		for (i = 0; i < count && next !== list.tail; i++) {
			next = next.next!;
		}
		node.next = next;
		next.prev = node;
		list.length -= i;
	}

	function toArray<T>(list: LinkedList<T>): T[] {
		const array: T[] = [];
		let node = list.head.next;
		while (node !== list.tail) {
			array.push(node!.value!);
			node = node!.next;
		}
		return array;
	}
}

//#region Clike

//#endregion







