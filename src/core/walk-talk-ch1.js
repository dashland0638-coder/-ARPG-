/* 第一章の歩きながらの掛け合い(WALK-TALK-CH1、DEC-033)。道(新)以外の第一章のシナリオの話題のデータ。
   表示・流し方・止める条件は共通(core/walk-talk.js、legacy の walkTalk*)。ここは「どこで・誰と・何を」だけ。

   ■ 話題の形
     id     … その出撃で 1 回だけ(同じ話題は繰り返さない)
     rect   … 帯(x0..x1 / z0..z1。積み重ねた階は y0..y1 も)。止める会話・戦闘の場所と重ねない
     lead   … 操作している主人公の職業 / guest … 同行している支援の職業。どちらかが違えば出さない(テストモードの自由な組み合わせ、合流前)
     when   … 物語の進み具合の条件の名前(legacy の walkTalkWhen が意味を持つ)。省略 = いつでも
     lines  … [[話す人の職業, 台詞], …]。2〜3 行、一行は名前を含めて全角 20 字前後(W-8)
     retryLines … 同じ出撃先へもう一度出た時(全滅・撤退の後。保存はせず、その遊んでいる間だけ数える)の台詞

   ■ 守ること(docs/CHAPTER1_STORY.md・各シナリオの決定)
     その場所の会話が明かすことを先に言わない。怪異の正体・人の行方・伏線の答えに触れない。
     宵待ちの村の奥(z 462〜)は「会話にしない」場所なので置かない。幽霊船の往路では「船が動く・帰れない」を匂わせない。
     時計塔の七時十三分・盗賊の過去・管理人の声には触れない。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

const freezeTopic = t => Object.freeze(Object.assign({}, t, {
  rect: Object.freeze(Object.assign({}, t.rect)),
  lines: Object.freeze(t.lines.map(l => Object.freeze(l.slice()))),
  retryLines: t.retryLines ? Object.freeze(t.retryLines.map(l => Object.freeze(l.slice()))) : undefined,
}));

/* 積み重ねた階の帯(既存の時計塔の出来事と同じ [-0.6, 6]) */
const floor = (rect, y) => Object.assign({}, rect, {y0: y - 0.6, y1: y + 6});

