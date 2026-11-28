// @ts-check
/* 描画の量の予算と、影の旅人の見た目の固定(CHARACTER-VIS-002 T-0)。
 *
 * ・4基礎職・上位4職: Debug Motion Preview の MESH 行(見えている本体メッシュ / 全メッシュ = 描画回数、
 *   三角形、本体の固有 Material)が T-0 の記録値を超えない。CHARACTER-VIS-002 の造形の改善で部品を
 *   足すときに、描画回数が増えていないかを見張る(減るのは可。減らしたら値を下げる)
 * ・影の旅人: 加入後のリグ・加入前の姿(立ち・座り)・影の手の「形のシグネチャ」が T-0 の記録値と一致。
 *   シグネチャは、木の形・各メッシュのジオメトリ(種類・頂点数・インデックス数・外接箱)・Material
 *   (種類・色・質感・表示の設定)・表示フラグ・変形から作るハッシュ。
 *   加入後のリグ・加入前の姿は probe の中で組み立て直し、組み立て直後の変形も含める。DEC-034 で完成した見た目を、4職の改善
 *   (共通の関数・剣士の体格)に巻き込まないための回帰テスト。影の旅人の見た目を意図して変える
 *   ときだけ、Human の承認を得て期待値を更新する
 *
 * 記録の条件: 2026-11-24、claude/road-visual-003-r3-7 @ 3b168a2 の見た目(T-0 の前後で一致を確認)。
 * 4基礎職・上位4職はテストモード(旧既定のルール、Lv 50)のトレーニング空間、影の旅人は第一章を
 * 終えたセーブの酒場。形のハッシュは route で連結スクリプトの末尾に足す probe で計算する
 * (road2-clear-reset.spec.js と同じ作法)。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue } from './helpers.js';

const PROBE = `
;window.__cvb = (function(){
  const f = (x)=> (Math.round(x*1000)/1000).toFixed(3);
  function matSig(m){
    if(!m) return '-';
    const c = m.color ? m.color.getHexString() : '';
    const e = m.emissive ? m.emissive.getHexString() : '';
    return [m.type, c, e, m.roughness, m.metalness, m.opacity, m.transparent?1:0, m.flatShading?1:0, m.side, m.map?1:0, m.uniforms && m.uniforms.uColor ? m.uniforms.uColor.value.getHexString() : ''].join(':');
  }
  function geoSig(g){
    if(!g) return '-';
    if(!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox; const n = g.attributes.position ? g.attributes.position.count : 0;
    const ic = g.index ? g.index.count : 0;
    // 頂点座標のチェックサム(0.1mm 単位に丸めた座標の重み付き和)。外接箱だけでは内側の形の変化を拾えない
    let cs = 0; const pa = g.attributes.position ? g.attributes.position.array : [];
    for(let i=0;i<pa.length;i++) cs = (cs + Math.round(pa[i]*10000) * ((i % 7) + 1)) % 1000000007;
    return [g.type, n, ic, f(b.min.x), f(b.min.y), f(b.min.z), f(b.max.x), f(b.max.y), f(b.max.z), cs].join(',');
  }
  // 変形(アニメーション)に依存しない部分だけ: 木の形・メッシュのジオメトリ・Material・表示フラグ
  function treeSig(root, withXform){
    const lines = [];
    (function walk(o, d){
      const xf = withXform ? [f(o.position.x), f(o.position.y), f(o.position.z), f(o.rotation.x), f(o.rotation.y), f(o.rotation.z), f(o.scale.x), f(o.scale.y), f(o.scale.z)].join(',') : '';
      if(o.isMesh){
        const ms = Array.isArray(o.material) ? o.material.map(matSig).join('|') : matSig(o.material);
        lines.push(d+' M '+(o.visible?1:0)+' '+geoSig(o.geometry)+' '+ms+' '+xf+(o.userData.isOutline?' O':'')+(o.userData.isXray?' X':''));
      } else lines.push(d+' G '+(o.visible?1:0)+' '+o.children.length+' '+xf);
      o.children.forEach(c=>walk(c, d+1));
    })(root, 0);
    return lines;
  }
  function hash(lines){ let h = 2166136261>>>0; const s = lines.join(String.fromCharCode(10)); for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619)>>>0; } return h.toString(16)+'/'+lines.length; }
  function counts(root){
    let body=0, total=0, tris=0; const mats=new Set();
    root.traverseVisible(o=>{ if(!o.isMesh) return; total++; const g=o.geometry; tris += g.index ? g.index.count/3 : g.attributes.position.count/3;
      if(o.userData.isOutline || o.userData.isXray) return; body++; (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m.uuid)); });
    return {body, total, tris:Math.round(tris), mats:mats.size};
  }
  return {
    sigs(){
      /* 加入後のリグは、ゲーム中のものを使わずにここで組み立て直し、組み立て直後の変形(位置・回転・
         拡大)も含めて比べる ―― ゲーム中のリグは待機のアニメーションで部品が動くため、変形を比べられない。
         組み立ては共有変数(playerMixerParts)を書くので、元へ戻してシーンからも外す */
      const keepParts = playerMixerParts;
      playerMixerParts = {};
      const fresh = buildPlayer(state.classDef, selectedGender);
      scene.remove(fresh);
      playerMixerParts = keepParts;
      const out = { player: hash(treeSig(fresh, true)) };
      if(typeof buildRoadTravelerFigure === 'function'){
        out.prejoin = hash(treeSig(buildRoadTravelerFigure(false), true));
        out.prejoinSeated = hash(treeSig(buildRoadTravelerFigure(true), true));
      }
      const A = shadowHandAssets();
      const hl = Object.keys(A.geo).sort().map(k=>k+' '+geoSig(A.geo[k]));
      const mm = A.mat; hl.push('mat '+(mm ? Object.keys(mm).sort().map(k=>k+'='+matSig(mm[k])).join(';') : '-'));
      out.hand = hash(hl);
      return out;
    }
  };
})();`;

/* 描画の量の上限(本体 / 全体 / 三角形 / 固有 Material)。T-0 の記録値から CHARACTER-VIS-002 T-1 で更新:
   目の3枚に輪郭線・X 線シェルを付けなくなった分、全体が 1 人 -18(輪郭線 2 枚 + X 線 1 枚 × 6 枚)。
   三角形は目の外周の点の数の増加(白目 16・瞳 12・ハイライト 8 で +144 / 人)と輪郭線の削減を合わせて T-0 より 1 人 -216。
   減らした値を新しい上限にする。
   顔のパーツ(Human Decision E-3 = B): 口と鼻で本体 +2(輪郭線なし)・三角形 +80・Material +1(口の色)。
   剣士・戦騎士(CHARACTER-VIS-002 T-2): 籠手を作らない(本体 -2、全体 -8)、ポケットの輪郭線・X 線なし
   (全体 -9)で全体 -17、三角形 -692
   頭(CHARACTER-VIS-002 T-2R-3、DEC-038 H-1 = O1 / H-4): 4職と上位4職の頭を 8 点 × 5 段 → 16 点 × 10 段、髪の殻を
   8 点 × 4 段 → 16 点 × 7 段にした。描画の数(本体・全体)と Material は変わらない。三角形は 1 人 +1600
   (頭 +240・髪の殻 +160 = +400 が、本体・輪郭線 2 枚・X 線シェルの 4 つで描かれる)。影の旅人は不変 */
const BUDGET = [
  {key:'warrior', job:null,           name:'剣士',         body:82, total:292, tris:16516, mats:21},
  {key:'warrior', job:'battleKnight', name:'戦騎士',       body:91, total:328, tris:18092, mats:24},
  {key:'mage',    job:null,           name:'魔法使い',     body:74, total:269, tris:16848, mats:20},
  {key:'mage',    job:'archmage',     name:'魔導士',       body:89, total:329, tris:18256, mats:22},
  {key:'archer',  job:null,           name:'弓師',         body:78, total:285, tris:16996, mats:23},
  {key:'archer',  job:'hawkEye',      name:'鷹の目',       body:88, total:325, tris:18820, mats:27},
  {key:'rogue',   job:null,           name:'盗賊',         body:80, total:293, tris:16232, mats:24},
  {key:'rogue',   job:'berserker',    name:'バーサーカー', body:85, total:313, tris:17008, mats:26},
];
const WANDERER = {
  mesh: {body:82, total:322, tris:15508, mats:16},
  sig: {player:'ef435a21/341', prejoin:'4aeddb73/31', prejoinSeated:'4e1507f0/35', hand:'b9781fa3/8'},
};

async function readMesh(page){
  await page.keyboard.press('Backquote');
  await expect(page.locator('#motion-panel')).toContainText('MESH', { timeout: 5_000 });
  const text = await page.locator('#motion-panel').innerText();
  const m = text.match(/MESH\s+(\d+)\/(\d+)\s+TRI\s+(\d+)\s+MAT\s+(\d+)/);
  return m ? {body:Number(m[1]), total:Number(m[2]), tris:Number(m[3]), mats:Number(m[4])} : null;
}

test.describe('描画の量の予算(4基礎職・上位4職)', () => {
  for (const j of BUDGET) {
    test(`${j.name}: 描画メッシュ・三角形・Material が T-0 の記録値を超えない`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await openGame(page);
      await page.click('#open-testmode-btn');
      await page.click('#testmode-rules-grid [data-test-rules="legacy"]');
      await page.click(`.class-card[data-key="${j.key}"]`);
      await page.waitForFunction(() =>
        document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
      if (j.job) await page.locator('#testmode-job-grid .testmode-job-card').nth(1).click();
      await page.click('#testmode-start-btn');
      await page.waitForFunction(() => {
        const wrap = document.getElementById('canvas-wrap');
        return !!(wrap && wrap.querySelector('canvas'));
      }, { timeout: 20_000 });
      await page.waitForTimeout(700);
      const m = await readMesh(page);
      expect(m, `${j.name}: MESH 行が読める`).not.toBeNull();
      if (process.env.CVB_PRINT) console.log('CVB_MESH ' + j.name + ' ' + JSON.stringify(m));
      expect(m.total, `${j.name}: 描画メッシュ(輪郭線・X 線を含む)`).toBeLessThanOrEqual(j.total);
      expect(m.body, `${j.name}: 本体メッシュ`).toBeLessThanOrEqual(j.body);
      expect(m.tris, `${j.name}: 三角形`).toBeLessThanOrEqual(j.tris);
      expect(m.mats, `${j.name}: 本体の固有 Material`).toBeLessThanOrEqual(j.mats);
      expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});

test('影の旅人: 加入後・加入前(立ち・座り)・影の手の形が T-0 の記録値と一致し、描画の量も同じ', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  const save = {
    v: 2, selectedClass: 'rogue', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '—', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 30, xp: 0, xpToNext: 999999,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 3, shard: 0, mppotion: 1 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedSkill2: true, smithJoined: true, smithGreeted: true,
    scenarioClears: { mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1, road: 1 },
    clearedScenarios: {}, routeCombosSeen: {},
  };
  await page.addInitScript(([key, payload]) => { localStorage.setItem(key, payload); },
    ['soulforge_save_v1', JSON.stringify(save)]);
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
  await dismissIntroDialogue(page);
  await expect(page.locator('#hud-name')).toContainText('影の旅人');
  await page.waitForFunction(() => /** @type {any} */ (window).__cvb);
  await page.waitForTimeout(700);
  const m = await readMesh(page);
  expect(m, '描画の量').toEqual(WANDERER.mesh);
  const sig = await page.evaluate(() => /** @type {any} */ (window).__cvb.sigs());
  if (process.env.CVB_PRINT) console.log('CVB_SIG ' + JSON.stringify(sig));
  expect(sig.player, '加入後のリグの形').toBe(WANDERER.sig.player);
  expect(sig.prejoin, '加入前の姿(立ち)の形').toBe(WANDERER.sig.prejoin);
  expect(sig.prejoinSeated, '加入前の姿(酒場の座り)の形').toBe(WANDERER.sig.prejoinSeated);
  expect(sig.hand, '影の手の形').toBe(WANDERER.sig.hand);
  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});
