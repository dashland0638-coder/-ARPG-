/* 公開中のビルドと動いているビルドの比較(core/build-check.js。UI-002-H 追補 2) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckAction, versionLabel, reloadMarker, reloadUrl } from '../../src/core/build-check.js';

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

test('読み直しの印は URL に持つ。他の検索条件と # は残す', () => {
  const url = reloadUrl('https://example.test/-ARPG-/?dev=1#x', 'bbbbbbb');
  assert.equal(url, 'https://example.test/-ARPG-/?dev=1&build=bbbbbbb#x');
  assert.equal(reloadMarker(new URL(url).search), 'bbbbbbb');
  assert.equal(reloadMarker(''), null);
  // 上書きする(古い印が残っていても新しい build へ 1 回だけ)
  assert.equal(reloadUrl('https://example.test/-ARPG-/?build=aaaaaaa', 'bbbbbbb'), 'https://example.test/-ARPG-/?build=bbbbbbb');
});

test('読み直しても古いビルドのままなら、印を見て繰り返さない(storage が使えなくても)', () => {
  const remote = 'bbbbbbb';
  const after = reloadMarker(new URL(reloadUrl('https://example.test/-ARPG-/', remote)).search);
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: remote, reloadedFor: after, started: false }), 'none');
});
