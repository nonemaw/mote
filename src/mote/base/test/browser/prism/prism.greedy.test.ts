import * as assert from 'assert';
import { Grammar, Prism } from 'mote/base/browser/prism/prism';
import { Prismhelper } from 'mote/base/test/browser/prism/prismHelper';

suite('Base - Prism Greedy matching', () => {
	test('should correctly handle tokens with the same name', () => {
		testTokens({
			grammar: {
				'comment': [
					/\/\/.*/,
					{
						pattern: /\/\*[\s\S]*?(?:\*\/|$)/,
						greedy: true
					}
				]
			},
			code: '// /*\n/* comment */',
			expected: [
				['comment', '// /*'],
				['comment', '/* comment */']
			]
		});
	});

	test('should support patterns with top-level alternatives that do not contain the lookbehind group', () => {
		testTokens({
			grammar: {
				'a': /'[^']*'/,
				'b': {
					// This pattern has 2 top-level alternatives:  foo  and  (^|[^\\])"[^"]*"
					pattern: /foo|(^|[^\\])"[^"]*"/,
					lookbehind: true,
					greedy: true
				}
			},
			code: 'foo "bar" \'baz\'',
			expected: [
				['b', 'foo'],
				['b', '"bar"'],
				['a', "'baz'"]
			]
		});
	});

	test('should correctly rematch tokens', function () {
		testTokens({
			grammar: {
				'a': {
					pattern: /'[^'\r\n]*'/,
				},
				'b': {
					pattern: /"[^"\r\n]*"/,
					greedy: true,
				},
				'c': {
					pattern: /<[^>\r\n]*>/,
					greedy: true,
				}
			},
			code: `<'> '' ''\n<"> "" ""`,
			expected: [
				['c', "<'>"],
				" '",
				['a', "' '"],
				"'\n",

				['c', '<">'],
				['b', '""'],
				['b', '""'],
			]
		});
	});

	test('should always match tokens against the whole text', function () {
		// this is to test for a bug where greedy tokens where matched like non-greedy ones if the token stream ended on
		// a string
		testTokens({
			grammar: {
				'a': /a/,
				'b': {
					pattern: /^b/,
					greedy: true
				}
			},
			code: 'bab',
			expected: [
				['b', 'b'],
				['a', 'a'],
				'b'
			]
		});
	});

	test('issue3052', function () {
		// If a greedy pattern creates an empty token at the end of the string, then this token should be discarded
		testTokens({
			grammar: {
				'oh-no': {
					pattern: /$/,
					greedy: true
				}
			},
			code: 'foo',
			expected: ['foo']
		});
	});
});

interface TestTarget {
	grammar: Grammar;
	code: string;
	expected: any[];
}

function testTokens({ grammar, code, expected }: TestTarget) {
	Prism.languages.test = grammar;

	const simpleTokens = Prismhelper.simplify(Prismhelper.tokenize(code, 'test'));
	assert.deepEqual(simpleTokens, expected);
}

