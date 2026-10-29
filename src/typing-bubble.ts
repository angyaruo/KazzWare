import type { SpindleFrontendContext } from 'lumiverse-spindle-types';

/** A local activity indicator; never generates commentary or writes a chat turn. */
export function typingBubble(ctx: SpindleFrontendContext, anchor: HTMLElement, options: { active(): boolean; visible(): boolean; width(): number | undefined }) {
  const portal = ctx.dom.createElement('div'); portal.dataset.kazzwareOwned = 'typing'; portal.hidden = true;
  Object.assign(portal.style, { position: 'fixed', zIndex: '2147482901', pointerEvents: 'auto' });
  const root = portal.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>:host{color:#eceef0;font:600 14px/1.5 system-ui}*{box-sizing:border-box}.speech{position:relative;padding:12px 36px 12px 14px;background:#10151bf5;border:1px solid #b2485a;border-radius:3px 14px 3px 3px;box-shadow:0 6px 20px #0006,0 0 12px #ff24451c;backdrop-filter:blur(12px)}small{display:block;font:700 9px ui-monospace,monospace;color:#c2c9d4;margin-bottom:5px;letter-spacing:1px}i{display:inline-block;font-style:normal;animation:dot 1.2s ease-in-out infinite}i:nth-child(2){animation-delay:.16s}i:nth-child(3){animation-delay:.32s}button{position:absolute;right:0;top:0;width:32px;height:36px;background:none;border:0;color:inherit;font-size:22px;cursor:pointer}button:focus-visible{outline:2px solid #ff4262;outline-offset:-4px}@keyframes dot{0%,70%,100%{opacity:.3;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}@media(prefers-reduced-motion:reduce){i{animation:none}}</style><div class="speech"><small>KAZZ</small><span role="status" aria-label="Kazz is typing">Kazz is typing<span aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></span><button aria-label="Dismiss typing indicator">×</button></div>`;
  document.body.append(portal);
  let animation = 0, active = false, dismissed = false;
  function position() {
    portal.hidden = !active || dismissed || !options.visible();
    if (!portal.hidden) {
      portal.style.width = `min(${options.width() || 280}px, calc(100vw - 16px))`;
      const rect = anchor.getBoundingClientRect(), viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0, width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      const box = portal.getBoundingClientRect();
      portal.style.left = `${Math.max(left + 8, Math.min(rect.left + rect.width / 2 - box.width / 2, left + width - box.width - 8))}px`;
      const y = rect.top - box.height - 12 < top + 8 ? rect.bottom + 12 : rect.top - box.height - 12;
      portal.style.top = `${Math.max(top + 8, Math.min(y, top + height - box.height - 8))}px`;
    }
    if (active) animation = window.requestAnimationFrame(position);
  }
  root.querySelector('button')!.addEventListener('click', () => { dismissed = true; portal.hidden = true; });
  return {
    sync() {
      const next = options.active();
      if (!next) dismissed = false;
      active = next; window.cancelAnimationFrame(animation); position();
    },
    destroy() { active = false; window.cancelAnimationFrame(animation); portal.remove(); },
  };
}
