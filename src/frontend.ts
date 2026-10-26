import type { SpindleFrontendContext, SpindleSandboxFrameHandle } from 'lumiverse-spindle-types';
import idle from '../assets/kazz-curled.png';
import perched from '../assets/kazz-perched.png';
import listening from '../assets/kazz-listening.png';
import wink from '../assets/kazz-wink.png';
import { CHANNEL, escapeHTML as e, object, slopHits, uniqueRange, textareaRange, textareaOffset, type GalleryPage, type Message, type Range, type Reply, type Settings, type View } from './shared';
import { galleryHTML } from './gallery';
import { CSS } from './style';
import { FONT_CSS } from './fonts';
import { messageInView } from './message-targeting';

type Tab = 'home' | 'edit' | 'slop' | 'chat' | 'gallery' | 'notebook' | 'settings';
const TABS: [Tab, string][] = [['home', 'Kazz'], ['edit', 'Editor'], ['slop', 'De-slop'], ['chat', 'Chat'], ['gallery', 'Gallery'], ['notebook', 'Notebook'], ['settings', 'Settings']];
function randomId(): string {
  // These are opaque correlation IDs. getRandomValues also works on LAN HTTP,
  // where browsers do not expose the secure-context-only crypto.randomUUID.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function setup(ctx: SpindleFrontendContext): () => void {
  const stateAPI = ctx.state;
  if (!stateAPI) throw new Error('KazzWare requires the Lumiverse 1.2.5 frontend state API. Update Lumiverse and reload.');
  ctx.deferReady();
  const disposers: (() => void)[] = [];
  // Font faces live in the document so they resolve inside both shadow roots.
  const fontStyle = document.createElement('style'); fontStyle.dataset.kazzwareFont = ''; fontStyle.textContent = FONT_CSS + `
    /* Lumiverse wraps a float root in content + widget divs. Scope this to our
       marked panel only; transparent gaps must reach the native chat. */
    div:has(> div > [data-kazzware-surface]), div:has(> [data-kazzware-surface]) { pointer-events:none!important; touch-action:auto!important; box-shadow:none!important }
    [data-kazzware-target] { outline:2px dashed #bce9f3!important; outline-offset:-3px }
    [data-kazzware-candidate] { outline:3px solid #ff4b57!important; outline-offset:-3px; cursor:crosshair!important }
  `;
  document.head.append(fontStyle); disposers.push(() => fontStyle.remove());
  const client = randomId(); let binding = randomId(); let chatId: string | null = null;
  let destroyed = false; let opened = false; let tab: Tab = 'home'; let view: View | undefined;
  let target: Message | undefined; let range: Range | undefined; let selectedText = ''; let selectedMessageId: string | null = null; let selectionRequest = 0;
  let following = true; let picking = false; let followTimer: ReturnType<typeof setTimeout> | undefined; let autoPending = ''; let autoToken = 0;
  let marked: Element | null = null; let hovered: Element | null = null;
  let direction = ''; let askDraft = ''; let slopDraft: string | undefined; let settingsDraft: Settings | undefined;
  let pageId = ''; let frame: SpindleSandboxFrameHandle | undefined; let status = 'Open a chat to wake Kazz.'; let error = false; let busy = 0;
  const pending = new Map<string, { resolve: (result: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const mascot = ctx.ui.createFloatWidget({ width: 110, height: 110, initialPosition: { x: Math.max(0, window.innerWidth - 125), y: Math.max(0, window.innerHeight - 245) }, snapToEdge: true, chromeless: true, tooltip: 'KazzWare · your in-chat accomplice' });
  const panel = ctx.ui.createFloatWidget({ width: Math.min(520, window.innerWidth - 16), height: Math.min(860, window.innerHeight - 24), initialPosition: { x: Math.max(8, window.innerWidth - 540), y: 12 }, chromeless: true, touchScrollMode: 'native', tooltip: 'KazzWare' });
  for (const widget of [mascot, panel]) { widget.root.style.width = '100%'; widget.root.style.height = '100%'; }
  panel.root.dataset.kazzwareSurface = '';
  panel.root.style.pointerEvents = 'none';
  panel.root.style.userSelect = 'text';
  panel.root.style.touchAction = 'pan-y';
  const petRoot = mascot.root.attachShadow({ mode: 'open' });
  petRoot.innerHTML = `<style>${CSS}</style><button class="mascot" aria-label="Open KazzWare"><img alt="Kazz, a silver-haired cyber-scorpion companion"><span class="dot"></span></button>`;
  const petButton = petRoot.querySelector('button')!; const petImage = petRoot.querySelector('img')!;
  const root = panel.root.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style><section class="shell" data-screen="home" aria-label="KazzWare"><header class="top"><div class="title"><div class="brand-line"><span class="brand">KAZZWARE<em>.exe</em></span><span class="badge">FRIENDLY MALWARE</span></div><div class="chat-name"></div></div><button class="quick-settings" aria-label="Connection settings">⚙</button><button class="icon close" aria-label="Close KazzWare">×</button></header><nav aria-label="KazzWare sections"></nav><main class="body"></main><footer class="status" role="status" aria-live="polite"><span></span><button class="cancel-pick" hidden>Cancel pick</button><button class="cancel" hidden>Stop</button></footer></section>`;
  const body = root.querySelector<HTMLElement>('.body')!; const nav = root.querySelector('nav')!; const statusBox = root.querySelector<HTMLElement>('.status')!;
  // Keep selection and scrolling gestures in the panel; its header remains the drag handle.
  body.addEventListener('pointerdown', event => event.stopPropagation());
  nav.addEventListener('pointerdown', event => event.stopPropagation());
  const notify = (text: string, failed = false) => { status = text; error = failed; paintStatus(); };
  function paintStatus() {
    statusBox.querySelector('span')!.textContent = status; statusBox.classList.toggle('error', error);
    petButton.classList.toggle('busy', busy > 0); petImage.src = idle;
    mascot.setVisible(!!chatId && !opened);
    (statusBox.querySelector('.cancel-pick') as HTMLButtonElement).hidden = !picking;
    (statusBox.querySelector('.cancel') as HTMLButtonElement).hidden = busy === 0;
    body.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('[data-mutate],.pick-message,.follow-target,.messages').forEach(control => { control.disabled = busy > 0; });
  }
  function rpc<T = unknown>(action: string, data: Record<string, unknown> = {}): Promise<T> {
    if (destroyed) return Promise.reject(new Error('KazzWare closed.'));
    const id = randomId();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Kazz did not receive a response. Reload to check completed changes.')); }, 610_000);
      pending.set(id, { resolve: result => resolve(result as T), reject, timer });
      ctx.sendToBackend({ channel: CHANNEL, client, binding, chatId, id, action, data });
    });
  }
  disposers.push(ctx.onBackendMessage(payload => {
    let reply: Reply; try { reply = object(payload) as unknown as Reply; } catch { return; }
    if (reply.channel !== CHANNEL || reply.client !== client || reply.binding !== binding || destroyed) return;
    const request = pending.get(reply.id); if (!request) return;
    if (reply.progress) { notify(reply.progress); return; }
    clearTimeout(request.timer); pending.delete(reply.id);
    reply.ok ? request.resolve(reply.result) : request.reject(new Error(reply.error || 'KazzWare request failed.'));
  }));
  async function run(action: string, data: Record<string, unknown> = {}, success = 'Done. Your changes are saved.') {
    const origin = binding; busy++; paintStatus(); notify('Working…');
    try {
      const result = await rpc<View | null>(action, data);
      if (origin !== binding || destroyed) return;
      if (result) { view = result; await refreshTarget(); if (origin !== binding) return; render(); }
      notify(success);
    } catch (err) {
      if (origin === binding && !destroyed) {
        notify(err instanceof Error ? err.message : 'Something went wrong.', true);
        try { const refreshed = await rpc<View>('load'); if (origin === binding) { view = refreshed; await refreshTarget(); if (origin === binding) render(); } } catch { /* Preserve the original error. */ }
      }
    } finally { if (origin === binding) { busy = Math.max(0, busy - 1); paintStatus(); scheduleFollow(); } }
  }
  async function refreshTarget() {
    if (!target) return;
    const origin = binding, id = target.id;
    try { const current = await rpc<Message>('message', { messageId: id }); if (origin === binding && target?.id === id && (current.content !== target.content || current.swipe_id !== target.swipe_id)) { target = current; range = undefined; } }
    catch { if (origin === binding && target?.id === id) { target = undefined; range = undefined; } }
  }
  function show(next: Tab = tab) { const changed = next !== tab; stopPicking(); opened = true; tab = next; panel.setVisible(!!chatId); render(); if (changed) body.scrollTop = 0; scheduleFollow(); }
  function hide() { stopPicking(); opened = false; invalidateSelection(); clearTimeout(followTimer); markTarget(); panel.setVisible(false); paintStatus(); petButton.focus(); }
  petButton.addEventListener('click', () => opened ? hide() : show());
  root.querySelector('.close')!.addEventListener('click', hide);
  root.querySelector('.quick-settings')!.addEventListener('click', () => show('settings'));
  root.querySelector('.cancel-pick')!.addEventListener('click', () => { stopPicking(); notify('Pick cancelled. Your previous target is unchanged.'); scheduleFollow(); });
  root.querySelector('.cancel')!.addEventListener('click', () => { void rpc('cancel').catch(() => {}); notify('Stopping…'); });
  nav.innerHTML = TABS.map(([key, label], index) => `<button data-tab="${key}"><span class="nav-index" aria-hidden="true">0${index}</span>${label}</button>`).join('');
  nav.addEventListener('click', ev => { const button = (ev.target as Element).closest<HTMLButtonElement>('button'); if (button) show(button.dataset.tab as Tab); });
  root.addEventListener('keydown', ev => { if ((ev as KeyboardEvent).key === 'Escape') hide(); });
  const inputAction = ctx.ui.registerInputBarAction({ id: 'kazzware-open', label: 'KazzWare', subtitle: 'Your in-chat accomplice', iconUrl: idle });
  disposers.push(inputAction.onClick(() => show())); disposers.push(() => inputAction.destroy());
  if (ctx.registerMessageAction) {
    const action = ctx.registerMessageAction({ id: 'kazzware-edit', label: 'Send to Kazz', onClick: id => { void selectMessage(id, selectedMessageId === id ? selectedText : ''); } });
    disposers.push(() => action.destroy());
  }
  async function selectMessage(id: string, highlighted = '', automatic = false) {
    if (busy || !chatId || (automatic && (!following || picking))) return;
    if (!automatic) {
      stopPicking(); pinTarget();
      if (target?.id !== id) { target = undefined; range = undefined; direction = ''; show('edit'); notify('Fetching the selected message…'); }
    }
    const origin = binding, sequence = ++selectionRequest;
    try {
      const message = await rpc<Message>('message', { messageId: id }); if (origin !== binding || sequence !== selectionRequest || destroyed || busy || (automatic && (!following || !opened || picking))) return;
      if (target?.id !== id) direction = '';
      target = message; range = highlighted ? uniqueRange(message.content, highlighted) : undefined;
      if (automatic) { if (tab === 'edit') render(); paintTarget(); paintStatus(); return; }
      show('edit'); paintTarget();
      body.querySelector<HTMLButtonElement>('.pick-message')?.focus();
      notify(highlighted && !range ? 'That highlight cannot be mapped exactly. Select it in the source box below.' : range ? 'Only the highlighted source text will change.' : 'Message selected. Edits apply immediately; Undo stays available.');
    } catch (err) { if (origin === binding && sequence === selectionRequest && !destroyed) notify((err as Error).message, true); }
  }
  function markTarget() {
    marked?.removeAttribute('data-kazzware-target'); marked = null;
    if (opened && !picking && target && ctx.dom.findMessageElement) {
      marked = ctx.dom.findMessageElement(target.id); marked?.setAttribute('data-kazzware-target', '');
    }
  }
  function paintTarget() {
    const description = target ? `#${target.index_in_chat + 1} · ${target.name}` : 'No message in view';
    body.querySelectorAll<HTMLElement>('.target-name').forEach(el => { el.textContent = description; });
    body.querySelectorAll<HTMLButtonElement>('.follow-target').forEach(el => { el.textContent = following ? '◎ Following view' : '⌖ Pinned · follow view'; el.setAttribute('aria-pressed', String(following)); });
    markTarget();
  }
  function invalidateSelection() { ++selectionRequest; ++autoToken; autoPending = ''; }
  function pinTarget() { following = false; invalidateSelection(); clearTimeout(followTimer); paintTarget(); }
  function scheduleFollow() {
    markTarget();
    clearTimeout(followTimer);
    if (!opened || !view || !following || busy || picking || destroyed || !ctx.dom.listMessageElements) return;
    followTimer = setTimeout(() => {
      if (!opened || !following || busy || picking || destroyed) return;
      const id = messageInView(ctx.dom); markTarget();
      if (!id) { invalidateSelection(); target = undefined; range = undefined; if (tab === 'edit') render(); paintTarget(); return; }
      // Scrolling back to the already-loaded target must also cancel a slower
      // request for the message we just scrolled past.
      if (autoPending && autoPending !== id) invalidateSelection();
      if (id === target?.id || id === autoPending) return;
      autoPending = id;
      const token = ++autoToken;
      void selectMessage(id, '', true).finally(() => { if (token === autoToken) autoPending = ''; });
    }, 220);
  }
  function stopPicking() {
    picking = false; root.querySelector('.shell')!.classList.remove('picking');
    hovered?.removeAttribute('data-kazzware-candidate'); hovered = null; paintStatus(); markTarget();
  }
  function startPicking() {
    if (busy) return;
    invalidateSelection(); clearTimeout(followTimer); picking = true;
    root.querySelector('.shell')!.classList.add('picking'); markTarget();
    notify('Tap a message in the chat. Esc cancels.');
    (root.querySelector('.cancel-pick') as HTMLButtonElement).focus();
  }
  function targetControls() { return `<div class="target-tools"><div class="target-readout"><span class="target-name"></span><span>EDIT TARGET</span></div><div class="row"><button class="pick-message">↖ Pick from chat</button><button class="follow-target" aria-pressed="${following}"></button></div></div>`; }
  function wireTargetControls() {
    button('.pick-message', startPicking);
    button('.follow-target', () => {
      if (busy) return;
      if (following) { pinTarget(); notify('Target pinned. Scroll wherever you like.'); }
      else { following = true; direction = ''; range = undefined; invalidateSelection(); render(); scheduleFollow(); notify('Following the message in view. Edit directions pin it automatically.'); }
    });
    paintTarget();
  }
  const ownEvent = (event: Event) => event.composedPath().includes(panel.root) || event.composedPath().includes(mascot.root);
  const pickClick = (event: MouseEvent) => {
    if (!picking || ownEvent(event) || !(event.target instanceof Element)) return;
    const id = ctx.dom.getMessageId(event.target); if (!id) return;
    // Consume the pick, including clicks on native message action buttons.
    event.preventDefault(); event.stopImmediatePropagation();
    void selectMessage(id, selectedMessageId === id ? selectedText : '');
  };
  const hoverPick = (event: PointerEvent) => {
    if (!picking) return;
    const id = !ownEvent(event) && event.target instanceof Element ? ctx.dom.getMessageId(event.target) : null;
    const element = id && ctx.dom.findMessageElement ? ctx.dom.findMessageElement(id) : null;
    if (hovered !== element) { hovered?.removeAttribute('data-kazzware-candidate'); hovered = element; hovered?.setAttribute('data-kazzware-candidate', ''); }
  };
  const cancelPick = (event: KeyboardEvent) => { if (picking && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); stopPicking(); notify('Pick cancelled.'); scheduleFollow(); } };
  const nativeScroll = (event: Event) => { if (!ownEvent(event)) scheduleFollow(); };
  document.addEventListener('click', pickClick, true); document.addEventListener('pointermove', hoverPick, true);
  document.addEventListener('keydown', cancelPick, true); document.addEventListener('scroll', nativeScroll, true);
  const observer = new window.MutationObserver(scheduleFollow); observer.observe(document.body, { childList: true, subtree: true });
  disposers.push(() => {
    clearTimeout(followTimer); observer.disconnect(); marked?.removeAttribute('data-kazzware-target'); hovered?.removeAttribute('data-kazzware-candidate');
    document.removeEventListener('click', pickClick, true); document.removeEventListener('pointermove', hoverPick, true);
    document.removeEventListener('keydown', cancelPick, true); document.removeEventListener('scroll', nativeScroll, true);
  });
  const captureSelection = () => {
    const selection = window.getSelection(); if (!selection?.rangeCount || selection.isCollapsed) return;
    const anchor = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode as Element : selection.anchorNode?.parentElement;
    const focus = selection.focusNode?.nodeType === Node.ELEMENT_NODE ? selection.focusNode as Element : selection.focusNode?.parentElement;
    if (!anchor || !focus || root.contains(anchor) || petRoot.contains(anchor)) return;
    const a = ctx.dom.getMessageId(anchor), b = ctx.dom.getMessageId(focus);
    if (a && a === b) { selectedText = selection.toString(); selectedMessageId = a; }
  };
  document.addEventListener('selectionchange', captureSelection); disposers.push(() => document.removeEventListener('selectionchange', captureSelection));
  const resize = () => {
    const mobile = window.innerWidth <= 600;
    panel.setFullscreen(mobile);
    panel.root.style.height = mobile ? `${Math.max(200, window.visualViewport?.height || window.innerHeight)}px` : '100%';
    scheduleFollow();
    if (mobile) return;
    panel.setSize(Math.min(520, window.innerWidth - 16), Math.max(200, Math.min(860, (window.visualViewport?.height || window.innerHeight) - 24)));
    const pos = panel.getPosition(); panel.moveTo(Math.max(8, Math.min(pos.x, window.innerWidth - Math.min(520, window.innerWidth - 16) - 8)), Math.max(8, Math.min(pos.y, 24)));
  };
  window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
  disposers.push(() => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); });
  const heartbeat = setInterval(() => { if (chatId) void rpc('heartbeat').catch(() => {}); }, 45_000); disposers.push(() => clearInterval(heartbeat));
  function changeChat(value: unknown) {
    const next = value && typeof value === 'object' && 'chatId' in value ? (value as { chatId: string | null }).chatId : null;
    if (next === chatId && view) return;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Chat changed.')); } pending.clear();
    stopPicking(); following = true; invalidateSelection(); clearTimeout(followTimer);
    binding = randomId(); chatId = next; view = undefined; target = undefined; range = undefined; direction = ''; askDraft = ''; slopDraft = undefined; settingsDraft = undefined; selectedText = ''; selectedMessageId = null; pageId = ''; busy = 0;
    frame?.destroy(); frame = undefined; mascot.setVisible(!!chatId); panel.setVisible(!!chatId && opened); inputAction.setEnabled(!!chatId);
    render();
    if (chatId) void run('bind', {}, 'Kazz is here. Pick a message or ask a favor.'); else { void rpc('bind').catch(() => {}); notify('Open a chat to wake Kazz.'); }
  }
  disposers.push(stateAPI.subscribe('chat.active', changeChat));
  disposers.push(ctx.events.on('GENERATION_ENDED', payload => {
    const event = payload as { chatId?: string; messageId?: string; generationType?: string; error?: unknown };
    if (event.chatId === chatId && view?.state.settings.galleryEnabled && event.messageId && event.generationType === 'normal' && !event.error) void run('tick', { messageId: event.messageId, generationType: event.generationType }, 'Peanut Gallery is up to date.');
  }));
  function button(selector: string, handler: () => void) { body.querySelector(selector)?.addEventListener('click', handler); }
  function heading(code: string, title: string, tag: string) { return `<div class="section-head"><div class="eyebrow">${code}</div><h2>${title}</h2><span class="badge">${tag}</span></div>`; }
  function render() {
    frame?.destroy(); frame = undefined;
    markTarget();
    root.querySelector<HTMLElement>('.shell')!.dataset.screen = tab;
    root.querySelector('.chat-name')!.textContent = view?.chatName || 'Current chat';
    nav.querySelectorAll('button').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'); });
    if (!view) { body.innerHTML = '<p class="empty">Connecting to this chat…</p>'; paintStatus(); return; }
    mascot.setSize(view.state.settings.mascotSize, view.state.settings.mascotSize);
    if (tab === 'home') renderHome();
    if (tab === 'edit') renderEditor();
    if (tab === 'slop') renderSlop();
    if (tab === 'chat') renderChat();
    if (tab === 'gallery') renderGallery();
    if (tab === 'notebook') renderNotebook();
    if (tab === 'settings') renderSettings();
    if (!['home', 'chat'].includes(tab)) { const sheet = document.createElement('div'); sheet.className = 'workbench'; sheet.append(...Array.from(body.childNodes)); body.append(sheet); }
    paintTarget(); paintStatus();
  }
  function renderHome() {
    body.innerHTML = `<div class="orbit"><div class="speech">Need me to fuck<br>some shit up?<span>YOUR FRIENDLY NEIGHBORHOOD MALWARE</span></div><img class="orbit-kazz" src="${perched}" alt="Kazz perched on his mechanical tail"><span class="orbit-stamp" aria-hidden="true">100%<br>YOUR PROBLEM</span><button class="shard shard-edit" data-go="edit"><small>01 / MESSAGE SURGERY</small><strong>Cut the crap.</strong><span>Rewrite + Undo ↗</span></button><button class="shard shard-slop" data-go="slop"><small>02 / EVICTION LIST</small><strong>No more slop.</strong><span>Ban the usual suspects ↗</span></button><button class="shard shard-chat" data-go="chat"><small>03 / DIRECT LINE</small><strong>Psst. Kazz.</strong><span>Ask your accomplice ↗</span></button><button class="shard shard-gallery" data-go="gallery"><small>04 / PEANUT GALLERY</small><strong>Start shit.</strong><span>Wake the fandom ↗</span></button><button class="shard shard-notebook" data-go="notebook"><small>05 / THE RECEIPTS</small><strong>Evidence locker.</strong><span>Summaries + lore ↗</span></button></div><form class="quick-ask"><label for="home-ask">GOT A PROBLEM?</label><div><input id="home-ask" class="home-ask" placeholder="Spit it out…" value="${e(askDraft)}" maxlength="20000"><button class="primary" aria-label="Send to Kazz" data-mutate>↗</button></div></form><div class="home-target">${targetControls()}</div>${!view!.state.settings.connectionId ? '<button class="plug" data-go="settings">Plug me in ↗ Choose a connection</button>' : ''}`;
    body.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go as Tab)));
    body.querySelector('.home-ask')!.addEventListener('input', ev => { askDraft = (ev.target as HTMLInputElement).value; });
    body.querySelector('form')!.addEventListener('submit', ev => { ev.preventDefault(); if (busy || !askDraft.trim()) return; const text = askDraft; askDraft = ''; show('chat'); void run('ask', { text }, 'Kazz has replied.'); });
    wireTargetControls();
  }
  function renderEditor() {
    const messages = view!.messages;
    body.innerHTML = `${heading('01 / EDITOR', 'Message surgery', 'CUT + STITCH')}${targetControls()}<p class="muted">Follow what you’re reading, or pick a message directly. Writing a direction pins the target.</p><label class="field">Recent messages<select class="messages"><option value="">Choose a message…</option>${[...messages].reverse().map(m => `<option value="${e(m.id)}" ${m.id === target?.id ? 'selected' : ''}>${m.index_in_chat + 1} · ${e(m.name)} · ${e(m.content.slice(0, 65).replace(/\n/g, ' '))}</option>`).join('')}</select></label>${view!.totalMessages > messages.length ? '<small>Showing the latest 100. Use the message menu or ask Kazz to search older messages.</small>' : ''}${target ? `<label class="field">Source text · select a section to limit the edit<textarea class="raw" readonly aria-label="Message source">${e(target.content)}</textarea><div class="range"></div></label><div class="row"><button class="clear-range">Use whole message</button><button class="reload">Reload source</button></div><label class="field">Your direction<textarea class="direction" placeholder="Shorten this. Keep the tension, lose the three-paragraph weather report.">${e(direction)}</textarea></label><div class="row"><button class="primary apply" data-mutate>Edit now</button><button class="deslop" data-mutate>De-slop now</button></div><small>Same narrative moment unless you explicitly ask to advance it.</small>` : '<div class="empty">No message selected yet.</div>'}<h3 style="margin-top:26px">Undo history · latest 20 edits</h3>${[...view!.state.undo].reverse().map(u => `<div class="history"><strong>${e(u.label)}</strong><p>${new Date(u.createdAt).toLocaleString()} · ${u.status === 'prepared' ? 'Recovery record — check current message' : u.status}</p><button data-undo="${e(u.id)}" data-mutate ${u.status === 'undone' ? 'hidden' : ''}>Undo this edit</button></div>`).join('') || '<p class="empty">No Kazz edits in this chat yet.</p>'}`;
    wireTargetControls();
    body.querySelector('select')!.addEventListener('focus', pinTarget);
    body.querySelector('select')!.addEventListener('change', ev => { const id = (ev.target as HTMLSelectElement).value; if (id) void selectMessage(id); });
    const raw = body.querySelector<HTMLTextAreaElement>('.raw');
    const selectionLabel = () => { const label = body.querySelector('.range'); if (label) label.textContent = range ? `Selection only · ${range.end - range.start} characters` : 'Whole message selected'; };
    if (raw) {
      if (range) raw.setSelectionRange(textareaOffset(target!.content, range.start), textareaOffset(target!.content, range.end));
      raw.addEventListener('focus', pinTarget);
      raw.addEventListener('select', () => { pinTarget(); range = raw.selectionEnd > raw.selectionStart ? textareaRange(target!.content, raw.selectionStart, raw.selectionEnd) : undefined; selectionLabel(); });
      body.querySelector<HTMLTextAreaElement>('.direction')!.addEventListener('focus', pinTarget);
      body.querySelector<HTMLTextAreaElement>('.direction')!.addEventListener('input', ev => { pinTarget(); direction = (ev.target as HTMLTextAreaElement).value; });
      button('.clear-range', () => { range = undefined; raw.setSelectionRange(0, 0); selectionLabel(); });
      button('.reload', () => { if (target) void selectMessage(target.id); });
      const edit = (mode: string) => { pinTarget(); if (target) void run('edit', { messageId: target.id, expected: target.content, swipe: target.swipe_id, direction, mode, range }, mode === 'deslop' && !slopHits(range ? target.content.slice(range.start, range.end) : target.content, view!.state.settings.slop, view!.state.settings.wholeWords).length ? 'No banned phrases found.' : 'Edit completed. Undo is below if wording changed.'); };
      button('.apply', () => edit('reform')); button('.deslop', () => edit('deslop')); selectionLabel();
    }
    body.querySelectorAll<HTMLButtonElement>('[data-undo]').forEach(b => b.addEventListener('click', () => { void run('undo', { undoId: b.dataset.undo }, 'Undone. Previous wording restored.'); }));
  }
  function renderSlop() {
    body.innerHTML = `${heading('02 / DE-SLOP', 'Eviction list', 'KILL ON SIGHT')}<p class="muted">One phrase or word per line. Literal matching; case-insensitive.</p><label class="field">Banned phrases<textarea class="phrases" style="min-height:240px" maxlength="60300">${e(slopDraft ?? view!.state.settings.slop.join('\n'))}</textarea></label><label class="check"><input class="whole" type="checkbox" ${view!.state.settings.wholeWords ? 'checked' : ''}>Match whole words / phrase boundaries</label><div class="row"><button class="primary save-slop" data-mutate>Save list</button><button class="scan">Scan selected message</button></div><div class="hits field"></div><div class="note">De-slop rewrites coherently, then scans the result again. If banned wording remains, the original stays intact.</div>`;
    body.querySelector('.phrases')!.addEventListener('input', ev => { slopDraft = (ev.target as HTMLTextAreaElement).value; });
    const phrases = () => body.querySelector<HTMLTextAreaElement>('.phrases')!.value.split(/\r?\n/).map(p => p.trim()).filter(Boolean);
    button('.save-slop', () => { const next = { ...view!.state.settings, slop: phrases(), wholeWords: body.querySelector<HTMLInputElement>('.whole')!.checked }; slopDraft = undefined; void run('settings', { settings: next }, 'Eviction list saved for this chat.'); });
    button('.scan', () => { const hits = target ? slopHits(target.content, phrases(), body.querySelector<HTMLInputElement>('.whole')!.checked) : []; body.querySelector('.hits')!.textContent = !target ? 'Select a message in Editor first.' : hits.length ? hits.map(h => `${h.phrase} × ${h.count}`).join('\n') : 'Clean. No matches in the selected source.'; });
  }
  function renderChat() {
    body.innerHTML = `<div class="chat-perch"><span class="chat-taunt">Yeah. I’m listening.</span><img src="${listening}" alt="Kazz leaning on the message input"></div><form class="chat-compose"><label for="kazz-ask">YOUR DIRECT LINE / KAZZ</label><textarea id="kazz-ask" class="ask" placeholder="Alright, Kazz…">${e(askDraft)}</textarea><button class="primary send" type="submit" data-mutate>Send to Kazz ↗</button></form><div class="transcript">${view!.state.turns.map(t => `<div class="bubble ${t.role}"><span class="speaker">${t.role === 'user' ? 'YOU' : 'KAZZ'}</span>${e(t.content)}</div>`).join('') || '<div class="chat-empty"><strong>What would you do without me?</strong><p>Find a line. Fix a message. Untangle the lore.<br>Give your resident parasite something to do.</p></div>'}</div><small class="chat-disclaimer">Private to this chat. Requested edits land immediately; Undo lives in Editor.</small>`;
    body.querySelector('.ask')!.addEventListener('input', ev => { askDraft = (ev.target as HTMLTextAreaElement).value; });
    body.querySelector('form')!.addEventListener('submit', ev => { ev.preventDefault(); const text = askDraft; if (busy || !text.trim()) return; askDraft = ''; void run('ask', { text }, 'Kazz has replied.'); });
  }
  function renderGallery() {
    const state = view!.state; const page = state.pages.find(p => p.id === pageId) || state.pages.at(-1); pageId = page?.id || '';
    body.innerHTML = `${heading('04 / BOOTLEG INTERNET', 'Peanut Gallery', 'FICTIONAL')}<label class="check"><input class="enabled" type="checkbox" ${state.settings.galleryEnabled ? 'checked' : ''}>Let the fandom comment</label><small>Every ${state.settings.interval} normal replies · ${state.count} / ${state.settings.interval} counted. No regeneration, swipe or Kazz-reply triggers.</small><div class="row field"><button class="primary generate" data-mutate ${state.settings.galleryEnabled ? '' : 'hidden'}>Fresh drama</button><button class="gallery-settings">Configure</button></div><label>Saved pages<select class="pages"><option value="">${state.pages.length ? 'Choose a page…' : 'No pages yet'}</option>${[...state.pages].reverse().map(p => `<option value="${e(p.id)}" ${p.id === pageId ? 'selected' : ''}>${e(p.title)}</option>`).join('')}</select></label>${page ? '<div class="phone"><div class="island"></div><div class="phone-label"><span>KAZZNET / LOCAL FEED</span><span>● FICTIONAL</span></div><div class="screen"></div><div class="phone-bottom"></div></div>' : `<div class="gallery-empty"><img class="off-duty" src="${wink}" alt="Kazz lounging off duty"><p>The internet in your pocket is suspiciously quiet.</p><small>Enable the fandom and tap Fresh drama.</small></div>`}`;
    body.querySelector('.enabled')!.addEventListener('change', ev => { const galleryEnabled = (ev.target as HTMLInputElement).checked; void run('settings', { settings: { ...state.settings, galleryEnabled } }, galleryEnabled ? 'The fandom is awake.' : 'Peanut Gallery paused. Saved pages remain.'); });
    button('.generate', () => { pageId = ''; void run('gallery', {}, 'Fresh drama has arrived.'); }); button('.gallery-settings', () => show('settings'));
    body.querySelector('.pages')!.addEventListener('change', ev => { pageId = (ev.target as HTMLSelectElement).value; render(); });
    if (page) {
      const framePageId = page.id, origin = binding, screen = body.querySelector('.screen')!;
      void rpc<GalleryPage | null>('page', { pageId: framePageId }).then(fullPage => {
      if (!fullPage || origin !== binding || tab !== 'gallery' || !root.contains(screen)) return;
      frame = ctx.dom.createSandboxFrame({ html: galleryHTML(fullPage), autoResize: false, minHeight: 350, initialHeight: 440, maxHeight: 440 });
      frame.element.title = 'Fictional Peanut Gallery page'; screen.append(frame.element);
      frame.onMessage(payload => {
        let data: Record<string, unknown>; try { data = object(payload); } catch { return; }
        if (!['vote', 'comment'].includes(String(data.kind)) || typeof data.postId !== 'string' || !fullPage.posts.some(p => p.id === data.postId)) return;
        void run('react', { pageId: framePageId, kind: data.kind, postId: data.postId, text: data.text }, 'Saved in your fictional fandom.');
      });
      }).catch(err => { if (origin === binding) notify((err as Error).message, true); });
    }
  }
  function renderNotebook() {
    body.innerHTML = `${heading('05 / NOTEBOOK', 'The evidence locker', 'KEEP THE RECEIPTS')}<p class="muted">Summaries cover the entire current chat. Lorebooks are created in Lumiverse and attached to this chat.</p><div class="row field"><button class="primary summarize" data-mutate>Summarize chat</button><button class="lorebook" data-mutate>Create lorebook</button></div><small>Long chats require several model calls. Stop cancels unfinished work.</small>${[...view!.state.summaries].reverse().map(s => `<details class="history"><summary>${s.messages} messages · ${new Date(s.createdAt).toLocaleString()}</summary><div class="summary">${e(s.text)}</div></details>`).join('') || '<div class="empty">No summaries yet.</div>'}<h3 style="margin-top:20px">Created lorebooks</h3>${view!.state.lorebooks.map(b => `<div class="history"><strong>${e(b.name)}</strong><p>ID: ${e(b.id)}</p><small>Manage entries and attachment in Lumiverse’s lorebook editor. Interrupted creations may be incomplete.</small></div>`).join('') || '<p class="empty">No lorebooks created by Kazz yet.</p>'}`;
    button('.summarize', () => { void run('summary', {}, 'Full-chat summary saved in the notebook.'); }); button('.lorebook', () => { void run('lorebook', {}, 'Lorebook created and attached to this chat.'); });
    const summaries = [...view!.state.summaries].reverse();
    body.querySelectorAll<HTMLDetailsElement>('details').forEach((details, index) => {
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        const origin = binding;
        void rpc<string>('summaryContent', { summaryId: summaries[index].id }).then(text => { if (origin === binding && root.contains(details)) details.querySelector('.summary')!.textContent = text; }).catch(err => { if (origin === binding) notify((err as Error).message, true); });
      });
    });
  }
  function renderSettings() {
    const s = settingsDraft || view!.state.settings;
    body.innerHTML = `${heading('06 / SETTINGS', 'Under the hood', 'HANDLE WITH CARE')}<p class="muted">Saved separately for each chat.</p><label class="field">Kazz’s connection<select class="connection"><option value="">Choose a connection…</option>${view!.connections.map(c => `<option value="${e(c.id)}" ${c.id === s.connectionId ? 'selected' : ''}>${e(c.name)} · ${e(c.model)}</option>`).join('')}</select></label><small>Uses this saved connection for every Kazz request. Your roleplay connection stays as it is.</small><label class="field">Recent messages in working context (5–100)<input class="context" type="number" min="5" max="100" value="${s.contextMessages}"></label><label class="field">Gallery interval (normal replies)<input class="interval" type="number" min="1" max="100" value="${s.interval}"></label><label class="field">Gallery format<select class="format">${[['random', 'Surprise me'], ['forum', 'AITA / discussion forum'], ['thread', 'Fandom social thread'], ['wiki', 'Unofficial wiki']].map(([key, label]) => `<option value="${key}" ${key === s.format ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field">Mascot size<input class="size" type="range" min="70" max="180" value="${s.mascotSize}"></label><div class="row"><button class="primary save-settings" data-mutate>Save settings</button><button class="reload-state">Reload</button></div><div class="note">Context goes to the connection you select. Search can inspect older messages; summaries read the whole chat. Kazz never receives connection API keys.</div>`;
    const read = (): Settings => ({ ...view!.state.settings, connectionId: body.querySelector<HTMLSelectElement>('.connection')!.value, contextMessages: Number(body.querySelector<HTMLInputElement>('.context')!.value), interval: Number(body.querySelector<HTMLInputElement>('.interval')!.value), format: body.querySelector<HTMLSelectElement>('.format')!.value as Settings['format'], mascotSize: Number(body.querySelector<HTMLInputElement>('.size')!.value) });
    body.querySelectorAll('input,select').forEach(input => input.addEventListener('input', () => { settingsDraft = read(); }));
    button('.save-settings', () => { const next = read(); settingsDraft = undefined; void run('settings', { settings: next }, 'Settings saved for this chat.'); });
    button('.reload-state', () => { settingsDraft = undefined; void run('load', {}, 'Reloaded.'); });
  }
  panel.setVisible(false); mascot.setVisible(false); resize(); changeChat(stateAPI.get('chat.active')); ctx.ready();
  return () => {
    if (destroyed) return;
    void rpc('cancel').catch(() => {}); destroyed = true;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('KazzWare unloaded.')); } pending.clear();
    for (const dispose of disposers.reverse()) dispose(); frame?.destroy(); mascot.destroy(); panel.destroy();
  };
}
