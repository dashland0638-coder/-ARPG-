import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUltClips, chainProfile, peakIndex, ultImpactFrac, ultImpactDelay,
  ULT_IMPACT_FRAC, ULT_DURATION, JOB_ULT_CLIP, ULT_MAX_IMPACT_DELAY, ultClipWarp,
} from '../../src/core/ult-clips.js';

/* 検査用の構え。実際の STANCE と同じチャンネル構成であればよく、
   値そのものは「どのフレームが構えからどれだけ離れているか」の
   基準にしか使わない。 */
const STANCE = {
  warrior:{waist:[0.02,0.03,0], shL:[-0.52,0.10,0.30], elL:-0.75, shR:[-0.50,-0.10,-0.28], elR:-0.78,
           hipL:0.04, hipR:-0.04, kneeL:0.06, kneeR:0.06, wep:[0,1,0, 1,0,0], grip:'BOTH'},
  rogue:  {waist:[0.03,0.05,0], shL:[-0.60,0.12,0.34], elL:-0.90, shR:[-0.55,-0.12,-0.30], elR:-0.95,
           hipL:0.05, hipR:-0.05, kneeL:0.08, kneeR:0.08, wep:[0,1,0, 1,0,0], grip:'R'},
  mage:   {waist:[0.01,0.02,0], shL:[-0.48,0.14,0.36], elL:-0.70, shR:[-0.46,-0.12,-0.32], elR:-0.72,
           hipL:0.03, hipR:-0.03, kneeL:0.05, kneeR:0.05, wep:[0,1,0, 1,0,0], grip:'R'},
  archer: {waist:[0.02,0.30,0], shL:[-0.80,-0.12,0.36], elL:-0.40, shR:[-0.25,-0.20,-0.70], elR:-1.20,
           hipL:0.05, hipR:-0.06, kneeL:0.08, kneeR:0.08, wep:[0,1,0, 0,0,-1], draw:0.12, grip:'L'},
};
const S = k => STANCE[k];
const CLIPS = buildUltClips(S);

const ALL = [
  ['warrior', 'ult',             'warrior'],
  ['warrior', 'ultBattleKnight', 'warrior'],
  ['rogue',   'ultRogue',        'rogue'],
  ['rogue',   'ultBerserker',    'rogue'],
  ['mage',    'ultMage',         'mage'],
  ['mage',    'ultArchmage',     'mage'],
  ['archer',  'ultArcher',       'archer'],
  ['archer',  'ultHawkEye',      'archer'],
];

test('8職ぶんの必殺技クリップが揃っている', ()=>{
  ALL.forEach(([cls, name])=>{
    assert.ok(CLIPS[cls] && CLIPS[cls][name], `${cls}.${name} が無い`);
    assert.ok(CLIPS[cls][name].length >= 6, `${name} のフレームが少なすぎる`);
  });
  // 上位職4種すべてに専用の型がある(以前は基礎職と同じ型を再生速度だけ
  // 変えて使い回していた)
  assert.deepEqual(Object.keys(JOB_ULT_CLIP).sort(),
                   ['archmage','battleKnight','berserker','hawkEye']);
});

test('キーフレームの時間軸が壊れていない', ()=>{
  ALL.forEach(([cls, name])=>{
    const f = CLIPS[cls][name];
    assert.equal(f[0].t, 0, `${name} は 0 から始まること`);
    assert.equal(f[f.length-1].t, 1, `${name} は 1 で構えへ戻ること`);
    for(let i=1;i<f.length;i++){
      assert.ok(f[i].t > f[i-1].t, `${name} の t が単調でない(${f[i-1].t} -> ${f[i].t})`);
    }
  });
});

test('終端は必ずそのクラスの構えそのもの(次の行動へ素直に繋がる)', ()=>{
  ALL.forEach(([cls, name, stanceKey])=>{
    const f = CLIPS[cls][name];
    assert.deepEqual(f[f.length-1], Object.assign({}, STANCE[stanceKey], {t:1}),
      `${name} の終端が構えと違う`);
  });
});

test('力の伝達 ―― 脚が先に動き、腕はあとから伸び切る', async t=>{
  await t.test('沈みのフレームで脚が既に動いている', ()=>{
    ALL.forEach(([cls, name, stanceKey])=>{
      const p = chainProfile(CLIPS[cls][name], STANCE[stanceKey]);
      assert.ok(p[1].legs > 0.05, `${name}: 2枚目で脚が動いていない(腕だけ動く振りになる)`);
    });
  });

  await t.test('腕が伸び切るのは脚が動き出した後', ()=>{
    ALL.forEach(([cls, name, stanceKey])=>{
      const p = chainProfile(CLIPS[cls][name], STANCE[stanceKey]);
      const armPeak = peakIndex(p, 'arms');
      assert.ok(armPeak >= 2, `${name}: 腕の最大が ${armPeak} 枚目 ―― 沈みより前に伸び切っている`);
    });
  });

  await t.test('武器が振り抜けるのは腕が動き出した後(武器だけ振らない)', ()=>{
    ALL.forEach(([cls, name, stanceKey])=>{
      const p = chainProfile(CLIPS[cls][name], STANCE[stanceKey]);
      const weaponPeak = peakIndex(p, 'weapon');
      const firstArm = p.findIndex(x=> x.arms > 0.05);
      assert.ok(firstArm > 0, `${name}: 腕が最後まで動かない`);
      assert.ok(weaponPeak >= firstArm, `${name}: 腕より先に武器だけが振れている`);
    });
  });
});

