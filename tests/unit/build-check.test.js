/* 公開中のビルドと動いているビルドの比較(core/build-check.js。UI-002-H 追補 2) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckAction, versionLabel, reloadMarker, reloadUrl, titleIsIdle } from '../../src/core/build-check.js';

test('build が違い、まだ読み直していなければ読み直す', () => {
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 'bbbbbbb', reloadedFor: null, started: false, onTitle: true }), 'reload');
});

test('同じ build・開発サーバー・読めない・読み直し済み・プレイ中は読み直さない', () => {
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 'aaaaaaa' }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'dev', remoteBuild: 'bbbbbbb' }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: null }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 42 }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 'bbbbbbb', reloadedFor: 'bbbbbbb', onTitle: true }), 'none');
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: 'bbbbbbb', started: true, onTitle: true }), 'none');
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
  // 既に印があっても、新しい印で置き換える(URL の組み立てだけの確認。印のあるページは読み直さない)
  assert.equal(reloadUrl('https://example.test/-ARPG-/?build=aaaaaaa', 'bbbbbbb'), 'https://example.test/-ARPG-/?build=bbbbbbb');
});

test('読み直しても古いビルドのままなら、印を見て繰り返さない(storage が使えなくても)', () => {
  const remote = 'bbbbbbb';
  const after = reloadMarker(new URL(reloadUrl('https://example.test/-ARPG-/', remote)).search);
  assert.equal(buildCheckAction({ localBuild: 'aaaaaaa', remoteBuild: remote, reloadedFor: after, started: false, onTitle: true }), 'none');
});

/* PR #90 Review Minor 1: 公開の直後に配信が新旧で揃わず、index.html(= 動いている build)と
   version.json が交互に古い・新しいを返しても、自動の読み直しは最大 1 回 */
test('新旧が交互に返っても、読み直しは最大 1 回(印は URL だけ。storage を使わない)', () => {
  const A = 'aaaaaaa', B = 'bbbbbbb';
  // 各回の [動いている build, version.json の build]。印の付いたページでは、どちらが返っても読み直さない
  const responses = [[A, B], [A, B], [B, A], [A, B], [B, A], [A, A], [B, B], [A, B]];
  let href = 'https://example.test/-ARPG-/';
  let reloads = 0;
  for (const [local, remote] of responses) {
    const action = buildCheckAction({ localBuild: local, remoteBuild: remote,
      reloadedFor: reloadMarker(new URL(href).search), started: false, onTitle: true });
    if (action === 'reload') { reloads++; href = reloadUrl(href, remote); }
  }
  assert.equal(reloads, 1);
  // 印の付いたページでは、古い build・新しい build・読めない応答のどれでも読み直さない
  for (const remote of [A, B, 'ccccccc', null, '', 42, undefined]) {
    assert.equal(buildCheckAction({ localBuild: A, remoteBuild: remote, reloadedFor: B, started: false, onTitle: true }), 'none');
  }
});

/* PR #90 Review Minor 2: タイトル画面だけが出ている時に限る */
test('タイトル画面以外(別の画面が開いている・プレイ中・タイトルが出ていない)では読み直さない', () => {
  const base = { localBuild: 'aaaaaaa', remoteBuild: 'bbbbbbb', reloadedFor: null, started: false };
  assert.equal(buildCheckAction({ ...base, onTitle: true }), 'reload');
  assert.equal(buildCheckAction({ ...base, onTitle: false }), 'none');
  assert.equal(buildCheckAction({ ...base }), 'none');            // 分からない時も読み直さない
  assert.equal(buildCheckAction({ ...base, onTitle: true, started: true }), 'none');

  assert.equal(titleIsIdle({ started: false, titleDisplay: 'flex', otherScreenOpen: false }), true);
  assert.equal(titleIsIdle({ started: false, titleDisplay: 'none', otherScreenOpen: false }), false);   // テストモードの職業選択(タイトルが消える)
  assert.equal(titleIsIdle({ started: false, titleDisplay: 'flex', otherScreenOpen: true }), false);   // 確認・メニュー・会話
  assert.equal(titleIsIdle({ started: true, titleDisplay: 'flex', otherScreenOpen: false }), false);   // プレイ中
  assert.equal(titleIsIdle({ started: false, titleDisplay: '', otherScreenOpen: false }), false);      // 起動中(まだ出ていない)
});

test('legacy は返ってきた時点のタイトル画面で判定し、復帰時もタイトル画面だけで確かめる', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/legacy/parts/14-hud-boot.js', import.meta.url), 'utf8');
  assert.match(src, /started: !!state\.started, onTitle: titleScreenIdle\(\)\}\)/);
  assert.match(src, /document\.visibilityState === 'visible' && titleScreenIdle\(\)\) checkForNewerBuild\(\)/);
  assert.match(src, /if\(reloadMarker\(location\.search\)\) return;/);
  assert.match(src, /getElementById\('testmode-screen'\)/);
});
