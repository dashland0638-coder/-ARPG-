// Single place to register real audio files. Every entry is optional -
// leave a value null/absent and that cue keeps using what it already has
// (WebAudio synthesis for SFX, silence for BGM). A missing or failing file
// falls back the same way, so it's always safe to add an entry before the
// file actually exists at that path.
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
  tavern: null,
  mansion: null,
  clocktower: null,
  conservatory: null,
  temple: null,
  ghostship: null,
  waterway: null,
};

// sfx() cue name (matches the keys of the SFX table in audio.js) -> file URL.
// Only cues you actually want to override need an entry here.
export const SFX_FILES = {
  // hit: '/audio/sfx/hit.mp3',
};
