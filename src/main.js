// Entry point for the Vite build. 'virtual:legacy-core' is the concatenated
// src/legacy/parts/*.js (see src/legacy/concat-plugin.js) - it runs its own
// boot sequence as soon as it's evaluated (same as the old inline <script>
// did), so this import is the whole wiring for now. As pieces get split out
// of it into real modules (audio, textures, ... already done) they get
// imported from here too.
// PR のプレビューの帯(DEV-PREVIEW-001)。main の公開版では何もしない
import './preview-banner.js';
import 'virtual:legacy-core';
