/* 開いている PR のプレビューの成果物を集める(DEV-PREVIEW-001。deploy.yml の assemble ジョブから github-script で呼ぶ)。

   プレビューは PR 側のワークフロー(.github/workflows/preview.yml、pull_request・読むだけの権限)が組み、成果物
   preview-pr-<N> として残す。公開側(deploy.yml)は PR のコードを一切動かさず、ここで成果物を「データとして」取ってくる:
     - PR の一覧・番号・最新 commit は GitHub の API の値だけを使う(同じリポジトリの PR だけ。fork は組まない)
     - PR の最新 commit(head.sha)で走った preview.yml の実行だけを見る。古い commit のプレビューは使わない
       (古いプレビューを最新と取り違えない)
     - その実行が同じリポジトリから・pull_request で走り、その PR のものであること、成果物の名前・commit・大きさを確かめる
   成果物の zip は <outDir>/pr-<N>.zip に置く。中身の展開と検査は scripts/assemble-pages.mjs が行う。

   状態(status):
     ok        成果物がある(この時点ではまだ検査前)
     building  最新 commit のプレビューを組んでいる最中(終わると deploy.yml がもう一度動く)
     failed    組むのに失敗した・成果物が無い・期限切れ・おかしい(reason に理由)
     none      最新 commit で preview.yml が走っていない(この仕組みより前に作ったブランチ。main を取り込むと作られる) */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const MAX_PREVIEWS = 20;                       // 1 回の公開で載せる PR の上限(新しい順。きっかけの PR は必ず入れる)
const MAX_ARTIFACT_BYTES = 200 * 1024 * 1024;  // 成果物の大きさの上限
const WORKFLOW = 'preview.yml';
const SHA40 = /^[0-9a-f]{40}$/;

function selectPrs(prs, triggerPr, max = MAX_PREVIEWS){
  const ok = (prs || []).filter(p => Number.isInteger(p.number) && p.number > 0 && SHA40.test(String(p.sha)));
  ok.sort((a, b) => b.number - a.number);
  const picked = ok.slice(0, max);
  const trig = ok.find(p => p.number === triggerPr);
  if(trig && !picked.includes(trig)) picked[picked.length - 1] = trig;
  return picked;
}

async function previewFor({github, owner, repo, pr, outDir}){
  const full = `${owner}/${repo}`;
  const base = {number: pr.number, sha: pr.sha, title: pr.title};
  const {data} = await github.rest.actions.listWorkflowRuns({owner, repo, workflow_id: WORKFLOW, head_sha: pr.sha, event: 'pull_request', per_page: 20});
  const runs = (data.workflow_runs || []).filter(r =>
    r.head_sha === pr.sha && r.event === 'pull_request' && r.head_repository && r.head_repository.full_name === full &&
    (!r.pull_requests || r.pull_requests.length === 0 || r.pull_requests.some(q => q.number === pr.number)));
  if(runs.length === 0) return {...base, status: 'none', reason: 'この commit ではプレビューのワークフローが走っていません(main を取り込むと作られます)'};
  runs.sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt);
  const run = runs[0];
  const at = {...base, runId: run.id, runUrl: run.html_url};
  if(run.status !== 'completed') return {...at, status: 'building', reason: 'プレビューを組んでいる最中です'};
  if(run.conclusion !== 'success') return {...at, status: 'failed', reason: `プレビューのビルドが ${run.conclusion} で終わりました`};
  const arts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {owner, repo, run_id: run.id, per_page: 100});
  const art = arts.find(a => a.name === `preview-pr-${pr.number}`);
  if(!art) return {...at, status: 'failed', reason: '成果物がありません'};
  if(art.expired) return {...at, status: 'failed', reason: '成果物の期限が切れました(Actions で PR Preview を再実行するか、新しい commit を push してください)'};
  if(art.workflow_run && art.workflow_run.head_sha && art.workflow_run.head_sha !== pr.sha) return {...at, status: 'failed', reason: '成果物の commit が PR の最新 commit と違います'};
  if(!(art.size_in_bytes > 0) || art.size_in_bytes > MAX_ARTIFACT_BYTES) return {...at, status: 'failed', reason: `成果物の大きさがおかしい (${art.size_in_bytes})`};
  const res = await github.rest.actions.downloadArtifact({owner, repo, artifact_id: art.id, archive_format: 'zip'});
  const buf = Buffer.from(res.data);
  if(buf.length > MAX_ARTIFACT_BYTES) return {...at, status: 'failed', reason: '成果物が大きすぎます'};
  fs.writeFileSync(path.join(outDir, `pr-${pr.number}.zip`), buf);
  return {...at, status: 'ok', artifactId: art.id};
}

/* 返り値: {triggerPr, previews: [{number, sha, title, status, reason?, runId?, runUrl?}]} */
async function collectPreviews({github, owner, repo, outDir, triggerPr = null, triggerSha = null, log = console}){
  const full = `${owner}/${repo}`;
  fs.mkdirSync(outDir, {recursive: true});
  const open = await github.paginate(github.rest.pulls.list, {owner, repo, state: 'open', per_page: 100});
  const same = open.filter(p => p.head && p.head.repo && p.head.repo.full_name === full);
  const forks = open.filter(p => !same.includes(p)).map(p => `#${p.number}`);
  log.info(`fork PRs (no preview): ${forks.join(', ') || 'none'}`);
  const prs = same.map(p => ({number: p.number, sha: String(p.head.sha).toLowerCase(), title: String(p.title || '')}));
  let trig = Number.isInteger(Number(triggerPr)) && Number(triggerPr) > 0 ? Number(triggerPr) : null;
  if(!trig && triggerSha){
    const hit = prs.find(p => p.sha === String(triggerSha).toLowerCase());
    if(hit) trig = hit.number;
  }
  const previews = [];
  for(const pr of selectPrs(prs, trig)){
    try{
      previews.push(await previewFor({github, owner, repo, pr, outDir}));
    } catch(e){
      log.warning(`PR #${pr.number}: プレビューを取れませんでした: ${e.message}`);
      previews.push({number: pr.number, sha: pr.sha, title: pr.title, status: 'failed', reason: `成果物を取れませんでした: ${e.message}`});
    }
  }
  return {triggerPr: trig, previews};
}

module.exports = {collectPreviews, selectPrs, MAX_PREVIEWS, MAX_ARTIFACT_BYTES, WORKFLOW};
