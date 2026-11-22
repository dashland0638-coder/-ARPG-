// @ts-check
/* WANDERER-RENEWAL-001: 影の旅人の戦い方・見た目・閃き(AD-005)。
 *
 *   ・影の旅人は自分の型(CLIPS.wanderer)で 3 段・Skill 1「影残し」・Skill 2「影渡り」を振る。剣士の型を引かない
 *   ・3 段目・Skill 1・Skill 2 は 0.45 秒後に影が追撃する(残像が見えている。当たった敵の HP が後から減る)
 *   ・影渡りの斬り返しは影の側から当たる ―― こちらを向いた守護型の盾を抜ける
 *   ・武器の枠は影の刃(影の紫 #8A5AD6 の別 Material)。衣服の Material(配色表)に影の紫は無い
 *   ・他の 4 人の型・段数は変わらない
 *   ・道のエリア 4「遺構の門」の後で、影の旅人が Skill 2 を閃く(自動で装備される)
 *   iPhone 844×390 の横向き
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;window.__wr = {
  ev(src){ return eval(src); },
  cast(k){
    const g = {warrior:'male', mage:'female', rogue:'male', archer:'female', wanderer:'male'}[k];
    switchProtagonist({classKey:k, gender:g, personality:'calm'}, true);
    if(player && !player.parent) scene.add(player);
    return {key: state.classDef.key, char: state.classDef.charKey || null, rig: rigKeyOf(state.classDef)};
  },
  clear(){ enemies.forEach(e=>{ e.dormant = true; if(e.group) e.group.visible = false; }); camAutoOn = false; return true; },
  foe(dx, dz, opts){
    const v = Object.assign({}, ROAD2_FOES.roadEater, {hp:5000, atk:0}, opts || {});
    const en = buildEnemy(new THREE.Vector3(state.pos.x + dx, state.pos.y, state.pos.z + dz), v);
    en.speed = 0; en.triggered = false;
    enemies.push(en); return enemies.length - 1;
  },
  hp(i){ return enemies[i].hp; },
  face(i, yaw){ enemies[i].group.rotation.y = yaw; return true; },
  ready(){ armWeaponNow(state.weapon); state.attackCD = 0; state.comboWindowT = 0; state.skillCD = 0; state.skill2CD = 0; state.mp = state.maxMp; state.facing = 0; return true; },
  attack(){ armWeaponNow(state.weapon); state.attackCD = 0; tryAttack(); return state.moveClip; },
  skill1(){ armWeaponNow(state.weapon); state.skillCD = 0; skillInputDown(); skillInputUp(); return {clip: state.moveClip, name: activeSkill1Variant().name}; },
  skill2(){ armWeaponNow(state.weapon); state.skill2CD = 0; state.mp = state.maxMp; castSkill2(); return {clip: state.moveClip, name: activeSkill2Def(rigKeyOf(state.classDef)).name}; },
  echoes(){ return {queued: wandererEchoes.length, images: wandererAfterimages.length}; },
  blade(){
    const P = playerMixerParts, b = P.shadowBlade;
    if(!b) return null;
    const cols = (b.userData.bladeMats || []).map(m=> m.mat.color.getHexString());
    return {isWeapon: P.weapon === b, visible: b.visible, cols, outline: (function(){ let n = 0; b.traverse(o=>{ if(o.userData.isOutline) n++; }); return n; })()};
  },
  clothColors(){
    const set = new Set();
    player.traverse(o=>{
      if(!o.isMesh || !o.material || o.userData.isOutline || o.userData.isXray) return;
      let p = o, inBlade = false; while(p){ if(p.userData && p.userData.shadowBlade) inBlade = true; p = p.parent; }
      if(inBlade) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m=>{ if(m.color && m.type === 'MeshStandardMaterial') set.add(m.color.getHexString()); });
    });
    return Array.from(set);
  },
  clipLib(){ return Object.keys(CLIPS[rigKeyOf(state.classDef)]).sort(); },
  comboLen(){ return COMBO_LENGTH[rigKeyOf(state.classDef)]; },
};`;

async function enterArena(page) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, { classKey: 'warrior' });
  await page.waitForFunction(() => /** @type {any} */ (window).__wr && /** @type {any} */ (window).__wr.ev('state.started'), null, { timeout: 60_000 });
  for (let i = 0; i < 10; i++) {
    if (!(await page.evaluate(() => /** @type {any} */ (window).__wr.ev('state.dialogueActive')))) break;
    await page.click('#dialogue-overlay').catch(() => {});
    await page.waitForTimeout(300);
  }
  return (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__wr[fn](...a), [fn, a]);
}

