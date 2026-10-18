/* 公開中のビルドと動いているビルドの比較(core/build-check.js。UI-002-H 追補 2) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckAction, versionLabel } from '../../src/core/build-check.js';

test('build が違い、まだ読み直していなければ読み直す', () => {
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 'bbbbbbb', reloadedFor: null, started: false }), 'reload');
});

test('同じ build・開発サーバー・読めない・読み直し済み・プレイ中は読み直さない', () => {
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 'aaaaaaa' }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'dev', remoteBuild: 'bbbbbbb' }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: null }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 42 }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 'bbbbbbb', reloadedFor: 'bbbbbbb' }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 'bbbbbbb', started: true }), 'none');
  assert.equal(buildCheckAction(), 'none');
});

test('メニューの表記に build を添える(開発サーバーでは版だけ)', () => {
  assert.equal(versionLabel('0.1.0', '3d3f83e'), 'ver 0.1.0 (3d3f83e)');
  assert.equal(versionLabel('0.1.0', 'dev'), 'ver 0.1.0');
  assert.equal(versionLabel('', null), 'ver 0.0.0');
});
