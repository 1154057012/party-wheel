const test = require('node:test');
const assert = require('node:assert/strict');
const defaults = require('../questions.js');
const { createStore, validateSources, buildBank, parseBackup, KEY } = require('../question-store.js');

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) { assert.equal(key, KEY); return value; },
    setItem(key, next) { assert.equal(key, KEY); value = next; }
  };
}

function sources() { return createStore(defaults, memoryStorage()).getDraft(); }

test('defaults preserve all original mixed wheels and expose immutable live data', () => {
  const store = createStore(defaults, memoryStorage());
  assert.deepEqual(store.getBank(), defaults);
  assert.equal(store.getWarning(), '');
  assert.ok(Object.isFrozen(store.getBank().truth.mild[0]));
  assert.deepEqual(Object.keys(store.getDraft()).sort(), ['dare', 'truth']);
});

test('save persists changes, reload restores them, and mixed prompts follow sources', () => {
  const storage = memoryStorage();
  const store = createStore(defaults, storage);
  const draft = store.getDraft();
  draft.truth.mild[0].text = '你最想分享的一件开心事是什么？';
  const bank = store.save(draft);
  assert.equal(bank, store.getBank());
  assert.equal(bank.mixed.mild[0].text, draft.truth.mild[0].text);
  assert.deepEqual(createStore(defaults, storage).getBank(), bank);
  const envelope = JSON.parse(storage.getItem(KEY));
  assert.equal(envelope.version, 1);
  assert.deepEqual(Object.keys(envelope.sources).sort(), ['dare', 'truth']);
});

test('draft mutations cannot change defaults or saved live state', () => {
  const store = createStore(defaults, memoryStorage());
  const draft = store.getDraft();
  draft.dare.spicy[1].text = '新题目';
  assert.notEqual(store.getBank().dare.spicy[1].text, '新题目');
  store.save(draft);
  draft.dare.spicy[1].text = '再次更改';
  assert.equal(store.getBank().dare.spicy[1].text, '新题目');
  assert.notEqual(defaults.dare.spicy[1].text, '新题目');
});

test('corrupt, incompatible and unavailable storage recover defaults with Chinese warnings', () => {
  for (const stored of ['{broken', '{"version":2,"sources":{}}', '{"version":1,"sources":{}}']) {
    const store = createStore(defaults, memoryStorage(stored));
    assert.deepEqual(store.getBank(), defaults);
    assert.match(store.getWarning(), /[\u4e00-\u9fff]/);
  }
  const store = createStore(defaults, { getItem() { throw Error('denied'); } });
  assert.deepEqual(store.getBank(), defaults);
  assert.match(store.getWarning(), /[\u4e00-\u9fff]/);
});

test('failed writes never commit edited data to live bank', () => {
  const store = createStore(defaults, { getItem() { return null; }, setItem() { throw Error('quota'); } });
  const original = store.getBank();
  const draft = store.getDraft();
  draft.truth.mild[0].text = '应该保持未保存状态的题目';
  assert.throws(() => store.save(draft), /保存失败/);
  assert.equal(store.getBank(), original);
  assert.notEqual(store.getBank().truth.mild[0].text, draft.truth.mild[0].text);
});

test('normalization trims strings, derives type and drops arbitrary prompt properties', () => {
  const draft = sources();
  draft.truth.mild[0] = { label: '  新题目  ', text: '  新内容  ', type: 'dare', extra: '<script>' };
  const clean = validateSources(draft);
  assert.deepEqual(clean.truth.mild[0], { text: '新内容', type: 'truth' });
  assert.equal(draft.truth.mild[0].label, '  新题目  ');
});

test('validation rejects missing pools, extra categories, blank and duplicate prompts and limits', () => {
  const mutations = [
    draft => { delete draft.truth.mild; },
    draft => { draft.mixed = {}; },
    draft => { draft.truth.mild = []; },
    draft => { draft.truth.mild = Array.from({ length: 201 }, (_, i) => ({ label: '题目', text: String(i) })); },
    draft => { draft.truth.mild[0].text = '        '; },
    draft => { draft.truth.mild[0].text = '题'.repeat(41); },
    draft => { draft.truth.mild[0].text = 123; },
    draft => { draft.truth.mild[1].text = ' ' + draft.truth.mild[0].text + ' '; },
    draft => { draft.truth.mild[0] = null; }
  ];
  for (const mutate of mutations) {
    const draft = sources();
    mutate(draft);
    assert.throws(() => validateSources(draft), /[\u4e00-\u9fff]/);
  }
  const draft = sources();
  draft.truth.mild[0].label = '🎉'.repeat(7);
  draft.truth.mild[0].text = '🎉'.repeat(40);
  assert.doesNotThrow(() => validateSources(draft));
});

test('unequal pools build a balanced interleaved mixed wheel without undefined entries', () => {
  const draft = sources();
  draft.truth.mild = draft.truth.mild.slice(0, 3);
  draft.dare.mild = draft.dare.mild.slice(0, 5);
  const bank = buildBank(draft);
  assert.equal(bank.mixed.mild.length, 6);
  bank.mixed.mild.forEach((item, i) => {
    assert.equal(item.type, i % 2 ? 'dare' : 'truth');
    assert.ok(bank[item.type].mild.includes(item));
  });
  draft.truth.mild = draft.truth.mild.slice(0, 1);
  assert.equal(buildBank(draft).mixed.mild.length, 2);
});

test('backups round trip only through the versioned validated envelope', () => {
  const store = createStore(defaults, memoryStorage());
  const draft = store.getDraft();
  draft.dare.beginner[0].text = '向自己说一句鼓励的话。';
  const backup = store.exportBackup(draft);
  assert.ok(backup.includes('\n  '));
  assert.deepEqual(parseBackup(backup), validateSources(draft));
  assert.notDeepEqual(store.getDraft(), draft, 'export must not apply the draft');
  for (const text of ['no json', 'null', JSON.stringify(draft), JSON.stringify({ version: 2, sources: draft })]) {
    assert.throws(() => parseBackup(text), /[\u4e00-\u9fff]/);
  }
  draft.dare.beginner = [];
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, sources: draft })), /[\u4e00-\u9fff]/);
  assert.throws(() => store.exportBackup(draft), /[\u4e00-\u9fff]/);
});

 test('legacy saved labels and backups migrate without losing edited question text', () => {
  const old = sources();
  old.truth.mild[0] = {label: '以前的标题', text: '我之前保存的自定义内容。', type: 'truth'};
  const serialized=JSON.stringify({version:1,sources:old});
  const store=createStore(defaults,memoryStorage(serialized));
  assert.equal(store.getWarning(),'');
  assert.deepEqual(store.getBank().truth.mild[0],{text:'我之前保存的自定义内容。',type:'truth'});
  assert.equal(parseBackup(serialized).truth.mild[0].text,'我之前保存的自定义内容。');
  assert.equal('label' in JSON.parse(store.exportBackup(store.getDraft())).sources.truth.mild[0],false);
});
