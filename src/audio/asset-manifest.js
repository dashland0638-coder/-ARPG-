// Single place to register real audio files. Every entry is optional -
// leave a value null/absent and that cue keeps using what it already has
// (WebAudio synthesis for SFX, procedural-bgm.js for BGM). A missing or
// failing file falls back the same way, so it's always safe to add an entry
// before the file actually exists at that path.
//
// Where to put the files: public/audio/bgm/ and public/audio/sfx/ - Vite
// copies public/ verbatim, so a file at public/audio/bgm/tavern.mp3 is
// served at /audio/bgm/tavern.mp3. Write every entry below as that
// site-root-relative path, starting with '/' - audio.js's
// resolveAssetUrl() prepends GitHub Pages' /<repo>/ base itself before
// fetching, the same way the manifest.webmanifest icons/start_url do.
// Getting this wrong is a silent 404 in production only (dev serves from
// '/', so it looks fine locally) - see ARCHITECTURE.md.

// world/scenario key (matches buildWorld()'s `key` and SCENARIO_DEFS) -> track URL
export const BGM_TRACKS = {
  // 酒場 BGM(作曲アプリ v5.70.0・完成版・サンプル音源。MUSIC-BGM-TAVERN-001)。
  // 書き出し: tools/music-composer/scripts/render-bgm.mjs、元データとループ点: tools/music-composer/exports/tavern.json
  tavern: '/audio/bgm/tavern.mp3',
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
                          and after, so an MP3 encoder delay that a decoder
                          leaves in shifts both points together and the seam
                          stays seamless. Copy them from the export's .json.
     gain                 playback trim (linear, applied under the BGM volume
                          setting). The export is peak-normalised for MP3
                          quality; this sets how loud it sits in the game. */
export const BGM_TRACK_OPTIONS = {
  // tools/music-composer/exports/tavern.json の loop.start / loop.end。
  // gain 0.5(-6 dB): 書き出しは -14 LUFS。音量「中」(0.4)で約 -28 LUFS
  tavern: { loopStart: 1, loopEnd: 48.766984, gain: 0.5 },
};

// sfx() cue name (matches the keys of the SFX table in audio.js) -> file URL.
// Only cues you actually want to override need an entry here.
export const SFX_FILES = {
  // hit: '/audio/sfx/hit.mp3',
};
