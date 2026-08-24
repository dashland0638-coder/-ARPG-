// Entry point for the Vite build. legacy-core.js runs its own boot sequence
// as soon as it's evaluated (same as the old inline <script> did) - this
// import is the whole wiring for now. As pieces get split out of it (audio,
// textures, ...) they get imported from here too.
import './legacy/legacy-core.js';
