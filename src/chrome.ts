/** Notched instrument panels: clipped glass and a separate, unbroken edge. */
const edge = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80" preserveAspectRatio="none"><path d="M3 1H65L70 5H123L128 1H157L159 3V77L157 79H3L1 77V3Z" fill="none" stroke="white" stroke-width="1.15" vector-effect="non-scaling-stroke"/><path d="m7 69 5-5m-5 9 9-9m-5 9 5-5" fill="none" stroke="white" stroke-width="1" opacity=".45" vector-effect="non-scaling-stroke"/></svg>`)}")`;
const surfaces = ':is(.shard,.plug,.quick-settings,.close,.title,.status)';
const controls = ':is(.shard,.plug,.quick-settings,.close)';

export const CHROME_CSS = `
:host {
  --ink:#0b1015; --paper:#e7edf2; --glow:#ff2948;
  --panel-cut:polygon(1.875% 1.25%,40.625% 1.25%,43.75% 6.25%,76.875% 6.25%,80% 1.25%,98.125% 1.25%,99.375% 3.75%,99.375% 96.25%,98.125% 98.75%,1.875% 98.75%,.625% 96.25%,.625% 3.75%);
}

/* The outer element stays unclipped so its red halo and focus ring can escape.
   Decorative layers ignore input; labels and icons remain live controls. */