export const WALK_TALK_CH1 = Object.freeze({
  /* ② 宵待ちの村: 魔法使い(主人公)＋剣士(木橋で合流)。魔法使いは丁寧に推し量り、剣士は短く言い切る */
  duskvillage: Object.freeze([
    {id: 'D-1', lead: 'mage', guest: 'warrior', when: 'duskEntered',
      rect: {x0: -20, x1: 20, z0: 333, z1: 344},   // 中央広場の南(入口の会話の後。戦いは広場の北西)
      lines: [['mage', '「……どの家にも、灯りがついていますね」'], ['warrior', '「灯りだけだ。人の声がしない」']],
      retryLines: [['mage', '「……さっきと、同じ灯りです」'], ['warrior', '「なら、さっきより速く歩ける」']]},
    {id: 'D-2', lead: 'mage', guest: 'warrior', when: 'duskBeforeFish',
      rect: {x0: -34, x1: -26, z0: 344.5, z1: 351.5},   // 魚屋への小道(魚屋の記憶の手前)
      lines: [['warrior', '「……魚の匂いがしないな」'], ['mage', '「網も、乾ききっています」']]},
    {id: 'D-3', lead: 'mage', guest: 'warrior', when: 'duskBeforeBoat',
      rect: {x0: -32, x1: -28, z0: 323, z1: 343},   // 船着き場への小道(船小屋の記憶の手前)
      lines: [['mage', '「水の音が、近くなりました」'], ['warrior', '「板が浮いてる。足元を見ろ」']]},
    {id: 'D-4', lead: 'mage', guest: 'warrior', when: 'duskAfterChild',
      rect: {x0: 38.5, x1: 51.5, z0: 362, z1: 380},   // 裏通り(住宅の記憶の後)
      lines: [['warrior', '「狭い通りだな」'], ['mage', '「……子どもが走るには、ちょうどいい幅です」'], ['warrior', '「……そうか」']]},
    {id: 'D-5', lead: 'mage', guest: 'warrior', when: 'duskAfterInsight',
      rect: {x0: -45, x1: -31, z0: 413, z1: 427},   // 見張り小屋(行き止まり。観測の灯の後)
      lines: [['mage', '「……ここだけ、灯りがありません」'], ['warrior', '「見張りは、暗いほうが遠くまで見える」']]},
    {id: 'D-6', lead: 'mage', guest: 'warrior', when: 'duskGateOpening',
      rect: {x0: -11, x1: 11, z0: 440, z1: 447.5},   // 水門の手前(水門守の後、門が開くのを待つ間。村の奥より前)
      lines: [['mage', '「……水の匂いが、変わりました」'], ['warrior', '「ここから先は、離れるな」'], ['mage', '「はい」']]},
  ].map(freezeTopic)),

  /* ③ 幽霊船: 弓師(主人公)＋魔法使い。どちらも丁寧で短い。弓師は変化に先に気づき、魔法使いは決めつけない */
  ghostship: Object.freeze([
    {id: 'G-1', lead: 'archer', guest: 'mage', when: 'gsOutbound',
      rect: {x0: -26.6, x1: -20.4, z0: 74.6, z1: 83.4},   // 航海士の私室(往路。通路の脇)
      lines: [['archer', '「……海図が、広げたままです」'], ['mage', '「港に、印がついていますね」'], ['archer', '「帰るつもりだったんでしょう」']],
      retryLines: [['archer', '「……さっきと、同じ海図です」'], ['mage', '「印も、同じ港のままです」']]},
    {id: 'G-2', lead: 'archer', guest: 'mage', when: 'gsHoldCleared',
      rect: {x0: -37.6, x1: -20.4, z0: 128, z1: 134.4},   // 船倉の北(往路。戦いの後、梯子の手前)
      lines: [['mage', '「……樽に、日付が書いてあります」'], ['archer', '「ずいぶん、前の日付ですね」']]},
    {id: 'G-3', lead: 'archer', guest: 'mage', when: 'gsReturnBlocked',
      rect: {x0: -8.6, x1: -5.4, z0: 75, z1: 83},   // 帰還不能の後の通路
      lines: [['archer', '「……床が、少し傾いています」'], ['mage', '「波は、静かなのに」']]},
    {id: 'G-4', lead: 'archer', guest: 'mage', when: 'gsDeepHoldCleared',
      rect: {x0: -15.6, x1: 1.6, z0: 136.4, z1: 149.6},   // 深部の船員室(船倉の戦いの後)
      lines: [['archer', '「……さっきより、狭く感じます」'], ['mage', '「同じ部屋の、はずなのに」']]},
    {id: 'G-5', lead: 'archer', guest: 'mage', when: 'gsReturnBlocked',
      rect: {x0: 2.4, x1: 8.6, z0: 138.4, z1: 147.6},   // 深部の航海士の私室(脇の部屋)
      lines: [['archer', '「……この部屋にも、海図が」'], ['mage', '「印だけが、少しずれています」']]},
    {id: 'G-6', lead: 'archer', guest: 'mage', when: 'gsReleased',
      rect: {x0: -37, x1: -21, z0: 85, z1: 95},   // 錨が落ちた後の船長室(甲板へ向かう前)
      lines: [['archer', '「……揺れが、止まりました」'], ['mage', '「帰りましょう。今度は、外へ」'], ['archer', '「はい」']]},
  ].map(freezeTopic)),

  /* ④ 狂いの時計塔: 盗賊(主人公)＋弓師。盗賊はくだけて短く、弓師は丁寧で短い */
  clocktower: Object.freeze([
    {id: 'T-1', lead: 'rogue', guest: 'archer',
      rect: floor({x0: -269, x1: -255, z0: 59, z1: 71}, 0),   // 前庭(着いてすぐ。1 層の鐘の出来事の手前)
      lines: [['rogue', '「正面から入るのは、性に合わないんだがな」'], ['archer', '「窓は、全部閉まっています」'], ['rogue', '「……今日は、扉からだ」']],
      retryLines: [['rogue', '「また、正面からか」'], ['archer', '「はい。……今度は、上まで」']]},
    {id: 'T-2', lead: 'rogue', guest: 'archer', when: 'towerStopped',
      rect: Object.assign({}, {x0: -280, x1: -276, z0: 44, z1: 55}, {y0: -0.6, y1: 5}),   // 1 層の西の坂の下(鐘が鳴り時が止まった後)
      lines: [['archer', '「……さっきの人、瞬きもしていませんでした」'], ['rogue', '「見るな。見ても、止まったままだ」']]},
    {id: 'T-3', lead: 'rogue', guest: 'archer', when: 'towerBridged',
      rect: floor({x0: -255, x1: -246, z0: 36, z1: 52}, 8),   // 2 層の部品庫(橋が架かった後)
      lines: [['archer', '「……部品が、全部磨いてあります」'], ['rogue', '「使う気だったんだろ。いつかな」']]},
    {id: 'T-4', lead: 'rogue', guest: 'archer', when: 'towerRung',
      rect: floor({x0: -255.5, x1: -244.5, z0: 28, z1: 33.5}, 44),   // 6 層の前室(鐘を鳴らして昇降台で上がった後。崩壊の前)
      lines: [['rogue', '「……針の音が、うるさいな」'], ['archer', '「大時計の、裏側ですから」'], ['rogue', '「表から見るほうが、よっぽどいい」']]},
  ].map(freezeTopic)),
});

/* 掛け合いのあるシナリオ(ワールドの鍵) */
export const WALK_TALK_CH1_WORLDS = Object.freeze(Object.keys(WALK_TALK_CH1));
