// Single place to register real texture images that should replace a
// procedurally generated surface. Every entry is optional - leave a value
// null/absent and that surface keeps drawing itself on canvas exactly as
// before. A missing or failing image falls back the same way (the
// procedural version stays on screen), so it's always safe to add an
// entry before the file actually exists.
//
// Where to put the files: public/textures/overrides/ - Vite copies
// public/ verbatim, so a file at public/textures/overrides/ship-deck.jpg
// is served at /textures/overrides/ship-deck.jpg. Write every entry below
// as that site-root-relative path, starting with '/' - textures.js's
// resolveAssetUrl() prepends GitHub Pages' /<repo>/ base itself before
// fetching, the same way audio/asset-manifest.js does.
//
// Only the "structured" surface generators (plank/masonry/cobble/
// wallpaper/stone-tile - see textures.js) can be overridden this way; a
// call site opts in by adding a `name` to its opts object, e.g.
// makePlankTexture('#4a3c2c', 7, 4, 8, { name: 'ship_deck' }). An image
// registered here swaps in once it loads (async - the procedural surface
// is what's on screen until then, so there's no flash of missing
// texture). For best results the image should be a seamless-tileable
// square, since it replaces a 128x128 repeating canvas texture 1:1.
export const TEXTURE_OVERRIDES = {
  // ship_deck: '/textures/overrides/ship-deck.jpg',
};
