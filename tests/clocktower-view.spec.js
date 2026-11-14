// @ts-check
/* CLOCKTOWER-MAP-001: 時計塔の中から、眼下の街が見えないこと(鐘楼に出るまで)。
 *
 *   塔の中(1〜4層と坂)を登っている間は、外壁の内側の面(towerVeil)が塔の外を隠す。屋外の鐘楼(5層)に
 *   出た瞬間に外壁の内側の面が消え、胸壁越しに街が開ける(Human Decision 2026-11-14: 鐘楼から開く)。
 *   測り方: 街(userData.towerTown)だけを不透明のマゼンタで描いた一枚を小さな描画先へ描き、色で数える。
 *   深度・裏面の省略・描画の層(別の階を描かない)は本番の描画と同じ。位置・カメラの向き・高さ・自動追従を変える。
 *   塔の中の状態を読む口は clocktower-rogue-skill2.spec.js と同じ作法(連結した本体の末尾に足す)
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

const PROBE = `
;window.__towerView = {
  go(x, y, z, o){
    o = o || {};
    state.pos.set(x, y, z); state.yVel = 0; state.grounded = true; lastSolid = state.pos.clone();
    if(typeof o.auto === 'boolean') camAutoOn = o.auto;
    if(o.yaw != null){ state.camYaw = o.yaw; state.facing = o.yaw + Math.PI; }
    if(o.hIdx != null && CAMHEIGHT_STEPS[o.hIdx]){ camHeightIdx = o.hIdx; applyCamHeightSetting(); }
    enemies.forEach(e=>{ e.triggered = false; });
    camera.position.copy(clampTowerCamera(state.pos.clone().add(getCamOffset())));
    return true;
  },
  measure(){
    const W = 192, H = 96;
    const rt = new THREE.WebGLRenderTarget(W, H);
    const mag = new THREE.MeshBasicMaterial({color:0xff00ff, fog:false, toneMapped:false});   // 色の変換(トーンマッピング)を通さない
    const swapped = [];
    scene.traverse(n=>{
      if(!n.isMesh) return;
      let a = n, town = false;
      while(a){ if(a.userData && a.userData.towerTown){ town = true; break; } a = a.parent; }
      if(town){ swapped.push([n, n.material]); n.material = mag; }
    });
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    const px = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    renderer.setRenderTarget(prev);
    swapped.forEach(([n, m])=> n.material = m);
    rt.dispose(); mag.dispose();
    let town = 0;
    for(let i=0;i<px.length;i+=4) if(px[i] > 200 && px[i+1] < 60 && px[i+2] > 200) town++;
    const ox = camera.position.x - state.pos.x, oz = camera.position.z - state.pos.z;
    return {town, cam:[camera.position.x, camera.position.y, camera.position.z].map(v=> +v.toFixed(1)), tier:towerTierAt(state.pos.y), y:+state.pos.y.toFixed(2),
      veil:towerVeilOn, camDist:+Math.hypot(ox, oz).toFixed(2), camSide:+(ox * Math.sin(state.camYaw) + oz * Math.cos(state.camYaw)).toFixed(2)};
  },
};`;

// 塔の中の位置(1〜4層・縦穴の周り・坂の途中)。[名前, x, y, z]
const INSIDE = [
  ['1層 玄関', -262, 0, 52], ['1層 振り子の間(縦穴の西)', -272, 0, 40], ['1層 守衛の小部屋', -250, 0, 40],
  ['坂 r0 の途中', -278, 4, 42],
  ['2層 工房の北', -270, 8, 26], ['2層 部品庫', -252, 8, 52], ['2層 東の帯', -252, 8, 40],
  ['坂 r1 の途中', -246, 12, 42],
  ['3層 縦穴の底(踊り場)', -262, 16, 50], ['3層 桟橋(縦穴の際)', -262, 16, 43],
  ['4層 縦穴の上(北)', -262, 26, 28], ['4層 東の帯', -250, 26, 40], ['4層 住まい', -262, 26, 52], ['4層 北の桟橋', -262, 26, 36],
  ['坂 r3 の途中', -278, 30, 42], ['坂 r3 の上の手前', -278, 33, 52],
];
const YAWS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => i * Math.PI / 4);

test.describe('CLOCKTOWER-MAP-001: 時計塔の視界', () => {
  test('1〜4層と坂: どの向き・高さ・自動追従でも、眼下の街は 1 画素も映らない。鐘楼に出ると街が開ける', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await page.route('**/__legacy-core-concatenated.js*', async route => {
      const r = await route.fetch();
      await route.fulfill({ response: r, body: `${await r.text()}\n${PROBE}` });
    });
    await openGame(page);
    await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'clocktower', waypoint: 'f2shop' });
    await expect(page.locator('#minimap-area')).toHaveText('狂いの時計塔', { timeout: 180_000 });
    await page.waitForFunction(() => window.__towerView);
    for (let i = 0; i < 10; i++) {
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(300);
    }

    const leaks = [];
    const sample = async (name, x, y, z, o) => {
      await page.evaluate(([x, y, z, o]) => window.__towerView.go(x, y, z, o), [x, y, z, o]);
      await page.waitForTimeout(500);   // カメラが追い付き、描く階の切り替えが済むまで
      const m = await page.evaluate(() => window.__towerView.measure());
      return { name, o, ...m };
    };
    for (const [name, x, y, z] of INSIDE) {
      for (const hIdx of [0, 4]) {   // カメラの高さの両端(低め・高め)
        for (const yaw of YAWS) {
          const m = await sample(name, x, y, z, { auto: false, yaw, hIdx });
          expect(m.tier, `${name} は鐘楼より下`).toBeLessThan(4);
          if (m.town > 0) leaks.push(m);
        }
      }
      // 自動追従 ON(向きは移動で回る。向きだけ変えて置く)
      for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const m = await sample(name, x, y, z, { auto: true, yaw, hIdx: 2 });
        if (m.town > 0) leaks.push(m);
      }
    }
    expect(leaks, `塔の中から街が見えた: ${JSON.stringify(leaks.slice(0, 8))}`).toEqual([]);

    // 壁際: カメラは向き(camYaw)の側に留まり、プレイヤーの真上・反対側へ回り込まない(画面が反転しない)
    for (const [name, x, y, z, yaw] of [['1層 南の壁際', -250, 0, 57.2, 0], ['2層 北の壁際', -270, 8, 22.8, Math.PI], ['4層 東の壁際', -244.8, 26, 40, Math.PI / 2], ['坂 r3 の西の壁際', -279.2, 30, 42, -Math.PI / 2]]) {
      const m = await sample(name, x, y, z, { auto: false, yaw, hIdx: 2 });
      expect(m.town, `${name}: 街が映らない`).toBe(0);
      expect(m.camSide, `${name}: カメラは向きの側(${JSON.stringify(m)})`).toBeGreaterThan(0.25);
    }
    // 1層の門の口: 前庭へ出入りする所。カメラは前庭側へ出てよい(見えるのは街と反対の前庭)。街は映らない
    for (const yaw of [0, Math.PI / 4, -Math.PI / 4]) {
      const m = await sample('1層 門の口', -262, 0, 57.5, { auto: false, yaw, hIdx: 2 });
      expect(m.town, '門の口から街が映らない').toBe(0);
      expect(m.camSide, `門の口: カメラは前庭側(${JSON.stringify(m)})`).toBeGreaterThan(3);
    }
    // 隠し歯車庫(塔の外の別の床。テストモードの周回★3): 外壁の内側の面もカメラの留めも効かない
    {
      const m = await sample('隠し歯車庫', -346, 9, 120, { auto: false, yaw: 0, hIdx: 2 });
      expect(m.veil, `隠し歯車庫では外壁の内側の面を描かない(${JSON.stringify(m)})`).toBe(false);
      expect(m.camDist, 'カメラはプレイヤーの近く(外壁の内側へ引き戻されない)').toBeLessThan(10);
      expect(m.camDist).toBeGreaterThan(3);
    }

    // 鐘楼(屋外)に出ると街が開ける: 北(街の方)を向くと街が映る
    let best = { town: 0 };
    for (const [x, z] of [[-262, 50], [-262, 28]]) {
      for (const hIdx of [0, 2]) {
        for (const yaw of YAWS) {
          const m = await sample('5層 鐘楼', x, 34, z, { auto: false, yaw, hIdx });
          expect(m.tier).toBe(4);
          if (m.town > best.town) best = m;
        }
      }
    }
    expect(best.town, `鐘楼では眼下の街が見える: ${JSON.stringify(best)}`).toBeGreaterThan(200);
    await page.evaluate(() => window.__towerView.go(-262, 0, 52, { hIdx: 2, auto: true }));
    expect(errors).toEqual([]);
  });
});
