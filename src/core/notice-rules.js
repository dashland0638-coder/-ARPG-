/* 通知の分類・表示先・優先度・寿命(UI-VISUAL-001)。

   画面中央はプレイヤー・敵・攻撃の予兆を見るための場所として空けておく。通知は種類ごとに一つの表示先へ出す
   (UI-002-D の HD-D17「同じ情報を二か所へ出さない」はそのまま)。
     top    … 上の帯(左上のパネルとミニマップの間。ボスバー・制限時間の下)。危険・物語・出現・節目
     actor  … プレイヤーの頭の上に小さく(自分の行動の結果。技・パリィ・ジャストドッジ)
     bottom … 操作ボタンのそばに小さく(入力を受け付けなかった理由。操作した指のそば。下の中央はプレイヤーの体に重なる)
   左下(背の低い画面では左の中ほど)のログ(spawnLog)は今までどおり別の口。

   優先度(小さいほど強い): 1 危険 / 2 戦闘・物語の進行 / 3 敵の出現・状況の変化 / 4 行動の結果・入力の理由 / 5 システム
   上の帯は同時に 3 件まで。満ちている時に来た通知は、より弱い通知を押し出して出る。押し出せない時は短い待ち行列に並ぶ
   (古くなったものは捨てる)。同じ文言が出ている間に同じ通知が来たら、新しく積まずに「×n」へまとめて寿命を延ばす。

   spawnToast(text, color, kind) の kind を省くと、文言から classifyNotice() が決める(既存の 100 以上の呼び出しを
   書き換えずに分類できるように。分類の表は tests/unit/notice-rules.test.js が全部の文言で確かめる) */

export const NOTICE_KINDS = {
  danger:   { priority: 1, zone: 'top',    lifeMs: 2400, history: true  },   // ボスの攻撃予告・危険な攻撃・拘束(痺れ・掴まれ)
  story:    { priority: 2, zone: 'top',    lifeMs: 2600, history: true  },   // 目標・敵の台詞・戦闘を進めるための指示
  alert:    { priority: 3, zone: 'top',    lifeMs: 1900, history: true  },   // 敵の出現・発見・状況の変化・時間制限
  feedback: { priority: 4, zone: 'actor',  lifeMs: 1100, history: false },   // 自分の行動の結果(一時的な演出)
  deny:     { priority: 4, zone: 'bottom', lifeMs: 1700, history: false },   // 入力を受け付けなかった理由
  system:   { priority: 5, zone: 'top',    lifeMs: 2200, history: true  },   // 習得・加入・初制覇・機能の解放・切り替え
};

export const NOTICE_TOP_MAX = 3;          // 上の帯に同時に出す数
export const NOTICE_QUEUE_MAX = 4;        // 待ち行列の長さ
export const NOTICE_QUEUE_STALE_MS = 3000;  // 待ち行列でこれより古くなったものは出さない(もう遅い)
export const NOTICE_REPEAT_MS = 4000;     // 消えてからこの時間内に同じ「繰り返す気配」の通知が来たら、出さない(noticeRepeatSuppressed)
export const NOTICE_HISTORY_MAX = 40;     // メニューの「記録」に残す数(上の帯の物)
export const NOTICE_LOG_HISTORY_MAX = 20; // メニューの「記録」に残すログの数(獲得の記録が上の帯の物を押し出さないよう別に数える)

// 分類の規則(上から順に最初に合ったもの)。文言の意味で分ける
const RULES = [
  // 入力を受け付けなかった理由(操作の直後に、指のそばで)
  ['deny', /足りない|持っていない|満タン|使えない|扱えない|装着されていない|売却できる装備がない|鑑定できる装備がない|鑑定できなかった|同時に\d+つまで|施錠|開かない|選べない|先に顔を見せて|^🔒/],
  // 危険(いま避ける・抜ける判断が要る)
  ['danger', /^⚠|闘気を纏った|最後の力を振り絞った|痺れて|掴まれ|挟まれ|咬みつかれ|のしかかり|衝撃波|水を吐|胞子を吐|飛んできた|針を投げ|足元の時が|時を巻き戻し|制限時間切れ|残り10秒/],
  // 自分の行動の結果(一時的な演出)
  ['feedback', /成功|ジャストドッジ|一閃!|斉射!|甲羅ダイブ|地烈の一撃|刻の一撃|癒しの開花|未来を射抜いた|身代わりになった|を潰した|灯りを掲げた/],
  // 物語・目標・敵の台詞
  ['story', /^🧭|^「|^🗝️|^❗|足場が不気味に軋|主の上に落ちる|燭台が、鎖を軋ませ|急げ/],
  // 敵の出現・状況の変化・時間制限
  ['alert', /立ちはだかる|起き上が|立ち上がった|気配|ミミック|第\d+戦|増えた|呼び寄せ|号笛|揺れた|近づいてくる|構えを変え|身を固め|逆回転|七時|文字盤の針|石扉が背後で|落下した|足を踏み外|残り1分|⚡ .+が.+!$/],
  // システム(節目・解放・切り替え)
  ['system', /習得|加わった|同行するように|初制覇|転身|閃いた|開いた|デバッグモード|Freeze|必殺技/],
];

/* 同じ敵が何度も繰り返す気配・状況の変化(瞬間移動・分身・号笛など)。消えた直後に同じ物が来ても出さない。
   落下・時間制限などの、毎回知らせるべき物は含めない */
const REPEATING = /気配|揺れた|増えた|呼び寄せ|号笛|構えを変え/;
export function noticeRepeatSuppressed(text) { return REPEATING.test(String(text || '')); }

export function classifyNotice(text) {
  const s = String(text || '');
  for (const [kind, re] of RULES) if (re.test(s)) return kind;
  return 'alert';
}

export function noticeSpec(kind) {
  return NOTICE_KINDS[kind] || NOTICE_KINDS.alert;
}

/* 上の帯に新しい通知を入れられるか。visible は今出ている上の帯の通知([{priority, born}])。
   返り値: { action: 'show' } / { action: 'replace', index } (押し出す相手) / { action: 'queue' } */
export function noticeAdmit(visible, priority, max = NOTICE_TOP_MAX) {
  if (visible.length < max) return { action: 'show' };
  let worst = -1;
  visible.forEach((v, i) => {
    if (v.priority <= priority) return;   // 同じか強い通知は押し出さない
    if (worst < 0 || v.priority > visible[worst].priority || (v.priority === visible[worst].priority && v.born < visible[worst].born)) worst = i;
  });
  return worst >= 0 ? { action: 'replace', index: worst } : { action: 'queue' };
}

/* 上の帯の並び: 強い通知ほど上、同じ強さなら新しいほど上 */
export function noticeOrder(a, b) {
  return a.priority - b.priority || b.born - a.born;
}
