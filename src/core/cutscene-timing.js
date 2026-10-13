/* 演出(playCutscene)の手順の間の待ち時間(CH1-EXP X-2)。

   ■ 何を直すか
   宵待ちの村の演出では、台詞の無い間が「進行が止まった」ように見えていた
   (.ai/reports/CHAPTER-1-experience-audit.md §3):
     - 記憶の声の後、会話欄を消してから二人が話し出すまでの 0.8〜1.2 秒
     - 最初の台詞までの前置き(WORK 12.1 で合計 0.8 秒に詰めたもの)
     - 演出の時間はゲーム内の時間で進み、1 フレームは 50ms で頭打ちなので、
       低 fps ではこれらの待ちが実時間で延びる
   一方、前置きを一律に詰める処理は、見せたい演出(ボスの手前で記憶が集まる、
   撃破後に記憶が戻る、水門守のレバーが動く)まで同じ倍率で詰めていた。

   ■ 決め方
   手順ごとに「待ち時間」と「実時間で数えるか」を決める。
     - 見せ場の手順は keep:true を付ける。詰めない(ただし 1 区間の見せ場の
       合計は keepMaxSec まで)。画面の動き(人影のフェードなど)とずれない
       よう、ゲーム内の時間で数える
     - それ以外の待ち(歩く・振り向く・会話欄を消す・次の台詞までの間)は
       待たせるための間ではないので、
         ・最初の台詞までの前置きは合計 firstLineSec まで
         ・台詞を送った後、次の台詞までの間は合計 gapSec まで(gapSec を
           渡したときだけ。送った直後の手順はもともと待たずに走る)
       に詰める。opts.realtime を渡した演出(宵待ちの村)だけ、これらを
       **実時間で数える**(低 fps で延びない)。他の演出はゲーム内の時間のまま
       ―― 演出で歩かせる距離(state.walkTo の速さ × 時間)がゲーム内の時間で
       決まっているので、実時間で数えると歩く距離が縮む(Review Round 1)

   state・THREE には依存しない。steps は {t, keep} だけを読み、isLine は
   「その手順が台詞を出すか」の配列(legacy 側が判定する)。 */

export const CUTSCENE_FIRST_LINE_SEC = 0.8;   // 既定(WORK 12.1 と同じ)
export const CUTSCENE_KEEP_MAX_SEC = 3.5;     // 1 区間の見せ場の上限

/* 返り値: 手順ごとの {t, realtime}。元の steps は書き換えない */
export function planCutsceneTiming(steps, isLine, opts){
  const o = opts || {};
  const firstLineSec = Number.isFinite(o.firstLineSec) ? o.firstLineSec : CUTSCENE_FIRST_LINE_SEC;
  const gapSec = Number.isFinite(o.gapSec) ? o.gapSec : null;
  const keepMax = Number.isFinite(o.keepMaxSec) ? o.keepMaxSec : CUTSCENE_KEEP_MAX_SEC;
  const n = steps.length;
  const realtimeOk = o.realtime === true;
  const out = steps.map(s => ({ t: Math.max(0, Number(s && s.t) || 0), realtime: realtimeOk && !(s && s.keep), keep: !!(s && s.keep) }));
  const lineAt = [];
  for(let i = 0; i < n; i++) if(isLine[i]) lineAt.push(i);

  // ある区間 [a, b](両端を含む)の待ちを、keep とそれ以外に分けて上限へ詰める
  const fit = (a, b, limit)=>{
    if(a > b) return;
    let free = 0, keep = 0;
    for(let i = a; i <= b; i++){ if(out[i].keep) keep += out[i].t; else free += out[i].t; }
    if(limit !== null && free > limit){
      const k = limit / free;
      for(let i = a; i <= b; i++) if(!out[i].keep) out[i].t *= k;
    }
    if(keep > keepMax){
      const k = keepMax / keep;
      for(let i = a; i <= b; i++) if(out[i].keep) out[i].t *= k;
    }
  };

  // 最初の台詞まで(台詞が無い演出は、階段の自動移動などなので触らない)
  if(lineAt.length) fit(0, lineAt[0], firstLineSec);
  // 台詞を送った後、次の台詞まで。送った直後の手順(i+1)は待たずに走るので、
  // 待ちは i+2 から次の台詞の手順まで
  if(gapSec !== null){
    for(let k = 0; k < lineAt.length; k++){
      const i = lineAt[k];
      const j = k + 1 < lineAt.length ? lineAt[k + 1] : n - 1;
      fit(i + 2, j, gapSec);
    }
  }
  return out;
}

/* 1 フレームで手順の時計をどれだけ進めるか。実時間で数える手順は、ゲーム内の
   時間(dt、50ms で頭打ち)と実時間(realDt)の大きい方 ―― 低 fps でも実時間
   どおりに進み、速い端末ではゲーム内の時間どおり。realDt は呼び出し側で
   上限を付けて渡す(タブを離れていた後の 1 フレームで飛ばないように)。
   scriptedMotion: 演出で体を動かしている間(徒歩・振り向き・同行者の歩み)。
   その間はゲーム内の時間で数える ―― 動きがゲーム内の時間で進むので、時計だけ
   実時間で進めると、歩き切る前に次の手順が走る */
export function cutsceneStepDelta(dt, realDt, realtime, scriptedMotion){
  const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
  if(!realtime || scriptedMotion) return d;
  const r = Number.isFinite(realDt) && realDt > 0 ? realDt : 0;
  return Math.max(d, r);
}
