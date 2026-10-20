import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale, normalizeLocale } from '../plugin/plugin/i18n.js';
import { keyIconSvg } from '../plugin/plugin/key-icon.js';
import { quotaIconSvg } from '../plugin/plugin/quota-icon.js';
import { resetLabel } from '../plugin/plugin/quota-state.js';

test('host locale selects translated key states and countdowns without translating project titles', () => {
  try {
    assert.equal(normalizeLocale('zh_CN'), 'zh-CN');
    assert.equal(normalizeLocale('en-US'), 'en');
    assert.equal(normalizeLocale('fr'), 'en');
    setLocale('en');
    const svg = keyIconSvg({ project: { repo: '中文项目', displayName: '工作中', agents: [] }, slot: 1, state: 'waiting' });
    assert.ok(svg.includes('中文项目'));
    assert.ok(svg.includes('工作中'));
    assert.ok(svg.includes('1 · Needs input'));
    assert.equal(resetLabel(120000, 0), 'Reset in 2m');
    const quota = quotaIconSvg('claude', { status: 'ok', environmentId: '', windows: [{ kind: 'weekly', label: '每周', usedPercent: 14, resetsAt: 120000 }] }, 0);
    assert.ok(quota.includes('Weekly used'));
    assert.ok(quota.includes('Local'));
    assert.ok(!/[\p{Script=Han}]/u.test(quota));
    setLocale('zh-CN');
    assert.ok(keyIconSvg({ slot: 1, state: 'empty' }).includes('空坑位'));
  } finally { setLocale('zh-CN'); }
});

test('English worktree inspector renders mounted slots using the host language', async () => {
  const fields = new Map();
  const callbacks = {};
  const previous = Object.fromEntries(['document', 'location', '$UD'].map(k => [k, globalThis[k]]));
  try {
    globalThis.location = { search: '?language=en' };
    globalThis.document = { documentElement: {}, querySelectorAll: () => [], getElementById(id) {
      if (!fields.has(id)) fields.set(id, { addEventListener() {} });
      return fields.get(id);
    } };
    globalThis.$UD = Object.fromEntries(['onAdd', 'onParamFromApp', 'onConnected', 'onSendToPropertyInspector'].map(k => [k, fn => { callbacks[k] = fn; }]));
    Object.assign(globalThis.$UD, { connect() {}, sendToPlugin() {} });
    await import('../plugin/property-inspector/inspector.js');
    callbacks.onAdd({ param: {} });
    callbacks.onSendToPropertyInspector({ payload: { slot: 2, slots: [], projects: [], enabledSlots: [1, 2], updatedAt: 1 } });
    assert.equal(fields.get('heading').textContent, 'Orca Workspaces · Slot 2');
    assert.ok(fields.get('occupant').textContent.includes('empty'));
    assert.ok(fields.get('status').textContent.includes('2 slots mounted'));
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    setLocale('zh-CN');
  }
});
