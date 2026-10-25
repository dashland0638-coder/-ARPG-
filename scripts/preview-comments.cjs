/* PR に「🔍 テスト版を開く」のコメントを 1 つだけ置いて書き換える(DEV-PREVIEW-001。deploy.yml の comment ジョブ)。

   公開の実行は、待っている間に新しい実行に置き換わることがある(concurrency)。置き換わった実行のきっかけの PR にも
   コメントが届くように、きっかけの PR だけでなく、公開したすべての PR のコメントをその時の状態に合わせる。
   状態(commit・状態・公開の確認)が前のコメントと同じなら書き換えない(通知を増やさない)。
   URL は公開した page_url から作り、公開された preview.json の commit が一致するかを確かめてから「開けます」と書く。 */
'use strict';

const MARKER = '<!-- dev-preview -->';
const stateTag = s => `<!-- dev-preview-state ${s} -->`;
const sleepMs = ms => new Promise(r => setTimeout(r, ms));

function bodyFor({entry, pr, pageUrl, deployed, live, runUrl}){
  if(deployed && entry && entry.status === 'ok'){
    const url = `${pageUrl}pr/${pr}/`;
    const state = `${entry.sha}:ok:${live ? 'live' : 'unverified'}`;
    return {state, body: [MARKER, stateTag(state), '### 🔍 テスト版を開く(この PR のプレビュー)',
      `- 通常プレイ: ${url}`,
      `- テストモード: ${url}?dev=1`,
      `- 対象コミット: \`${entry.sha}\`(画面の上端の帯にも 7 桁で出ます)`,
      `- 公開の確認: ${live ? '✅ 公開されたプレビューの commit が一致しました' : '⚠️ まだ反映を確かめられていません。数分後に開き、上端の帯の 7 桁を確かめてください'}`,
      `- 実行結果: ${runUrl}`,
      '', 'main の公開版とは別物です。プレビューのセーブ・設定は公開版と分けてあります。'].join('\n')};
  }
  const why = !deployed ? '公開に失敗しました(実行結果を見てください)'
    : !entry ? 'この PR のプレビューは載っていません(上限を超えたか、PR の一覧を取れませんでした)'
    : entry.reason || entry.status;
  const state = `${entry ? entry.sha : 'unknown'}:${deployed ? (entry ? entry.status : 'missing') : 'deploy-failed'}`;
  return {state, body: [MARKER, stateTag(state), '### ⚠️ この PR のプレビューはまだ使えません',
    `- 対象コミット: \`${entry ? entry.sha : '(不明)'}\``,
    `- 状態: ${why}`,
    `- 実行結果: ${runUrl}`].join('\n')};
}

/* 公開された preview.json の commit を、まとめて 1 つの持ち時間の中で確かめる */
async function checkLive({entries, pageUrl, fetchFn, budgetMs, intervalMs, sleep}){
  const live = new Set();
  const deadline = Date.now() + budgetMs;
  for(;;){
    for(const e of entries){
      if(live.has(e.pr)) continue;
      try{
        const r = await fetchFn(`${pageUrl}pr/${e.pr}/preview.json?t=${Date.now()}`, {cache: 'no-store'});
        if(r.ok){ const j = await r.json(); if(j.sha === e.sha) live.add(e.pr); }
      } catch(err){ /* まだ反映されていない */ }
    }
    if(live.size === entries.length || Date.now() + intervalMs > deadline) return live;
    await sleep(intervalMs);
  }
}

async function findComment({github, owner, repo, pr}){
  const comments = await github.paginate(github.rest.issues.listComments, {owner, repo, issue_number: pr, per_page: 100});
  return comments.find(c => c.user && c.user.type === 'Bot' && c.body && c.body.startsWith(MARKER)) || null;
}

async function upsert({github, owner, repo, pr, old, body}){
  if(old) await github.rest.issues.updateComment({owner, repo, comment_id: old.id, body});
  else await github.rest.issues.createComment({owner, repo, issue_number: pr, body});
}

/* 返り値: 書き換えた PR の番号の一覧 */
async function updatePreviewComments({github, owner, repo, summary, triggerPr, closed, deployed, pageUrl, runUrl,
  fetchFn = fetch, budgetMs = 90000, intervalMs = 10000, sleep = sleepMs, log = console}){
  const trig = Number(triggerPr) > 0 ? Number(triggerPr) : null;
  const base = String(pageUrl || '').replace(/\/?$/, '/');
  const written = [];
  if(closed){
    if(!trig) return written;
    const old = await findComment({github, owner, repo, pr: trig});
    if(!old) return written;
    await upsert({github, owner, repo, pr: trig, old, body: [MARKER, stateTag('closed'), '### 🔍 テスト版(この PR のプレビュー)', '',
      'PR を閉じたので、プレビューは公開サイトから外しました。', `- 実行結果: ${runUrl}`].join('\n')});
    return [trig];
  }
  const list = Array.isArray(summary) ? summary.filter(e => Number.isInteger(e.pr) && e.pr > 0) : [];
  const live = deployed ? await checkLive({entries: list.filter(e => e.status === 'ok'), pageUrl: base, fetchFn, budgetMs, intervalMs, sleep})
                        : new Set();
  const targets = list.map(e => e.pr);
  if(trig && !targets.includes(trig)) targets.push(trig);
  for(const pr of targets){
    const entry = list.find(e => e.pr === pr) || null;
    try{
      const {state, body} = bodyFor({entry, pr, pageUrl: base, deployed, live: live.has(pr), runUrl});
      const old = await findComment({github, owner, repo, pr});
      if(old && old.body.includes(stateTag(state))) continue;               // 同じ状態なら書き換えない
      if(!old && pr !== trig && entry && entry.status === 'none') continue; // 仕組みの無いブランチには新しく書かない
      await upsert({github, owner, repo, pr, old, body});
      written.push(pr);
    } catch(e){
      log.warning(`PR #${pr}: コメントを書けませんでした: ${e.message}`);
    }
  }
  return written;
}

module.exports = {updatePreviewComments, bodyFor, MARKER};
