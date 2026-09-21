// @ts-check
/* 武器収納・抜刀/納刀の実機経路(8職)。
 *
 * 状態機械そのもの(遷移・キュー・blend の連続性)は
 *   tests/unit/weapon-state.test.js
 * が見ている。ここで確認するのは、実際にゲームの中でその形になっているか:
 *
 *   非戦闘で武器が収納位置へ移り、両手が空くこと
 *   剣士の大剣の切っ先が床へ刺さらないこと(収納しても、抜いても)
 *   攻撃すると抜刀を経て手に収まり、攻撃できるようになること
 *   収納中は canAttack が false ―― 弓が背中から撃たれる経路が無いこと
 *   戦闘 / 非戦闘でカメラの距離が切り替わること
 *
 * 実測値は Debug Motion Preview の STOW / CAMERA ブロックから読む
 * (通常プレイの HUD には何も足していない)。絵から判定しようとすると、
 * 見下ろしの視点では背中も切っ先も潰れて読めない ―― 前回の8職監査で
 * 「魔法使いは帽子のつばで腕と杖が完全に隠れる」に行き当たったのと
 * 同じ理由で、ここは数字で見る。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame } from './helpers.js';

const JOBS = [
  {key:'warrior', job:null,           name:'剣士',         socket:'back'},
  {key:'warrior', job:'battleKnight', name:'戦騎士',       socket:'back'},
  {key:'rogue',   job:null,           name:'盗賊',         socket:'waist'},
  {key:'rogue',   job:'berserker',    name:'バーサーカー', socket:'waist'},
  {key:'mage',    job:null,           name:'魔法使い',     socket:'none'},
  {key:'mage',    job:'archmage',     name:'魔導士',       socket:'none'},
  {key:'archer',  job:null,           name:'弓師',         socket:'back'},
  {key:'archer',  job:'hawkEye',      name:'鷹の目',       socket:'back'},
];

/* テストモードで出撃し、デバッグパネルを開く。テストモードは
   「基礎職を選ぶ → その職のジョブ一覧から出撃」という2段構えで、
   上位職もここから直接出せる(mansion-escort.spec.js と同じ手順)。 */
async function sortie(page, classKey, jobKey){
  await openGame(page);
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`.class-card[data-key="${classKey}"]`);
  await page.click(`.class-card[data-key="${classKey}"]`);
  await page.waitForFunction(() =>
    document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  /* ジョブ欄は「基礎職のまま」「上位職(転身)」の2枚で、カードに
     キーの属性が付いていない(01-character-creation.js の renderJobGrid)。
     転身したい場合は2枚目 ―― 枚数は上で 2 以上を待って確認済み。 */
  if(jobKey) await page.locator('#testmode-job-grid .testmode-job-card').nth(1).click();
  await page.click('#testmode-start-btn');
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
  await page.waitForTimeout(700);
  await page.keyboard.press('Backquote');
  await expect(page.locator('#motion-panel')).toContainText('MOTION PREVIEW', { timeout: 5_000 });
}

/* パネルの STOW / CAMERA ブロックを読む。パネルの書き換えは0.5秒に
   1回なので、呼ぶ側は必ずその間隔より長く待ってから読む。 */
async function readPanel(page){
  const text = (await page.locator('#motion-panel').textContent()) || '';
  const phase  = /PHASE\s+(\w+)\s+BLEND\s+([\d.-]+)/.exec(text);
  const socket = /SOCKET\s+(\w+)\s+ARMED\s+(yes|no)/.exec(text);
  const tip    = /TIP\.Y\s+([\d.-]+)m\s+GRIP\.Y\s+([\d.-]+)m/.exec(text);
  const cam    = /DIST\s+([\d.-]+)\s+HEIGHT\s+([\d.-]+)/.exec(text);
  const blendC = /BLEND\s+([\d.-]+)\s+BONUS\s+([\d.-]+)m/.exec(text);
  if(!phase || !socket) return null;
  return {
    phase: phase[1], blend: +phase[2],
    socket: socket[1], armed: socket[2] === 'yes',
    tipY: tip ? +tip[1] : null, gripY: tip ? +tip[2] : null,
    camDist: cam ? +cam[1] : null, camHeight: cam ? +cam[2] : null,
    camBlend: blendC ? +blendC[1] : null, camBonus: blendC ? +blendC[2] : null,
  };
}

// 条件が満たされるまでパネルを読み直す(0.5秒周期の書き換えを跨ぐため)
async function until(page, pred, tries = 24){
  let last = null;
  for(let i=0;i<tries;i++){
    await page.waitForTimeout(300);
    last = await readPanel(page);
    if(last && pred(last)) return last;
  }
  return last;
}

