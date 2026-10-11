// MUSIC-AUDIO-001: 試作 HTML を作る。基準の HTML は書き換えず、末尾に読み込みを足すだけ。
//
//   node tools/music-composer/scripts/build-prototype.mjs               → 試作 HTML(samples/ を相対パスで読む)
//   node tools/music-composer/scripts/build-prototype.mjs --standalone  → dist/ に1ファイル版
//                                                                        (スクリプトと音源を埋め込む。file:// やファイルアプリから開く用)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASE = 'ARPG_Music_AI_Composer_v5_67_0.html';
export const PROTO = 'ARPG_Music_AI_Composer_v5_67_0_samples.html';
export const MARK = '<!-- MUSIC-AUDIO-001: sample engine (appended; everything above is the unmodified base) -->';
const SCRIPTS = ['samples/manifest.js', 'sample-engine.js', 'sample-hooks.js'];

export function appendBlock(baseHtml, tags){
  return `${baseHtml}${baseHtml.endsWith('\n') ? '' : '\n'}${MARK}\n${tags.join('\n')}\n`;
}

function build(standalone){
  const base = fs.readFileSync(path.join(dir, BASE), 'utf8');
  if(!standalone){
    const html = appendBlock(base, SCRIPTS.map(s=>`<script src="${s}"></script>`));
    fs.writeFileSync(path.join(dir, PROTO), html);
    return path.join(dir, PROTO);
  }
  const read = f=>fs.readFileSync(path.join(dir, f), 'utf8');
  const manifestSrc = read('samples/manifest.js');
  const manifest = new Function('window', `${manifestSrc}; return window.SAMPLE_MANIFEST;`)({});
  const data = {};
  for(const inst of Object.values(manifest)) for(const z of inst.zones){
    data[z.file] = 'data:audio/mpeg;base64,' + fs.readFileSync(path.join(dir, 'samples', z.file)).toString('base64');
  }
  const inline = s=>`<script>\n${s.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  const html = appendBlock(base, [
    inline(manifestSrc),
    inline(`window.SAMPLE_DATA = ${JSON.stringify(data)};`),
    inline(read('sample-engine.js')),
    inline(read('sample-hooks.js')),
  ]);
  fs.mkdirSync(path.join(dir, 'dist'), { recursive:true });
  const out = path.join(dir, 'dist', PROTO.replace('.html', '_standalone.html'));
  fs.writeFileSync(out, html);
  return out;
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const out = build(process.argv.includes('--standalone'));
  console.log(`${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