${surfaces} {
  position:relative; isolation:isolate; overflow:visible; border:0; border-radius:0;
  background:transparent; color:var(--paper); box-shadow:none;
  filter:drop-shadow(0 3px 4px #0009) drop-shadow(0 0 3px #ff173b24);
  transition:filter .18s ease,translate .15s ease;
}
${surfaces}::before,${surfaces}::after {
  content:''; position:absolute; inset:0; z-index:-1; border-radius:0; pointer-events:none;
}
${surfaces}::before {
  clip-path:var(--panel-cut);
  background-image:
    linear-gradient(112deg,transparent 40%,#d7ecff05 44%,#edfbff38 49%,#ffffff5c 50%,#d7ecff14 53%,transparent 59%),
    linear-gradient(128deg,#9cbedb17,transparent 32%,#0003 48%,#b4c7e00b 49%,transparent 65%),
    linear-gradient(165deg,#151e27f0,#080c12f2 70%,#111721f0);
  background-size:300% 100%,100% 100%,100% 100%;
  background-position:100% 0,0 0,0 0; background-repeat:no-repeat;
  backdrop-filter:blur(12px) saturate(.35); -webkit-backdrop-filter:blur(12px) saturate(.35);
}
${surfaces}::after {
  clip-path:none; background:#ff3657; opacity:.5;
  mask:${edge} center/100% 100% no-repeat; -webkit-mask:${edge} center/100% 100% no-repeat;
  transition:opacity .18s ease,background .18s ease;
}
${controls}:hover:enabled,${controls}:focus-visible {
  color:#f6faff; background:transparent; border:0; box-shadow:none;
  filter:drop-shadow(0 3px 4px #0009) drop-shadow(0 0 5px #ff173b65);
}
${controls}:hover:enabled::after,${controls}:focus-visible::after,.title:focus-visible::after { opacity:1; background:#ff546b }
${controls}:focus-visible,.title:focus-visible { outline:2px solid #ff8294; outline-offset:3px }
${controls}:focus-visible::before { animation:glass-gleam .68s ease-out }
@media (hover:hover) {
  ${controls}:hover:enabled::before { animation:glass-gleam .68s ease-out }
}
${controls}:active:enabled {
  translate:0 1px; background:transparent; color:white; box-shadow:none; animation:none;
  filter:drop-shadow(0 0 7px #ff173b99);
}
${controls}:active:enabled::before { animation:glass-press .38s ease-out }
${controls}:active:enabled::after { opacity:1; background:#ff9aa9 }
@keyframes glass-gleam {
  from { background-position:100% 0,0 0,0 0 }
  to { background-position:0% 0,0 0,0 0 }
}
@keyframes glass-press {
  from { background-position:72% 0,0 0,0 0 }
  to { background-position:0% 0,0 0,0 0 }
}

.top { gap:8px; padding:2px 6px 8px; min-height:82px; align-items:flex-start }
.title { width:236px; max-width:calc(100% - 104px); min-height:74px; padding:17px 12px 12px }
.brand-line { display:flex; align-items:center; gap:7px; padding:0; background:none; border:0; border-radius:0; box-shadow:none; white-space:nowrap }
.brand { font:900 27px/1 var(--display); letter-spacing:1px; color:#e7edf2; text-shadow:none }
.brand em { color:var(--glow); font:700 13px/1 var(--mono); margin-left:2px; letter-spacing:-1px }
.hazard { font:23px/1 system-ui; color:var(--glow) }
.system-clock { display:block; margin:9px 0 0; font:9px/1.2 var(--mono); color:#acb7c2; white-space:nowrap }
.chat-name { display:none }
.shell:not([data-screen=home]) .system-clock { display:none }
.shell:not([data-screen=home]) .chat-name { display:block; max-width:100%; margin-top:9px; padding:0; background:none; font:10px/1.2 var(--mono) }
.top .badge { display:none }
.icon,.quick-settings { width:44px; height:48px; min-height:44px; flex-shrink:0; padding:10px; color:#d9e0e8 }
.quick-settings svg { width:23px; height:23px }
.close { font-size:29px; line-height:1 }

/* Home is a fan around Kazz. Tool headers stay level for reading and forms. */
[data-screen=home] .top { padding:18px 10px 12px; min-height:96px }
[data-screen=home] .title { min-height:64px; padding:12px; transform:rotate(-7deg) }
[data-screen=home] .system-clock { margin-top:6px }
[data-screen=home] .quick-settings { margin-top:4px; transform:rotate(7deg) }
[data-screen=home] .close { margin-top:11px; transform:rotate(12deg) }
[data-screen=home] .body { overflow:auto; padding:8px 6px 0 }
.orbit { height:348px; margin:0 3px }
.orbit-ring { display:none }
.orbit-kazz { top:10px; left:14%; width:74%; height:271px; filter:drop-shadow(0 3px 3px #000b) }
.shard {
  position:absolute; width:32%; min-height:44px; padding:5px 7px; gap:6px;
  font:900 18px/1.05 var(--display); letter-spacing:.35px; transform:rotate(var(--tilt));
}
.shard svg { width:21px; height:21px; filter:none }
.shard span { font-weight:900 }
.shard:hover:enabled { translate:0 -1px }
.shard:active:enabled { translate:0 1px }
.shard-edit { left:1.5%; top:10px; height:54px; --tilt:7deg }
.shard-swipes { right:1.5%; top:3px; height:54px; --tilt:-8deg }
.shard-slop { left:2%; top:84px; width:29%; height:54px; flex-direction:column; gap:3px; --tilt:-6deg }
.shard-chat { right:2%; top:80px; width:29%; height:54px; flex-direction:column; gap:3px; --tilt:5deg }
.shard-gallery { left:4.5%; top:155px; width:29%; height:54px; flex-direction:column; gap:3px; --tilt:-17deg }
.shard-timeline { right:4.5%; top:152px; width:29%; height:54px; flex-direction:column; gap:3px; --tilt:17deg }
.shard-notebook { left:10%; top:230px; width:29%; height:52px; flex-direction:column; gap:3px; --tilt:-27deg }
.shard-naming { right:10%; top:226px; width:29%; height:52px; flex-direction:column; gap:3px; --tilt:27deg }
.shard-commentary { left:34%; top:292px; width:32%; height:52px; gap:2px; flex-direction:column; font-size:17px; --tilt:-3deg }
.shard-commentary svg { width:20px; height:20px }
.feature-light { top:12px; right:9px; width:5px; height:5px; background:#080c12; border-color:#a4aeb9; opacity:.65 }
.feature-light.on { background:#ff4861; border-color:#ff8a9c; box-shadow:0 0 5px #ff173b90; opacity:1 }
.plug { display:block; width:80%; margin:5px auto 0; min-height:44px; padding:11px 20px; font:900 19px/1.2 var(--display); letter-spacing:.5px }
.status { min-height:32px; padding:8px 16px; color:#c7d0da; font:10px/1.45 var(--mono); margin:4px 6px 6px; max-width:calc(100% - 12px) }
.status span { position:relative }
.status.error { border:0; color:#ffadbb }
.status.error::after { opacity:1 }

.workbench { background:linear-gradient(125deg,#8da6c00b,transparent 45%),#0e1319f5; border-color:#63303e; border-radius:3px 12px 3px 3px; box-shadow:inset 0 1px #bdcfe314,0 5px 20px #0008 }
.section-head { border-color:#39404a }
.section-head h2 { letter-spacing:.6px }
nav button[data-tab=home] { border-color:#733242; border-radius:3px 10px 3px 3px; background:#0e1319 }
.feature-toggle,.history,.chat-compose { border-radius:3px 12px 3px 3px; border-color:#454c58 }
.feature-toggle { background:#161c24 }
.phone { border-color:#62404a }
.chat-taunt { border-radius:3px 12px 3px 3px }
.bubble { border-color:#47505c }
.bubble.user { background:#e3e7ed; border-color:#e3e7ed }
.note { border-left-color:var(--glow) }

@container kazz (max-width:340px) {
  .top { gap:4px; min-height:77px }
  .title { max-width:calc(100% - 96px); min-height:72px; padding:17px 10px 12px }
  .brand { font-size:23px; letter-spacing:.5px }
  .brand em { font-size:11px }
  .hazard { font-size:20px }
  .brand-line { gap:4px }
  .system-clock { font-size:8px; margin-top:8px }
  .shard { font-size:16px; padding-left:6px; padding-right:6px }
  .shard svg { width:21px; height:21px }
  .shard-commentary { font-size:15px }
  .orbit-kazz { left:14%; width:77% }
  .plug { font-size:17px; width:85% }
}
@media (prefers-reduced-motion:reduce) {
  ${surfaces},${surfaces}::before,${surfaces}::after { animation:none!important; transition:none!important }
  .shard:hover:enabled,.shard:active:enabled { translate:none }
}
`;