test('反動の戻り ―― 腰が先に帰り、腕が遅れて残る', ()=>{
  ALL.forEach(([cls, name, stanceKey])=>{
    const p = chainProfile(CLIPS[cls][name], STANCE[stanceKey]);
    const unwind = p[p.length-2];          // 構えへ戻る1つ手前(巻戻しのフレーム)
    const waistPeak = Math.max(...p.map(x=>x.waist));
    const armPeak = Math.max(...p.map(x=>x.arms));
    assert.ok(waistPeak > 0 && armPeak > 0);
    // 巻戻しの時点で、腰は腕より構えへ近づいている(=先に帰っている)
    const waistLeft = unwind.waist / waistPeak;
    const armLeft = unwind.arms / armPeak;
    assert.ok(waistLeft < armLeft,
      `${name}: 巻戻しで腰(${waistLeft.toFixed(2)})が腕(${armLeft.toFixed(2)})より残っている`);
  });
});

test('上位職の型は基礎職の型と別物である', ()=>{
  const pairs = [['warrior','ult','ultBattleKnight'], ['rogue','ultRogue','ultBerserker'],
                 ['mage','ultMage','ultArchmage'], ['archer','ultArcher','ultHawkEye']];
  pairs.forEach(([cls, base, job])=>{
    assert.notDeepEqual(CLIPS[cls][base], CLIPS[cls][job], `${job} が ${base} と同一`);
  });
});

test('職業ごとの性格が数値に出ている', async t=>{
  await t.test('バーサーカーは剣士より深く沈み、戻りの反動も大きい', ()=>{
    const ber = chainProfile(CLIPS.rogue.ultBerserker, STANCE.rogue);
    const rog = chainProfile(CLIPS.rogue.ultRogue, STANCE.rogue);
    assert.ok(Math.max(...ber.map(x=>x.legs)) > Math.max(...rog.map(x=>x.legs)));
    const drops = CLIPS.rogue.ultBerserker.map(f=> f.drop || 0);
    assert.ok(Math.max(...drops) > 0.5, 'バーサーカーの沈み込みが浅い');
  });
  await t.test('戦騎士の踏み込みは剣士より小さい(前進量を抑える)', ()=>{
    const push = c => Math.max(...CLIPS.warrior[c].map(f=> f.push || 0));
    assert.ok(push('ultBattleKnight') < push('ult'),
      '戦騎士が剣士より踏み込んでいる');
  });
  await t.test('鷹の目の溜めは弓師より長い', ()=>{
    // draw が 1 に達する t がそのまま「引き絞り切るまでの長さ」
    const drawFull = c => CLIPS.archer[c].find(f=> f.draw === 1).t;
    assert.ok(drawFull('ultHawkEye') > drawFull('ultArcher'));
    assert.ok(ULT_DURATION.ultHawkEye > ULT_DURATION.ultArcher);
  });
  await t.test('魔導士は魔法使いよりいちばん長く溜める', ()=>{
    assert.ok(ULT_IMPACT_FRAC.ultArchmage > ULT_IMPACT_FRAC.ultMage);
    assert.ok(ULT_DURATION.ultArchmage > ULT_DURATION.ultMage);
  });
});