test('影の旅人: 自分の型の 3 段・影残し・影渡り、0.45 秒後の影の追撃、影の刃の色', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const R = await enterArena(page);
  await R('clear');
  const c = await R('cast', 'wanderer');
  expect(c).toEqual({ key: 'warrior', char: 'wanderer', rig: 'wanderer' });
  expect(await R('comboLen')).toBe(3);
  expect(await R('clipLib')).toEqual(expect.arrayContaining(['basic', 'basic2', 'basic3', 'retreat', 'shadowPass', 'dash', 'spin', 'ult']));

  // 影の刃: 武器の枠そのもの。影の紫、輪郭線なし。衣服の Material に影の紫は無い
  await R('ready');
  await page.waitForTimeout(500);
  const blade = await R('blade');
  expect(blade.isWeapon).toBe(true);
  expect(blade.cols).toContain('8a5ad6');
  expect(blade.outline).toBe(0);
  const cloth = await R('clothColors');
  expect(cloth.length).toBeGreaterThan(3);
  expect(cloth).not.toContain('8a5ad6');

  // 3 段: 払い → 返し → 振り下ろし。3 段目の後に影が残り、0.45 秒後に追撃が当たる
  const f = await R('foe', 0, 2.2);
  const clips = [];
  for (let s = 0; s < 3; s++) {
    clips.push(await R('attack'));
    if (s < 2) await page.waitForTimeout(120);
  }
  expect(clips).toEqual(['basic', 'basic2', 'basic3']);
  expect((await R('echoes')).queued).toBe(1);
  const hpAfterSwing = await R('hp', f);
  await expect.poll(() => R('echoes').then(e => e.queued), { timeout: 10_000 }).toBe(0);
  expect(await R('hp', f), '影の追撃が当たる').toBeLessThan(hpAfterSwing);

  // Skill 1 影残し: 一撃 + 後退。元の場所に影が残る
  await page.waitForTimeout(1200);
  await R('ready');
  const s1 = await R('skill1');
  expect(s1).toEqual({ clip: 'retreat', name: '影残し' });
  expect((await R('echoes')).queued).toBe(1);
  await expect.poll(() => R('echoes').then(e => e.queued), { timeout: 10_000 }).toBe(0);

  // Skill 2 影渡り: 守護型(正面に盾)を挟む。斬り返しは影の側(背中)から当たる
  await page.waitForTimeout(1500);
  await R('ready');
  const g = await R('foe', 0, 3.0, { guardian: true, strongMob: true });
  await R('face', g, Math.PI);   // こちら(−z)を向いている = 本人の攻撃は正面で弾かれる
  const hp0 = await R('hp', g);
  const s2 = await R('skill2');
  expect(s2).toEqual({ clip: 'shadowPass', name: '影渡り' });
  const hpPass = await R('hp', g);
  const passDmg = hp0 - hpPass;
  await expect.poll(() => R('echoes').then(e => e.queued), { timeout: 10_000 }).toBe(0);
  const backDmg = hpPass - await R('hp', g);
  expect(passDmg, '影の通過は正面から = 盾で減る').toBeGreaterThan(0);
  expect(backDmg, '斬り返しは背中から = 盾を抜ける').toBeGreaterThan(passDmg * 2);

  // 他の 4 人は自分の型のまま
  const r = await R('cast', 'rogue');
  expect(r.rig).toBe('rogue');
  expect(await R('comboLen')).toBe(4);
  expect(await R('blade')).toBeNull();
  const w = await R('cast', 'warrior');
  expect(w.rig).toBe('warrior');
  expect(await R('comboLen')).toBe(3);
  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('閃き: 道のエリア 4「遺構の門」の後、影の旅人が影渡りを閃いて自動で装備する', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'road', waypoint: 'joined' });
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  const R = (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__wr[fn](...a), [fn, a]);
  await page.waitForFunction(() => /** @type {any} */ (window).__wr && /** @type {any} */ (window).__wr.ev('road2Joined'), null, { timeout: 60_000 });
  expect(await R('ev', 'selectedClass')).toBe('wanderer');
  // テストモードは最初から Skill 2 を持つので閃かない。本編と同じ条件(未習得・本編のルール)にして門を片づける
  expect(await R('ev', 'road2InsightDue()')).toBe(false);
  await R('ev', "state.testMode = false; state.learnedSkill2 = false; road2Fights['F4-2'] = {wave:0, cleared:true}; true");
  const lines = [];
  await expect.poll(() => R('ev', 'cutsceneRunning()'), { timeout: 30_000 }).toBe(true);
  for (let k = 0; k < 40 && await R('ev', 'cutsceneRunning()'); k++) {
    const w = await R('ev', "cutsceneWaitingForInput() ? document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent : null");
    if (w && lines[lines.length - 1] !== w) { lines.push(w); await page.click('#dialogue-overlay'); }
    await page.waitForTimeout(300);
  }
  expect(await R('ev', 'state.learnedSkill2')).toBe(true);
  expect(await R('ev', "activeSkill2Def(rigKeyOf(state.classDef)).key")).toBe('shadowPass');
  expect(lines.join('\n')).toContain('影の旅人|「……回り込むのは、私でなくてもいい」');
  expect(lines.join('\n')).not.toContain('？？？');   // 加入後の場面(名前は出ている)
  // 二度は起きない
  expect(await R('ev', 'road2PlayInsight()')).toBe(false);
  await R('ev', 'state.testMode = true; true');
  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});
