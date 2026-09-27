const test = require('node:test');
const assert = require('node:assert/strict');
const questions = require('../questions.js');

const tiers = ['beginner', 'mild', 'spicy'];

test('all nine wheels provide 100 unique, readable prompts', () => {
  assert.deepEqual(Object.keys(questions).sort(), ['dare', 'mixed', 'truth']);
  for (const [category, pools] of Object.entries(questions)) {
    assert.deepEqual(Object.keys(pools).sort(), tiers);
    for (const [tier, items] of Object.entries(pools)) {
      assert.equal(items.length, 100, `${category}/${tier}`);
      assert.equal(new Set(items.map(item => item.text)).size, 100);
      for (const item of items) {
        assert.equal('label' in item, false);
        assert.ok(item.text.length > 0 && [...item.text].length <= 40, item.text);
        assert.ok(['truth', 'dare'].includes(item.type), item.type);
        if (category !== 'mixed') assert.equal(item.type, category);
      }
    }
  }
  assert.equal(globalThis.PARTY_QUESTIONS, questions);
});

test('source tiers do not repeat prompts', () => {
  for (const category of ['truth', 'dare']) {
    const items = Object.values(questions[category]).flat();
    assert.equal(new Set(items.map(item => item.text)).size, 300, category);
  }
});

test('mixed tiers interleave 50 truth and 50 dare from their matching tier', () => {
  for (const tier of tiers) {
    const items = questions.mixed[tier];
    assert.equal(items.filter(item => item.type === 'truth').length, 50);
    assert.equal(items.filter(item => item.type === 'dare').length, 50);
    items.forEach((item, index) => {
      assert.equal(item.type, index % 2 ? 'dare' : 'truth');
      assert.ok(questions[item.type][tier].includes(item));
    });
  }
});