test('必殺技の一撃が届く瞬間', async t=>{
  await t.test('全クリップに定義がある', ()=>{
    ALL.forEach(([,name])=> assert.ok(ultImpactFrac(name) > 0, `${name} に impact frac が無い`));
  });
  await t.test('接触は溜めの後・戻りの前(0.15〜0.60 に収まる)', ()=>{
    ALL.forEach(([,name])=>{
      const f = ultImpactFrac(name);
      assert.ok(f >= 0.15 && f <= 0.60, `${name}: ${f}`);
    });
  });
  await t.test('遅延は秒に換算される。未知のクリップは 0(=従来どおり即時)', ()=>{
    assert.ok(Math.abs(ultImpactDelay('ultRogue', 0.50) - 0.34*0.50) < 1e-9);
    assert.equal(ultImpactDelay('unknownClip', 0.7), 0);
    assert.equal(ultImpactDelay('ult', 0), 0);
  });
  await t.test('どれだけ溜めの長い技でも上限で頭を打つ(必殺技だけ硬直させない)', ()=>{
    assert.equal(ultImpactDelay('ultArchmage', 10), ULT_MAX_IMPACT_DELAY);
    // 実際のクリップ長(上位職の再生速度込み)でも上限を超えない
    const real = {ult:0.72, ultBattleKnight:0.62*1.25, ultRogue:0.50, ultBerserker:0.74*0.82,
                  ultMage:0.68, ultArchmage:0.88, ultArcher:0.85, ultHawkEye:0.98*1.08};
    Object.entries(real).forEach(([clip, dur])=>{
      const d = ultImpactDelay(clip, dur);
      assert.ok(d > 0 && d <= ULT_MAX_IMPACT_DELAY + 1e-9, `${clip}: ${d}`);
    });
  });
  await t.test('サブ武器の型にも定義がある(通常攻撃の型を流用しているため)', ()=>{
    ['ultSpear','ultKatana','ultSpellblade'].forEach(c=>
      assert.ok(ultImpactFrac(c) > 0, `${c} に impact frac が無い`));
  });
});

test('可動域が常識の範囲に収まっている(人形が壊れない)', ()=>{
  ALL.forEach(([cls, name])=>{
    CLIPS[cls][name].forEach(f=>{
      if(f.waist) f.waist.forEach(v=> assert.ok(Math.abs(v) <= 1.0, `${name} waist ${v}`));
      [f.shL, f.shR].forEach(sh=>{ if(sh) sh.forEach(v=> assert.ok(Math.abs(v) <= 2.4, `${name} sh ${v}`)); });
      [f.elL, f.elR].forEach(el=>{ if(el != null) assert.ok(el <= 0.01 && el >= -2.8, `${name} el ${el}`); });
      [f.hipL, f.hipR].forEach(h=>{ if(h != null) assert.ok(Math.abs(h) <= 0.7, `${name} hip ${h}`); });
      [f.kneeL, f.kneeR].forEach(k=>{ if(k != null) assert.ok(k >= 0 && k <= 0.8, `${name} knee ${k}`); });
      if(f.draw != null) assert.ok(f.draw >= 0 && f.draw <= 1, `${name} draw ${f.draw}`);
    });
  });
});

test('ultClipWarp ―― 見た目の接触を当たる瞬間へ重ねる', async t=>{
  await t.test('端は動かさない', ()=>{
    assert.equal(ultClipWarp(0, 0.5, 0.34), 0);
    assert.equal(ultClipWarp(1, 0.5, 0.34), 1);
  });
  await t.test('当たる瞬間にちょうど接触フレームを再生している', ()=>{
    assert.ok(Math.abs(ultClipWarp(0.34, 0.52, 0.34) - 0.52) < 1e-12);
    assert.ok(Math.abs(ultClipWarp(0.17, 0.34, 0.17) - 0.34) < 1e-12);
  });
  await t.test('単調増加(逆再生や停止が起きない)', ()=>{
    let prev = -1;
    for(let i=0;i<=100;i++){
      const v = ultClipWarp(i/100, 0.52, 0.34);
      assert.ok(v >= prev, `${i}: ${v} < ${prev}`);
      prev = v;
    }
  });
  await t.test('遅延が無い/未定義なら何も歪めない', ()=>{
    for(let i=0;i<=10;i++){
      const x = i/10;
      assert.equal(ultClipWarp(x, 0.52, 0), x);
      assert.equal(ultClipWarp(x, 0, 0.34), x);
      assert.equal(ultClipWarp(x, 0.52, 1), x);
    }
  });
  await t.test('範囲外の t はクランプされる', ()=>{
    assert.equal(ultClipWarp(-1, 0.52, 0.34), 0);
    assert.equal(ultClipWarp(9, 0.52, 0.34), 1);
  });
  await t.test('実際の8職すべてで、当たる瞬間に接触フレームが再生される', ()=>{
    const tempo = {battleKnight:1.25, berserker:0.82, archmage:1.0, hawkEye:1.08};
    const rows = [['ult',null],['ultBattleKnight','battleKnight'],['ultRogue',null],
                  ['ultBerserker','berserker'],['ultMage',null],['ultArchmage','archmage'],
                  ['ultArcher',null],['ultHawkEye','hawkEye']];
    rows.forEach(([clip, job])=>{
      const dur = ULT_DURATION[clip] * (job ? tempo[job] : 1);
      const delay = ultImpactDelay(clip, dur);
      const hitFrac = delay / dur;
      const played = ultClipWarp(hitFrac, ultImpactFrac(clip), hitFrac);
      assert.ok(Math.abs(played - ultImpactFrac(clip)) < 1e-9,
        `${clip}: 当たる瞬間に t=${played} を再生(接触は ${ultImpactFrac(clip)})`);
      assert.ok(delay <= ULT_MAX_IMPACT_DELAY + 1e-9);
    });
  });
});
