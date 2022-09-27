import * as assert from 'assert';
import { Prism } from 'mote/base/browser/prism/prism.all';

suite('Base - Prism', () => {
	test('javascript render', () => {
		const code = 'const';
		const result = Prism.highlight(code, Prism.languages['javascript'], 'javascript');

		assert.equal(result, '<span class="token keyword">const</span>');
	});
});
