(function () {
  'use strict';

  const KEY = 'party-wheel.questions.v1';
  const CATEGORIES = ['truth', 'dare'];
  const TIERS = ['spicy', 'mild', 'beginner'];
  const NAMES = { truth: '真心话', dare: '大冒险', spicy: '刺激版', mild: '温和版', beginner: '纯菜版' };

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }

  function hasExactKeys(value, keys) {
    return isRecord(value) && Object.keys(value).length === keys.length
      && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
  }

  function normalizedString(value, maximum, name) {
    if (typeof value !== 'string') throw new Error(`${name}必须是文字。`);
    const clean = value.trim();
    if ([...clean].length < 1 || [...clean].length > maximum) {
      throw new Error(`${name}须为 1～${maximum} 个字符。`);
    }
    return clean;
  }

  function validateSources(sources) {
    if (!hasExactKeys(sources, CATEGORIES)) throw new Error('题库格式不正确：需要真心话和大冒险两类题库。');
    const clean = {};
    for (const category of CATEGORIES) {
      if (!hasExactKeys(sources[category], TIERS)) {
        throw new Error(`${NAMES[category]}需要刺激版、温和版和纯菜版三组题目。`);
      }
      clean[category] = {};
      for (const tier of TIERS) {
        const title = `${NAMES[category]}·${NAMES[tier]}`;
        const pool = sources[category][tier];
        if (!Array.isArray(pool) || pool.length < 1 || pool.length > 200) {
          throw new Error(`${title}须保留 1～200 道题。`);
        }
        const seen = new Set();
        clean[category][tier] = Array.from(pool, (item, index) => {
          const position = `${title}第 ${index + 1} 题`;
          if (!isRecord(item)) throw new Error(`${position}格式不正确。`);
          const label = normalizedString(item.label, 7, `${position}短标题`);
          const text = normalizedString(item.text, 40, `${position}完整内容`);
          if (seen.has(text)) throw new Error(`${position}与本组其他题目的内容重复。`);
          seen.add(text);
          return { label, text, type: category };
        });
      }
    }
    return clean;
  }

  function buildBank(sources) {
    const bank = validateSources(sources);
    bank.mixed = {};
    for (const tier of TIERS) {
      const truth = bank.truth[tier];
      const dare = bank.dare[tier];
      const count = Math.min(50, truth.length, dare.length);
      bank.mixed[tier] = [];
      for (let index = 0; index < count; index += 1) {
        // Defaults retain truth 0,2,… and dare 1,3,…; edited pools stay evenly sampled.
        bank.mixed[tier].push(
          truth[Math.floor(index * truth.length / count)],
          dare[Math.floor((index + 0.5) * dare.length / count)]
        );
      }
    }
    for (const pools of Object.values(bank)) {
      for (const pool of Object.values(pools)) {
        for (const item of pool) Object.freeze(item);
        Object.freeze(pool);
      }
      Object.freeze(pools);
    }
    return Object.freeze(bank);
  }

  function parseBackup(text) {
    if (typeof text !== 'string') throw new Error('备份必须是 JSON 格式的文字。');
    let envelope;
    try { envelope = JSON.parse(text); }
    catch (_) { throw new Error('备份无法读取，请选择有效的 JSON 题库文件。'); }
    if (!isRecord(envelope) || envelope.version !== 1 || !Object.prototype.hasOwnProperty.call(envelope, 'sources')) {
      throw new Error('不支持此备份格式，请使用本网站导出的第 1 版题库备份。');
    }
    return validateSources(envelope.sources);
  }

  function createStore(defaultBank, storage) {
    let bank = buildBank({ truth: defaultBank.truth, dare: defaultBank.dare });
    let warning = '';
    try {
      const saved = storage.getItem(KEY);
      if (saved !== null) {
        try { bank = buildBank(parseBackup(saved)); }
        catch (_) { warning = '已保存的题库损坏或格式不兼容，暂时使用默认题库；原有存储未被覆盖。'; }
      }
    } catch (_) {
      warning = '当前浏览器无法读取本地题库，暂时使用默认题库。';
    }

    function getDraft() {
      return validateSources({ truth: bank.truth, dare: bank.dare });
    }

    function exportBackup(sources) {
      return JSON.stringify({ version: 1, sources: validateSources(sources) }, null, 2);
    }

    function save(sources) {
      const clean = validateSources(sources);
      const next = buildBank(clean);
      const serialized = JSON.stringify({ version: 1, sources: clean });
      try { storage.setItem(KEY, serialized); }
      catch (_) { throw new Error('保存失败：浏览器存储不可用或空间不足。当前题库未改变，请先导出备份再重试。'); }
      bank = next;
      warning = '';
      return bank;
    }

    return { getBank: () => bank, getDraft, save, getWarning: () => warning, exportBackup };
  }

  const api = { createStore, validateSources, buildBank, parseBackup, KEY };
  globalThis.QuestionStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