test.describe('武器収納・抜刀/納刀(8職)', () => {
  for(const j of JOBS){
    test(`${j.name}: 非戦闘で収納され、攻撃で抜刀して手に収まる`, async ({ page }) => {
      test.setTimeout(150_000);
      const errors = watchErrors(page);
      await sortie(page, j.key, j.job);

      /* --- 非戦闘 --- 敵から離れている訓練場なので、戦闘態勢が切れて
         納刀まで進み切るのを待つ(COMBAT_STANCE_HOLD 2.6秒 + 納刀) */
      const rest = await until(page, s => s.phase === 'stowed');
      expect(rest, 'STOW ブロックが読めること').not.toBeNull();
      expect(rest.phase, '非戦闘なのに武器を収納していない').toBe('stowed');
      expect(rest.blend, '収納しきっていない').toBeGreaterThan(0.98);
      expect(rest.armed, '収納中なのに攻撃できる状態になっている').toBe(false);
      expect(rest.socket, '収納先が仕様と違う').toBe(j.socket);

      /* 床の貫通。大剣は tip 1.55m(戦騎士は ×1.32 で約2.05m)あり、
         以前「肩に担ぐ」型を取らざるを得なかった理由がこれだった。
         背中へ移した今は、切っ先が床より上にあることを直接見る。 */
      if(rest.tipY != null){
        expect(rest.tipY, `切っ先が床を突き抜けている (y=${rest.tipY}m)`).toBeGreaterThan(0.15);
        expect(rest.tipY, `切っ先が高すぎる (y=${rest.tipY}m)`).toBeLessThan(3.6);
      }

      /* --- 抜刀 --- 攻撃入力。収納中なので1発目は出ず、キューされて
         抜刀が始まる ―― そのうえで、抜き終われば必ず手に収まる */
      await page.keyboard.press('KeyJ');
      const armed = await until(page, s => s.phase === 'armed');
      expect(armed.phase, '攻撃入力から抜刀まで進んでいない').toBe('armed');
      expect(armed.blend, '手に収まりきっていない').toBeLessThan(0.02);
      expect(armed.armed, '手にあるのに攻撃できない').toBe(true);
      if(armed.tipY != null){
        expect(armed.tipY, `抜いた状態で切っ先が床下 (y=${armed.tipY}m)`).toBeGreaterThan(-0.2);
      }

      /* --- 納刀 --- 戦闘態勢(2.6秒)が切れれば、また収まる */
      const back = await until(page, s => s.phase === 'stowed', 30);
      expect(back.phase, '戦闘が終わっても納刀しない').toBe('stowed');

      expect(errors).toEqual([]);
    });
  }

  /* 仕様 9。弓師は projectileOrigin() が武器のワールド座標を読むので、
     収納中に発射経路へ入れてはいけない。「攻撃入口で止まっている」ことを
     状態で見る ―― canAttack が false の間は tryAttack が発射まで
     到達しない、というのが実装側の保証。 */
  test('弓師: 収納中は攻撃可能状態にならない(背中から撃たない)', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await sortie(page, 'archer', null);

    const rest = await until(page, s => s.phase === 'stowed');
    expect(rest.phase).toBe('stowed');
    expect(rest.armed, '弓が背中にあるのに撃てる状態になっている').toBe(false);

    // 抜き切るまでの間、一度でも「収納側にいるのに撃てる」状態が
    // 現れないこと。抜刀は0.22秒なので、細かく刻んで覗く
    await page.keyboard.press('KeyJ');
    for(let i=0;i<8;i++){
      const s = await readPanel(page);
      if(s && s.blend > 0.02){
        expect(s.armed, `blend=${s.blend} なのに攻撃可能になっている`).toBe(false);
      }
      await page.waitForTimeout(120);
    }
    expect(errors).toEqual([]);
  });

  /* 仕様 12・17。戦闘 / 非戦闘でカメラの距離が変わり、戦闘側は
     現行値(camDist 6)へ戻ること。camAutoOn には触れていない。 */
  test('カメラ: 非戦闘では引き、戦闘では現行の距離へ戻る', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await sortie(page, 'warrior', null);

    const rest = await until(page, s => s.camBlend != null && s.camBlend < 0.05);
    expect(rest.camBlend, '非戦闘なのに戦闘カメラのまま').toBeLessThan(0.05);
    expect(rest.camDist, '非戦闘で引いていない').toBeGreaterThan(6.5);

    // 攻撃すると戦闘態勢が立つ = カメラが寄る
    await page.keyboard.press('KeyJ');
    const fight = await until(page, s => s.camBlend != null && s.camBlend > 0.9);
    expect(fight.camBlend, '戦闘カメラへ寄っていない').toBeGreaterThan(0.9);
    // 戦闘時は現行値(6.0)+ ターゲット距離による追加(訓練場に敵が
    // 居なければ 0)。上限は 6.0 + 1.2
    expect(fight.camDist).toBeGreaterThan(5.9);
    expect(fight.camDist, 'ズームアウトしすぎ').toBeLessThan(7.3);
    expect(fight.camDist, '戦闘で寄っていない').toBeLessThan(rest.camDist + 0.01);

    // 戦闘が終われば戻る
    const after = await until(page, s => s.camBlend != null && s.camBlend < 0.05, 30);
    expect(after.camBlend, '戦闘後に非戦闘カメラへ戻らない').toBeLessThan(0.05);

    expect(errors).toEqual([]);
  });
});
