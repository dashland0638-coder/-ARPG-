// @ts-check
/* ROAD-VISUAL-003 R3-6: 道の宝箱(固定の報酬表、DEC-025 E-4)と結末(設計 §8)。
 *   宝箱: 宝箱の ID × 職業で決まった装備。同じ品は二度出ない(薬草に替わる)
 *   結末: R5-03 → R5-04(A-9 → 盗「帰ろう。まだ、帰る場所がある」)→ 暗転 → 結果画面(クリアは一度だけ)→ 最後の酒場(一行全員の台詞)。到達は 0 に戻る
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;window.__rc = {
  finale(){ const F = road2Finale; if(!F) return null; const en = F.en;
    return {state: F.state, phase: F.phase, hp: en ? en.hp : null, hpMax: en ? en.hpMax : null, name: en ? en.midbossName : null, scale: en ? en.group.scale.x : null,
      charge: en ? en.chargeState : null, second: F.second, mark: F.mark.visible, lane: F.lane.visible, gust: road2GustU.gust.value, cloudW: road2CloudW, endW: road2EndW,
      yielder: !!F.yielder, yieldT: F.yieldT, beastVis: en ? en.group.visible : null,
      yShells: F.yielder ? (()=>{ let n = 0; F.yielder.traverse(o=>{ if(o.isMesh && o.material && o.material.depthFunc === THREE.GreaterDepth) n++; }); return n; })() : null, focus: en ? (en.allyFocusT || 0) : 0, dayPos: road2DayPos, ex: en ? en.group.position.x : null, ez: en ? en.group.position.z : null}; },
  finaleHp(r){ const en = road2Finale.en; en.hp = Math.max(1, Math.round(en.hpMax * r)); return en.hp; },
  nearBoss(d){ const en = road2Finale.en; state.pos.set(en.group.position.x, state.pos.y, en.group.position.z - d); state.vel.set(0,0,0); return true; },
  finaleAllyHit(){ const en = road2Finale.en; dealDamageToEnemy(en, 1, true); return en.allyFocusT || 0; },
  chests(){ return road2Chests.map(C=> ({id: C.def.id, opened: C.chest.opened})); },
  inv(){ return state.equipmentInventory.map(it=> ({id: it.id, name: it.name, slot: it.slot, wt: it.weaponType || null})); },
  potions(){ return state.inventory && state.inventory.potion != null ? state.inventory.potion : (state.items ? state.items.potion : null); },
  roadArea(){ return state.roadArea; },
  scen(){ return {key: state.scenarioKey, clears: Object.assign({}, state.scenarioClears)}; },
  finaleLines(){ return {kind: state.dialogueKind, lines: (state.dialogueLines || []).map(l=> typeof l === 'string' ? l : (l.name + '|' + l.text))}; },
  world(){ return currentWorldKey; },
  pos(){ return {x: state.pos.x, z: state.pos.z, dlg: state.dialogueActive}; },
  killFinale(){ const en = road2Finale.en; dealDamageToEnemy(en, 1e7, false); return true; },
  go(x, z, yaw){
    const g = road2GroundAt(x, z);
    state.pos.set(x, g === null ? 0 : g, z); state.yVel = 0; state.grounded = true; lastSolid = state.pos.clone(); voidT = 0;
    state.vel.set(0, 0, 0); camAutoOn = false; if(yaw != null) state.camYaw = yaw;
    camera.position.copy(state.pos).add(getCamOffset());
    return true;
  },
  walk(pts, maxRealSec){
    return new Promise(res=>{
      let i = 0, total = 0, last = performance.now();
      camAutoOn = false;
      window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW'}));
      const done = (r)=>{ window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyW'})); res(r); };
      const tick = ()=>{
        const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; total += dt;
        if(state.dialogueActive){ requestAnimationFrame(tick); if(total > maxRealSec) done({ok:false, dialogue:true}); return; }
        const [tx, tz] = pts[i], dx = tx - state.pos.x, dz = tz - state.pos.z;
        if(Math.hypot(dx, dz) < 1.0){ i++; if(i >= pts.length) return done({ok:true}); }
        else state.camYaw = Math.atan2(-dx, -dz);
        if(total > maxRealSec) return done({ok:false});
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },
  talks(){ return Object.assign({}, road2TalkCount); },
  waiting(){ return cutsceneWaitingForInput() ? document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent : null; },
  running(){ return cutsceneRunning(); },
  dialogue(){ return state.dialogueActive; },
  lore(){ return {name: document.getElementById('dialogue-name').textContent, text: document.getElementById('dialogue-text').textContent}; },
  fight(id){
    const list = enemies.filter(en=> en && en.road2Fight === id);
    return {state: road2Fights[id] || null, alive: list.filter(en=> !en.dead).map(en=> ({kind: en.road2Kind, wave: en.road2Wave, strong: !!en.strongMob, guardian: !!en.guardian, room: en.roomTag})),
      total: list.length};
  },
  kill(id){ enemies.filter(en=> en && en.road2Fight === id && !en.dead).forEach(en=> dealDamageToEnemy(en, 1e7, false)); return true; },
  guardian(){
    const en = road2GuardianEn;
    return {state: road2GuardianState, statue: !!road2GuardianStatue, en: !!en, dead: !!(en && en.dead), name: en && en.midbossName,
      yaw: en ? en.group.rotation.y : null, focus: en ? (en.allyFocusT || 0) : 0, focusCD: en ? (en.allyFocusCD || 0) : 0, charge: en && en.chargeState,
      hp: en ? en.hp : null, hpMax: en ? en.hpMax : null, x: en ? en.group.position.x : null, z: en ? en.group.position.z : null,
      ally: guestCompanion && guestCompanion.group ? [guestCompanion.group.position.x, guestCompanion.group.position.z] : null};
  },
  // 正面と背面から同じ量を当てた時に減った HP(既存の guardian の正面の減衰を確かめる)
  guardHit(fromFront){
    const en = road2GuardianEn; if(!en || en.dead) return null;
    const yaw = en.group.rotation.y, d = fromFront ? 3 : -3;
    state.pos.set(en.group.position.x + Math.sin(yaw) * d, state.pos.y, en.group.position.z + Math.cos(yaw) * d);
    const before = en.hp; dealDamageToEnemy(en, 100, false); return before - en.hp;
  },
  allyHit(){ const en = road2GuardianEn; dealDamageToEnemy(en, 1, true); return en.allyFocusT || 0; },
  placeAlly(dx, dz){ const en = road2GuardianEn; if(!guestCompanion) return false;
    guestCompanion.group.position.set(en.group.position.x + dx, en.group.position.y, en.group.position.z + dz); guestCompanion.pos.copy(guestCompanion.group.position); return true; },
  resultShown(){ const el = document.getElementById('clear-overlay'); return !!el && el.classList.contains('active'); },
  cast(){ return {cls: selectedClass, guest: state.guestClassKey, joined: road2Joined, clears: JSON.stringify(state.scenarioClears), roadArea: state.roadArea, hired: !!companion}; },
  prompt(){ const el = document.getElementById('interact-btn'); return el && el.classList.contains('show') ? el.textContent : null; },
  // 出撃し直す: 本編と同じく酒場を経てから(同じワールドのままだと buildWorld が組み直さない)
  relaunch(){ buildWorld('tavern'); launchScenarioNow('road2'); return true; },
  invuln(){ state.maxHp = 99999; state.hp = 99999; return true; },   // デバッグ表示を出さずに倒れないようにする(スクリーンショットのため)
};`;

async function enter(page, opts) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, Object.assign({ scenario: 'road2' }, opts));
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__rc);
  return (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__rc[fn](...a), [fn, a]);
}

async function readTalk(page, R) {
  const lines = [];
  await expect.poll(() => R('running'), { timeout: 60_000 }).toBe(true);
  for (let k = 0; k < 80 && await R('running'); k++) {
    const w = await R('waiting');
    if (w) { lines.push(w); await page.click('#dialogue-overlay'); }
    await page.waitForTimeout(300);
  }
  return lines;
}

test('宝箱: 原野の岩場の武具の箱から、盗賊には「旅路の短剣」(短剣の種類)。出撃し直して開け直すと、同じ品は出ず薬草', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  expect((await R('chests')).length).toBe(15);
  await R('go', 1186.5, 226, Math.PI);
  await R('walk', [[1188, 226]], 20);
  await expect.poll(async () => (await R('chests')).find(c => c.id === 'C2-3').opened, { timeout: 15_000 }).toBe(true);
  const got = (await R('inv')).filter(it => it.id === 'road2_C2-3_rogue');
  expect(got).toHaveLength(1);
  expect(got[0]).toMatchObject({ name: '旅路の短剣', slot: 'weapon' });
  expect(got[0].wt, '短剣の種類(盗賊の武器)').toBeTruthy();
  // 補給の箱
  await R('go', 1103.5, 41, Math.PI);
  await R('walk', [[1104.8, 41]], 20);
  await expect.poll(async () => (await R('chests')).find(c => c.id === 'C1-1').opened, { timeout: 15_000 }).toBe(true);
  // 出撃し直す: 宝箱は閉じている(出撃の中だけ覚える)。同じ品は二度出ない
  await R('relaunch');
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__rc);
  await R('invuln');
  expect((await R('chests')).every(c => !c.opened)).toBe(true);
  await R('go', 1186.5, 226, Math.PI);
  await R('walk', [[1188, 226]], 20);
  await expect.poll(async () => (await R('chests')).find(c => c.id === 'C2-3').opened, { timeout: 15_000 }).toBe(true);
  expect((await R('inv')).filter(it => it.id === 'road2_C2-3_rogue')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('結末: 最終戦の後 R5-03 → A-9 → 盗「帰ろう。まだ、帰る場所がある」→ 結果画面(クリアは一度)→ 到達は 0 → 最後の酒場は一行全員の台詞', async ({ page }) => {
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', waypoint: 'joined' });
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  await R('invuln');
  const before = await R('scen');
  await R('go', 1100, 700, Math.PI);
  const w2 = R('walk', [[1100, 707]], 60);
  await readTalk(page, R);   // R5-02
  await w2;
  await expect.poll(async () => (await R('finale')).state, { timeout: 15_000 }).toBe('active');
  await R('killFinale');
  // R5-03 の終わりから、そのまま R5-04(A-9 の後に盗賊の一言)へ続く(一続きの演出として読む)
  const lines = await readTalk(page, R);
  expect(lines).toEqual(['盗賊|「結局、何だったんだろうな。今まで見てきたもの」', '弓師|「分からないまま、ですね」',
    '魔法使い|「分からないことがあっても、世界は続いています」', '剣士|「そういうものなのかもしれないな」', '盗賊|「帰ろう。まだ、帰る場所がある」']);
  expect((await R('talks'))['A-9']).toBe(1);
  expect((await R('pos')).z, '結末は石環の北の端(から北へ歩き出す)').toBeGreaterThan(727);
  // 結果画面: クリアは一度だけ。到達は 0 に戻る
  await expect.poll(() => R('resultShown'), { timeout: 60_000 }).toBe(true);
  const after = await R('scen');
  expect((after.clears[after.key] || 0) - (before.clears[before.key] || 0), 'クリアは一度だけ数える').toBe(1);
  expect(await R('roadArea')).toBe(0);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-ending-result.png` });
  // 酒場へ → 最後の酒場
  await page.click('#clear-return-btn');
  await expect.poll(() => R('world'), { timeout: 60_000 }).toBe('tavern');
  await expect.poll(async () => (await R('finaleLines')).kind, { timeout: 60_000 }).toBe('chapter1Finale');
  const fl = (await R('finaleLines')).lines;
  expect(fl[0]).toBe('酒場の主人|……戻ったか。隅の席、空けたままにしてあるぞ。');
  expect(fl).toContain('影の旅人|……ここに、座っていてもいいですか。');
  expect(fl.join('\n')).not.toContain('一緒に来い');   // 剣士の「連れて行く」は道の出会いへ移した
  expect(fl[fl.length - 1]).toBe('酒場の主人|さて。ここから先の行き先は、あんたたちで決めな。話だけは、集めておいてやる。');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-ending-tavern.png` });
  expect(errors).toEqual([]);
});
