/* 開発用 UI の有効/無効(core/dev-ui.js、UI-002-B)。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { devUiEnabled } from '../../src/core/dev-ui.js';

test('dev=1 の完全一致だけ有効', () => {
  assert.equal(devUiEnabled('?dev=1'), true);
  assert.equal(devUiEnabled('?x=2&dev=1'), true);
  assert.equal(devUiEnabled('?dev=1&x=2'), true);
  assert.equal(devUiEnabled('dev=1'), true);   // URLSearchParams は先頭の ? の有無を問わない
});

test('クエリなし・他の値は無効(AP-B2)', () => {
  for (const s of ['', undefined, null, '?', '?dev', '?dev=', '?dev=0', '?dev=true', '?dev=01',
                   '?dev=1 ', '?dev=%201', '?DEV=1', '?devx=1', '?x=dev=1', '#dev=1']) {
    assert.equal(devUiEnabled(s), false, String(s));
  }
});

test('同名キーが複数ある時は最初の値で判定する', () => {
  assert.equal(devUiEnabled('?dev=1&dev=0'), true);
  assert.equal(devUiEnabled('?dev=0&dev=1'), false);
});

/* Combat HUD Visual Prototype の見本オーバーレイ(UI-002-C2、AP-C2-08) */
import { uiProtoEnabled } from '../../src/core/dev-ui.js';

test('uiproto: ?dev=1 と uiproto=1 の両方がある時だけ有効', () => {
  assert.equal(uiProtoEnabled('?dev=1&uiproto=1'), true);
  assert.equal(uiProtoEnabled('?uiproto=1&dev=1'), true);
  assert.equal(uiProtoEnabled('?x=2&dev=1&uiproto=1'), true);
});

test('uiproto: 通常 URL・?dev=1 だけ・値違いは無効(production に出さない)', () => {
  for (const s of ['', undefined, null, '?uiproto=1', '?dev=1', '?dev=0&uiproto=1', '?dev=true&uiproto=1',
                   '?dev=1&uiproto=0', '?dev=1&uiproto=true', '?dev=1&uiproto=', '?dev=1&uiproto',
                   '?dev=1&UIPROTO=1', '#dev=1&uiproto=1']) {
    assert.equal(uiProtoEnabled(s), false, String(s));
  }
});

test('uiproto: 同名キーは最初の値で判定する(devUiEnabled と同じ規則)', () => {
  assert.equal(uiProtoEnabled('?dev=1&uiproto=1&uiproto=0'), true);
  assert.equal(uiProtoEnabled('?dev=1&uiproto=0&uiproto=1'), false);
  assert.equal(uiProtoEnabled('?dev=0&dev=1&uiproto=1'), false);
});
