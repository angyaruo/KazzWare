import displayFont from '../assets/fonts/BarlowCondensed-Black.ttf';

// A uniquely named, bundled face: no external font requests or host typography changes.
export const FONT_CSS = `@font-face{font-family:KazzDisplay;src:url("${displayFont}") format("truetype");font-weight:900;font-style:normal;font-display:swap}`;
