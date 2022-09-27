import * as assert from 'assert';
import 'mote/base/browser/prism/component/prismCLike';
import 'mote/base/browser/prism/component/prismJavaScript';
import { Prism } from 'mote/base/browser/prism/prism';
import { Prismhelper } from 'mote/base/test/browser/prism/prismHelper';

suite('Base - Prism Javascript', () => {
	test('JavaScript tokenize', () => {
		const code = 'var';
		const result = Prismhelper.simplify(Prismhelper.tokenize(code, 'javascript'));

		assert.deepEqual(result, [['keyword', 'var']]);
	});

	test('JavaScript new line', () => {
		const code = 'var\nvar';
		const result = Prismhelper.simplify(Prismhelper.tokenize(code, 'javascript'));

		assert.deepEqual(result, [['keyword', 'var'], '\n', ['keyword', 'var']]);
	});

	test('JavaScript highlight', () => {
		const code = 'var\nconst';
		const result = Prism.highlight(code, Prism.languages['javascript'], 'javascript');

		assert.deepEqual(result, '<span class="token keyword">var</span>\n<span class="token keyword">const</span>');
	});
});
