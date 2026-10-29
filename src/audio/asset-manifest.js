// Single place to register real audio files. Every entry is optional -
// leave a value null/absent and that cue keeps using what it already has
// (WebAudio synthesis for SFX, procedural-bgm.js for BGM). A missing or
// failing file falls back the same way, so it's always safe to add an entry
// before the file actually exists at that path.
//
// Where to put the files: public/audio/bgm/ and public/audio/sfx/ - Vite
// copies public/ verbatim, so a file at public/audio/bgm/tavern-6-complete.mp3 is
// served at /audio/bgm/tavern-6-complete.mp3. Write every entry below as that
// site-root-relative path, starting with '/' - audio.js's
// resolveAssetUrl() prepends GitHub Pages' /<repo>/ base itself before
// fetching, the same way the manifest.webmanifest icons/start_url do.
// Getting this wrong is a silent 404 in production only (dev serves from
// '/', so it looks fine locally) - see ARCHITECTURE.md.

// world/scenario key (matches buildWorld()'s `key` and SCENARIO_DEFS) -> track URL
export const BGM_TRACKS = {
  // 酒場 BGM(作曲アプリ v5.70.0・サンプル音源。MUSIC-BGM-TAVERN-001/002)。既定は完成版。
  // 第一章の間は BGM_VARIANTS.tavern の加入段階の版を鳴らす(core/tavern-bgm.js が段階を決める)。
  // 書き出し: tools/music-composer/scripts/render-bgm.mjs、元データとループ点: tools/music-composer/exports/tavern-stages.json
  tavern: '/audio/bgm/tavern-6-complete.mp3',
  mansion: null,
  clocktower: null,
  conservatory: null,
  temple: null,
  ghostship: null,
  waterway: null,
};

/* Per-track playback options (optional; a track without an entry loops the
   whole file). A registered track is decoded and looped on the WebAudio graph
   (audio.js), so the loop can skip the file's lead-in/tail exactly:
     loopStart / loopEnd  seconds within the file. render-bgm.mjs writes one
                          period of the loop plus 1 s of the same music before
                          and after. audio.js copies exactly one period out of
                          the decoded file into its own buffer (blending the
                          first 30 ms with the music that follows loopEnd, so
                          the wrap-around is continuous) and loops that whole
                          buffer - no loopStart/loopEnd on the node. An MP3
                          encoder delay a decoder leaves in only shifts which
                          period is copied. Copy them from the export's .json.
                          Every variant of a track shares the same loop points.
     gain                 playback trim (linear, applied under the BGM volume
                          setting). The export is peak-normalised for MP3
                          quality; this sets how loud it sits in the game. */
export const BGM_TRACK_OPTIONS = {
  // tools/music-composer/exports/tavern-stages.json の loop.start / loop.end(6 段階で共通)。
  // gain 0.5(-6 dB): 完成版の書き出しは -14 LUFS。音量「中」(0.4)で約 -28 LUFS。全段階に同じ倍率なので、
  // 楽器が増えるほど大きくなるアプリの聞こえ方はそのまま
  tavern: { loopStart: 1, loopEnd: 48.766667, gain: 0.5 },
};

/* Alternative versions of one world's track (optional). playBgm(key, variant)
   / setBgmVariant(key, variant) pick one; switching variants while the world
   is playing crossfades at the same position in the loop (the variants are
   the same piece with different instruments, sharing tempo and loop points).
   An unknown/missing variant plays BGM_TRACKS[key]. */
export const BGM_VARIANTS = {
  // 酒場 BGM の加入段階(作曲アプリの TAVERN_STAGE_POLICY と同じ名前・同じ順)
  tavern: {
    swordsman: '/audio/bgm/tavern-1-swordsman.mp3',
    mage:      '/audio/bgm/tavern-2-mage.mp3',
    archer:    '/audio/bgm/tavern-3-archer.mp3',
    thief:     '/audio/bgm/tavern-4-thief.mp3',
    shadow:    '/audio/bgm/tavern-5-shadow.mp3',
    complete:  '/audio/bgm/tavern-6-complete.mp3',
  },
};

// sfx() cue name (matches the keys of the SFX table in audio.js) -> file URL.
// Only cues you actually want to override need an entry here.
export const SFX_FILES = {
  // hit: '/audio/sfx/hit.mp3',
};
