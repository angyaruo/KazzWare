import type { SpindleFrontendContext } from 'lumiverse-spindle-types';
import { DEFAULTS, type Message, type Settings } from './shared';

type Options = {
  enabled(): boolean;
  settings(): Pick<Settings, 'commentaryDuration' | 'commentaryWidth'> | undefined;
  chatId(): string | null;
  visible(): boolean;
  rpc<T>(action: string, data?: Record<string, unknown>): Promise<T>;
  error(text: string): void;
};

/** A short-lived, plain-text aside anchored to the mascot, never to the chat log. */
export function commentary(ctx: SpindleFrontendContext, anchor: HTMLElement, options: Options) {
  const portal = ctx.dom.createElement('div'); portal.dataset.kazzwareOwned = 'commentary'; portal.hidden = true;
  Object.assign(portal.style, { position: 'fixed', zIndex: '2147482900', width: 'min(280px, calc(100vw - 16px))', pointerEvents: 'auto' });
  document.body.append(portal);
  const root = portal.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>:host{font:600 14px/1.45 system-ui;color:#17191d}*{box-sizing:border-box}.speech{position:relative;padding:12px 35px 12px 14px;background:#eceef0;border:2px solid #17191d;box-shadow:0 6px 20px #0006;border-radius:14px;overflow-wrap:anywhere}.speech:after{content:'';position:absolute;bottom:-10px;left:var(--tail,24px);width:16px;height:16px;background:#eceef0;border-right:2px solid #17191d;border-bottom:2px solid #17191d;transform:rotate(45deg)}:host([data-below]) .speech:after{bottom:auto;top:-10px;transform:rotate(225deg)}small{display:block;font:800 10px ui-monospace,monospace;color:#4c5159;margin-bottom:5px}button{position:absolute;right:0;top:0;width:32px;height:36px;border:0;background:none;color:#17191d;font-size:22px;border-radius:50%;cursor:pointer}button:focus-visible{outline:2px solid #4c5159;outline-offset:-4px}</style><div class="speech"><small>KAZZ</small><span role="status" aria-live="polite"></span><button aria-label="Dismiss Kazz commentary">×</button></div>`;
  const text = root.querySelector('span')!;
  let epoch = 0, timer: ReturnType<typeof setTimeout> | undefined, expiry: ReturnType<typeof setTimeout> | undefined, animation = 0, destroyed = false;
  let line = '', muted = false, displayedAt = 0, duration = DEFAULTS.commentaryDuration;
  const shown = new Set<string>();
  const enabled = () => !muted && options.enabled();
  const replies = new Map<string, Promise<string | null>>();
  function clear() { clearTimeout(expiry); window.cancelAnimationFrame(animation); line = ''; text.textContent = ''; portal.hidden = true; }
  function preferences() {
    const settings = options.settings() || DEFAULTS;
    portal.style.width = `min(${settings.commentaryWidth}px, calc(100vw - 16px))`;
    portal.style.fontSize = settings.commentaryWidth >= 340 ? '16px' : '14px';
    if (duration !== settings.commentaryDuration) { duration = settings.commentaryDuration; expire(); }
  }
  function expire() {
    clearTimeout(expiry);
    if (line && duration > 0) expiry = setTimeout(clear, Math.max(0, displayedAt + duration * 1000 - Date.now()));
  }
  function position() {
    if (destroyed || !line) return;
    portal.hidden = !options.visible() || !enabled();
    if (!portal.hidden) {
      const rect = anchor.getBoundingClientRect(), viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0, width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      const box = portal.getBoundingClientRect();
      const x = Math.max(left + 8, Math.min(rect.left + rect.width / 2 - box.width / 2, left + width - box.width - 8));
      const below = rect.top - box.height - 16 < top + 8;
      portal.toggleAttribute('data-below', below);
      portal.style.left = `${x}px`;
      portal.style.top = `${Math.max(top + 8, Math.min(below ? rect.bottom + 16 : rect.top - box.height - 16, top + height - box.height - 8))}px`;
      portal.style.setProperty('--tail', `${Math.max(16, Math.min(rect.left + rect.width / 2 - x - 8, box.width - 32))}px`);
    }
    animation = window.requestAnimationFrame(position);
  }
  root.querySelector('button')!.addEventListener('click', clear);
  function reset() {
    ++epoch; clearTimeout(timer); timer = undefined; clear(); replies.clear(); shown.clear();
    void options.rpc('cancelCommentary').catch(() => {});
  }
  function queue(messageId: string) {
    if (!enabled() || destroyed) return;
    const request = ++epoch, chat = options.chatId(); clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = undefined;
      const live = () => request === epoch && chat === options.chatId() && enabled() && !destroyed;
      try {
        const message = await options.rpc<Message>('message', { messageId });
        if (!live() || !message.content.trim()) return;
        const key = JSON.stringify([message.id, message.swipe_id, message.content]);
        let pending = replies.get(key);
        if (!pending) {
          pending = options.rpc<string | null>('commentary', { messageId, expected: message.content, swipe: message.swipe_id });
          replies.set(key, pending);
          if (replies.size > 100) replies.delete(replies.keys().next().value!);
        }
        const result = await pending;
        if (!live() || !result || shown.has(key)) return;
        shown.add(key); if (shown.size > 100) shown.delete(shown.values().next().value!);
        clear(); line = result; text.textContent = line; displayedAt = Date.now(); preferences(); position(); expire();
      } catch (error) { if (live()) options.error(`Commentary: ${(error as Error).message}`); }
    }, 160);
  }
  const off = [
    ctx.events.on('MESSAGE_SENT', payload => {
      const event = payload as { chatId?: string; message?: Message };
      if (event.chatId === options.chatId() && event.message?.content.trim()) queue(event.message.id);
    }),
    ctx.events.on('MESSAGE_SWIPED', payload => {
      const event = payload as { chatId?: string; message?: Message; action?: string };
      if (event.chatId === options.chatId() && ['added', 'navigated'].includes(event.action || '') && event.message?.content.trim()) queue(event.message.id);
    }),
    ctx.events.on('GENERATION_ENDED', payload => {
      const event = payload as { chatId?: string; messageId?: string; generationType?: string; error?: unknown };
      if (event.chatId === options.chatId() && event.messageId && !event.error && ['normal', 'swipe', 'regenerate', 'continue', 'impersonate'].includes(event.generationType || 'normal')) queue(event.messageId);
    }),
  ];
  return { reset, pause() { muted = true; reset(); }, sync() { preferences(); muted = !options.enabled(); if (muted && (line || replies.size || timer)) reset(); }, destroy() { destroyed = true; reset(); off.forEach(fn => fn()); portal.remove(); } };
}
