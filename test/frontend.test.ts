import { afterEach, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import type { SpindleFrontendContext } from 'lumiverse-spindle-types';
import { setup } from '../src/frontend';
import { deferred, fake, until } from './fake';
const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
async function harness(plainHTTP = false) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: plainHTTP ? 'http://192.0.2.1:7860' : 'https://lumiverse.test' });
  // The in-process fake backend shares globals with jsdom; retain its WebCrypto digest.
  Object.defineProperty(dom.window.crypto, 'subtle', { value: globalThis.crypto.subtle });
  // jsdom does not enforce secure-context restrictions; match a browser on LAN HTTP.
  if (plainHTTP) Object.defineProperty(dom.window.crypto, 'randomUUID', { value: undefined });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, Node: dom.window.Node, Element: dom.window.Element, crypto: dom.window.crypto })) { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value }); }
  cleanups.push(() => { dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  const f = fake(); await f.ready(); let onBackend: (payload: unknown) => void = () => {};
  let stateCallback: (value: unknown) => void = () => {}; const eventCallbacks = new Map<string, Set<(value: unknown) => void>>();
  let messageAction: (id: string) => void = () => {}; let inputAction: () => void = () => {}; let ready = false; let subscriptions = 0;
  const widgets: { root: HTMLElement; visible: boolean; destroyed: boolean; width: number; height: number; x: number; y: number }[] = [];
  const requests: { action: string; data: Record<string, unknown>; id: string; client: string; binding: string }[] = [];
  const sub = () => { subscriptions++; return () => subscriptions--; };
  let holdMessages = false; const held: unknown[] = [];
  f.api.sendToFrontend = payload => { f.replies.push(payload); if (holdMessages && requests.find(r => r.id === payload.id)?.action === 'message') held.push(payload); else onBackend(payload); };
  const ctx = {
    deferReady() {}, ready() { ready = true; },
    onBackendMessage(callback: typeof onBackend) { onBackend = callback; return sub(); },
    sendToBackend(payload: Parameters<typeof f.service.receive>[0]) { requests.push(payload as typeof requests[number]); void f.service.receive(payload, 'alice', 'ui-session'); },
    ui: {
      createFloatWidget(options: { width: number; height: number }) { const w = { root: dom.window.document.createElement('div'), visible: false, destroyed: false, x: 8, y: 8, ...options }; dom.window.document.body.append(w.root); widgets.push(w); return { ...w, root: w.root, setFullscreen(v: boolean) { w.root.dataset.fullscreen = String(v); }, setVisible(v: boolean) { w.visible = v; }, setSize(width: number, height: number) { w.width = width; w.height = height; }, getPosition() { return { x: w.x, y: w.y }; }, moveTo(x: number, y: number) { w.x = x; w.y = y; }, destroy() { w.destroyed = true; w.root.remove(); } }; },
      registerInputBarAction() { return { onClick(callback: () => void) { inputAction = callback; return sub(); }, setEnabled() {}, destroy() {} }; },
    },
    registerMessageAction(options: { onClick: (id: string) => void }) { messageAction = options.onClick; return { destroy() {} }; },
    state: { get() { return { chatId: 'chat-a' }; }, subscribe(_key: string, callback: typeof stateCallback) { stateCallback = callback; return sub(); } },
    events: { on(event: string, callback: (value: unknown) => void) { const listeners = eventCallbacks.get(event) || new Set(); listeners.add(callback); eventCallbacks.set(event, listeners); const unsubscribe = sub(); return () => { listeners.delete(callback); unsubscribe(); }; } },
    dom: {
      createElement(tag: string) { return dom.window.document.createElement(tag); },
      inject(target: Element, html: string) { const wrapper = dom.window.document.createElement('div'); wrapper.innerHTML = html; target.append(wrapper); return wrapper; },
      uninject(element: Element) { element.remove(); },
      getMessageId(el: Element) { return el.closest('[data-native-id]')?.getAttribute('data-native-id') ?? null; },
      findMessageElement(id: string) { return dom.window.document.querySelector(`[data-native-id="${id}"]`); },
      listMessageElements() { return Array.from(dom.window.document.querySelectorAll('[data-native-id]')).map(element => ({ messageId: element.getAttribute('data-native-id')!, element })); },
      createSandboxFrame() { return { element: dom.window.document.createElement('iframe'), onMessage() {}, destroy() {} }; }
    },
  };
  const teardown = setup(ctx as unknown as SpindleFrontendContext); cleanups.push(teardown);
  const root = widgets[1].root.shadowRoot!;
  const click = (selector: string) => { const element = root.querySelector<HTMLButtonElement>(selector); if (!element) throw new Error(`Missing ${selector}`); element.click(); };
  await until(() => root.querySelector('.chat-name')?.textContent === 'The Lighthouse');
  function native(id: string, content: string, top: number, height = 200) {
    const messages = f.messages.get('chat-a')!;
    if (!messages.some(m => m.id === id)) messages.push({ ...messages[0], id, content, index_in_chat: messages.length });
    const element = dom.window.document.createElement('article'); element.dataset.nativeId = id; element.innerHTML = '<p></p><button>Native action</button>'; element.querySelector('p')!.textContent = messages.find(m => m.id === id)!.content;
    const move = (next: number) => { top = next; };
    element.getBoundingClientRect = () => ({ top, bottom: top + height, left: 50, right: 650, width: 600, height, x: 50, y: top, toJSON() {} });
    dom.window.document.body.append(element); return { element, move };
  }
  async function highlight(id: string, start: number, end: number) {
    const p = dom.window.document.querySelector(`[data-native-id="${id}"] p`)!;
    const selection = dom.window.getSelection()!, range = dom.window.document.createRange(); range.setStart(p.firstChild!, start); range.setEnd(p.firstChild!, end);
    selection.removeAllRanges(); selection.addRange(range); dom.window.document.dispatchEvent(new dom.window.Event('selectionchange'));
    await new Promise(resolve => setTimeout(resolve, 190));
    return dom.window.document.querySelector('[data-kazzware-owned=selection]')!.shadowRoot!;
  }
  return { f, dom, root, widgets, requests, highlight, click, teardown, native, held, hold: () => { holdMessages = true; }, release: () => { holdMessages = false; for (const reply of held.splice(0)) onBackend(reply); }, open: () => inputAction(), get ready() { return ready; }, get subscriptions() { return subscriptions; }, select: (id: string) => messageAction(id), switch: (id: string | null) => stateCallback({ chatId: id }), event: (payload: unknown, event = 'GENERATION_ENDED') => eventCallbacks.get(event)?.forEach(fn => fn(payload)) };
}

test('plain HTTP without randomUUID starts the mascot, both menu actions, and chat switching', async () => {
  const h = await harness(true);
  expect(globalThis.crypto.randomUUID).toBeUndefined();
  expect(h.ready).toBe(true); expect(h.widgets).toHaveLength(2);
  expect(h.widgets[0].visible).toBe(true); expect(h.widgets[1].visible).toBe(false);
  h.widgets[0].root.shadowRoot!.querySelector('button')!.click(); expect(h.widgets[1].visible).toBe(true);
  h.click('.close'); expect(h.widgets[1].visible).toBe(false);
  h.open(); expect(h.widgets[1].visible).toBe(true);
  h.select('m1'); await until(() => !!h.root.querySelector('.direction'));
  expect(h.root.querySelector<HTMLElement>('.target-name')!.dataset.messageId).toBe('m1');
  const firstBind = h.requests.find(r => r.action === 'bind')!;
  h.switch('chat-b'); await until(() => h.root.querySelector('.chat-name')!.textContent === 'Other chat');
  const lastBind = h.requests.filter(r => r.action === 'bind').at(-1)!;
  expect(lastBind.client).toBe(firstBind.client); expect(lastBind.binding).not.toBe(firstBind.binding);
  expect(new Set(h.requests.map(r => r.id)).size).toBe(h.requests.length);
  h.switch(null); expect(h.widgets.every(w => !w.visible)).toBe(true);
  h.teardown(); expect(h.widgets.every(w => w.destroyed)).toBe(true); expect(h.subscriptions).toBe(0);
});

test('native highlight opens a direct editor, applies only the selection, and undoes it', async () => {
  const h = await harness(); expect(h.ready).toBe(true); expect(h.widgets[0].visible).toBe(true);
  h.native('m1', '', 250);
  const popup = await h.highlight('m1', 20, 24);
  expect(h.widgets[1].visible).toBe(false);
  const direction = popup.querySelector<HTMLInputElement>('input')!; direction.value = 'Make this plainer'; direction.dispatchEvent(new h.dom.window.Event('input'));
  h.f.outputs.push('{"replacement":"eyes"}'); popup.querySelector<HTMLButtonElement>('.apply')!.click();
  await until(() => h.f.updates.length === 1 && !popup.querySelector<HTMLButtonElement>('.undo')!.hidden);
  expect(h.requests.find(r => r.action === 'edit')!.data.range).toEqual({ start: 20, end: 24 });
  expect(h.f.updates[0].content).toBe('He watched the pale eyes. Then he waited.');
  expect(h.root.querySelector('.raw')).toBeNull();
  popup.querySelector<HTMLButtonElement>('.undo')!.click(); await until(() => h.f.updates.length === 2); expect(h.f.messages.get('chat-a')![0].content).toContain('orbs');
});
test('UI chat switch clears old prose immediately and ignores its late response', async () => {
  const h = await harness(); h.select('m1'); await until(() => !!h.root.querySelector('.direction'));
  const d = h.root.querySelector<HTMLTextAreaElement>('.direction')!; d.value = 'Shorten'; d.dispatchEvent(new h.dom.window.Event('input'));
  const gate = deferred(); h.f.setGate(() => gate.promise); h.f.outputs.push('{"replacement":"Delayed edit"}'); h.click('.apply'); await until(() => h.f.modelInputs.length === 1);
  h.switch('chat-b'); expect(h.root.textContent).not.toContain('orbs'); gate.resolve();
  await until(() => h.root.querySelector('.chat-name')!.textContent === 'Other chat'); expect(h.f.updates).toHaveLength(0);
  h.switch(null); expect(h.widgets.every(w => !w.visible)).toBe(true);
});
test('settings persist the selected connection and teardown removes resources', async () => {
  const h = await harness(); h.click('[data-tab=settings]');
  expect(h.dom.window.document.querySelectorAll('[data-kazzware-font]')).toHaveLength(1);
  const interval = h.root.querySelector<HTMLInputElement>('.interval')!; interval.value = '3'; interval.dispatchEvent(new h.dom.window.Event('input')); h.click('.save-settings');
  await until(() => h.f.state().settings.interval === 3); expect(h.f.state().settings.connectionId).toBe('connection');
  h.teardown(); expect(h.widgets.every(w => w.destroyed)).toBe(true); expect(h.subscriptions).toBe(0);
  expect(h.dom.window.document.querySelectorAll('[data-kazzware-font]')).toHaveLength(0);
});
test('narrow screens keep a smaller floating surface that can be moved', async () => {
  const h = await harness(); Object.defineProperty(h.dom.window, 'innerWidth', { value: 390, configurable: true });
  h.dom.window.dispatchEvent(new h.dom.window.Event('resize'));
  expect(h.widgets[1].root.dataset.fullscreen).toBe('false'); expect(h.widgets[1].width).toBeCloseTo(299.2); expect(h.widgets[1].height).toBeLessThanOrEqual(688); expect(h.widgets[0].root.dataset.fullscreen).toBeUndefined();
});
test('highlight-only UI edits preserve CRLF outside the selected text', async () => {
  const h = await harness(); h.f.messages.get('chat-a')![0].content = 'First\r\nold\r\nlast';
  h.native('m1', '', 250); const popup = await h.highlight('m1', 7, 10);
  popup.querySelector<HTMLButtonElement>('.more')!.click();
  expect(h.root.querySelector('.range')!.textContent).toContain('3 characters only');
  const input = h.root.querySelector<HTMLTextAreaElement>('.direction')!; input.value = 'Replace'; input.dispatchEvent(new h.dom.window.Event('input'));
  h.f.outputs.push('{"replacement":"new"}'); h.click('.apply'); await until(() => h.f.updates.length === 1);
  expect(h.f.updates[0].content).toBe('First\r\nnew\r\nlast');
});

const settleView = () => new Promise(resolve => setTimeout(resolve, 280));
test('follow view settles on the reading line and typing pins the message through scroll and generation', async () => {
  const h = await harness(); const first = h.native('m1', '', 250); const second = h.native('m3', 'Second message.', 850);
  h.open(); h.click('[data-tab=edit]'); await settleView();
  expect(h.root.querySelector<HTMLElement>('.target-name')!.dataset.messageId).toBe('m1');
  expect(first.element.hasAttribute('data-kazzware-target')).toBe(true);
  first.move(-300); second.move(250); h.dom.window.document.dispatchEvent(new h.dom.window.Event('scroll')); await settleView();
  expect(h.root.querySelector<HTMLElement>('.target-name')!.dataset.messageId).toBe('m3');
  expect(first.element.hasAttribute('data-kazzware-target')).toBe(false);
  const input = h.root.querySelector<HTMLTextAreaElement>('.direction')!; input.value = 'Make it short'; input.dispatchEvent(new h.dom.window.Event('input'));
  expect(h.root.querySelector('.follow-target')!.getAttribute('aria-pressed')).toBe('false');
  first.move(250); second.move(850); h.dom.window.document.dispatchEvent(new h.dom.window.Event('scroll')); await settleView();
  expect(h.root.querySelector<HTMLElement>('.target-name')!.dataset.messageId).toBe('m3');
  const gate = deferred(); h.f.setGate(() => gate.promise); h.f.outputs.push('{"replacement":"Short."}'); h.click('.apply');
  await until(() => h.f.modelInputs.length === 1); expect(h.root.querySelector<HTMLButtonElement>('.pick-message')!.disabled).toBe(true);
  gate.resolve(); await until(() => h.f.updates.length === 1); expect(h.f.updates[0].id).toBe('m3');
  await until(() => !h.root.querySelector<HTMLButtonElement>('.follow-target')!.disabled);
  h.click('.follow-target'); await settleView();
  expect(h.root.querySelector<HTMLElement>('.target-name')!.dataset.messageId).toBe('m1'); expect(h.root.querySelector<HTMLTextAreaElement>('.direction')!.value).toBe('');
});

test('native picking consumes only the chosen click, Escape cancels, and teardown removes markers/listeners', async () => {
  const h = await harness(); const first = h.native('m1', '', 250); const second = h.native('m3', 'Pick me.', 600);
  let nativeClicks = 0; const nativeButton = second.element.querySelector('button')!; nativeButton.addEventListener('click', () => nativeClicks++);
  h.open(); await settleView(); h.click('.pick-message');
  expect(h.root.querySelector('.shell')!.classList.contains('picking')).toBe(true);
  nativeButton.click(); await until(() => h.root.querySelector<HTMLElement>('.target-name')?.dataset.messageId === 'm3');
  expect(nativeClicks).toBe(0); expect(h.root.querySelector('.follow-target')!.getAttribute('aria-pressed')).toBe('false');
  h.click('.pick-message'); h.dom.window.document.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(h.root.querySelector('.shell')!.classList.contains('picking')).toBe(false); expect(h.widgets[1].visible).toBe(true);
  nativeButton.click(); expect(nativeClicks).toBe(1);
  h.click('.pick-message'); h.switch(null); expect(h.dom.window.document.querySelector('[data-kazzware-target]')).toBeNull();
  h.teardown(); nativeButton.click(); expect(nativeClicks).toBe(2); expect(first.element.hasAttribute('data-kazzware-target')).toBe(false);
});

test('late follow responses cannot replace a pinned target or leak into another chat', async () => {
  const h = await harness(); const first = h.native('m1', '', 250); const second = h.native('m3', 'Later message.', 850);
  h.open(); h.click('[data-tab=edit]'); await settleView();
  h.hold(); first.move(-300); second.move(250); h.dom.window.document.dispatchEvent(new h.dom.window.Event('scroll')); await settleView(); expect(h.held.length).toBe(1);
  const input = h.root.querySelector<HTMLTextAreaElement>('.direction')!; input.value = 'Stay here'; input.dispatchEvent(new h.dom.window.Event('input'));
  h.release(); await settleView(); expect(h.root.querySelector<HTMLElement>('.target-name')!.dataset.messageId).toBe('m1');
  h.hold(); h.click('.follow-target'); await settleView(); expect(h.held.length).toBe(1);
  h.switch('chat-b'); first.element.remove(); second.element.remove(); h.release();
  await until(() => h.root.querySelector('.chat-name')!.textContent === 'Other chat');
  expect(h.root.querySelector('.direction')).toBeNull(); expect(h.dom.window.document.querySelector('[data-kazzware-target]')).toBeNull();
});

test('changing a manual target clears the old editor while loading; missing visible messages clear a followed target', async () => {
  const h = await harness(); const first = h.native('m1', '', 250); h.native('m3', 'New target.', 900);
  h.open(); h.click('[data-tab=edit]'); await settleView(); h.hold(); h.select('m3');
  expect(h.root.querySelector('.direction')).toBeNull(); await until(() => h.held.length === 1); h.release();
  await until(() => h.root.querySelector<HTMLElement>('.target-name')?.dataset.messageId === 'm3');
  h.click('.follow-target'); await settleView(); expect(h.root.querySelector<HTMLElement>('.target-name')!.dataset.messageId).toBe('m1');
  first.element.remove(); await settleView(); expect(h.root.querySelector('.direction')).toBeNull();
  expect(h.root.querySelector('.target-name')!.textContent).toBe('No message in view');
});

test('cancelling a pick resumes following even when the earlier selection reply is still pending', async () => {
  const h = await harness(); h.native('m1', '', 250); h.hold(); h.open(); await settleView(); expect(h.held.length).toBe(1);
  h.click('.pick-message'); h.click('.cancel-pick'); await settleView(); expect(h.held.length).toBe(2);
  h.release(); await until(() => h.root.querySelector('.target-name')!.textContent === '#1 · Elias');
  expect(h.root.querySelector('.follow-target')!.getAttribute('aria-pressed')).toBe('true');
});

test('scrolling back to the loaded message invalidates a slower reply for the message passed over', async () => {
  const h = await harness(); const first = h.native('m1', '', 250); const second = h.native('m3', 'Scrolled past.', 850);
  h.open(); await settleView(); h.hold(); first.move(-300); second.move(250);
  h.dom.window.document.dispatchEvent(new h.dom.window.Event('scroll')); await settleView(); expect(h.held.length).toBe(1);
  first.move(250); second.move(850); h.dom.window.document.dispatchEvent(new h.dom.window.Event('scroll')); await settleView();
  h.release(); await settleView(); expect(h.root.querySelector('.target-name')!.textContent).toBe('#1 · Elias');
  expect(first.element.hasAttribute('data-kazzware-target')).toBe(true);
});


test('ambiguous native highlights never fall back to a whole-message edit; closing can be followed by a new selection', async () => {
  const h = await harness(); h.f.messages.get('chat-a')![0].content = 'echo and echo'; h.native('m1', '', 250);
  const popup = await h.highlight('m1', 0, 4);
  expect(popup.querySelector('.feedback')!.textContent).toContain('Cannot match');
  expect(popup.querySelector<HTMLButtonElement>('.apply')!.disabled).toBe(true);
  expect(popup.querySelector<HTMLButtonElement>('.more')!.disabled).toBe(true);
  expect(h.requests.some(r => r.action === 'edit')).toBe(false);
  popup.querySelector<HTMLButtonElement>('.close')!.click();
  expect(h.dom.window.document.querySelector<HTMLElement>('[data-kazzware-owned=selection]')!.hidden).toBe(true);
  await h.highlight('m1', 5, 8); expect(popup.querySelector<HTMLButtonElement>('.more')!.disabled).toBe(false);
  h.switch('chat-b'); expect(h.dom.window.document.querySelector<HTMLElement>('[data-kazzware-owned=selection]')!.hidden).toBe(true);
});

test('a late highlight lookup cannot reopen the prompt after a chat change or dismissal', async () => {
  const h = await harness(); h.native('m1', '', 250); h.hold();
  const popup = await h.highlight('m1', 20, 24); expect(h.held.length).toBe(1);
  popup.querySelector<HTMLButtonElement>('.close')!.click(); h.release();
  expect(popup.querySelector<HTMLButtonElement>('.more')!.disabled).toBe(true);
  expect(h.dom.window.document.querySelector<HTMLElement>('[data-kazzware-owned=selection]')!.hidden).toBe(true);
  h.hold(); await h.highlight('m1', 3, 10); h.switch('chat-b'); h.release();
  await until(() => h.root.querySelector('.chat-name')!.textContent === 'Other chat');
  expect(h.dom.window.document.querySelector<HTMLElement>('[data-kazzware-owned=selection]')!.hidden).toBe(true);
  h.teardown(); expect(h.dom.window.document.querySelector('[data-kazzware-owned=selection]')).toBeNull();
});

test('a stale native highlight refuses an edit when the underlying swipe or text changed', async () => {
  const h = await harness(); h.native('m1', '', 250); const popup = await h.highlight('m1', 20, 24);
  h.f.messages.get('chat-a')![0].content = 'Manually changed';
  const input = popup.querySelector<HTMLInputElement>('input')!; input.value = 'Replace'; input.dispatchEvent(new h.dom.window.Event('input'));
  popup.querySelector<HTMLButtonElement>('.apply')!.click();
  await until(() => popup.querySelector('.feedback')!.classList.contains('error'));
  expect(h.f.updates).toHaveLength(0); expect(h.f.modelInputs).toHaveLength(0);
});

test('refreshing a changed message retires a transferred highlight instead of widening it', async () => {
  const h = await harness(); h.native('m1', '', 250); const popup = await h.highlight('m1', 20, 24);
  popup.querySelector<HTMLButtonElement>('.more')!.click(); expect(h.root.querySelector('.range')!.textContent).toContain('4 characters only');
  h.f.messages.get('chat-a')![0].content = 'A newer manual version';
  h.click('[data-tab=settings]'); h.click('.reload-state');
  await until(() => h.root.querySelector('.status')!.textContent!.includes('Reloaded.'));
  h.click('[data-tab=edit]'); expect(h.root.querySelector('.apply')).toBeNull(); expect(h.root.querySelector('.direction')).toBeNull();
});

test('extending a native highlight across messages discards the earlier partial selection', async () => {
  const h = await harness(); const a = h.native('m1', '', 250), b = h.native('m3', 'Another message', 600);
  await h.highlight('m1', 20, 24);
  const range = h.dom.window.document.createRange(); range.setStart(a.element.querySelector('p')!.firstChild!, 0); range.setEnd(b.element.querySelector('p')!.firstChild!, 7);
  const selection = h.dom.window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  h.dom.window.document.dispatchEvent(new h.dom.window.Event('selectionchange'));
  expect(h.dom.window.document.querySelector<HTMLElement>('[data-kazzware-owned=selection]')!.hidden).toBe(true);
  expect(h.requests.some(r => r.action === 'edit')).toBe(false);
});


test('selection surface waits through a held mouse/touch gesture and debounces keyboard changes', async () => {
  const h = await harness(); const message = h.native('m1', '', 250);
  const portal = document.querySelector<HTMLElement>('[data-kazzware-owned=selection]')!;
  message.element.dispatchEvent(new h.dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  await h.highlight('m1', 0, 2); expect(portal.hidden).toBe(true);
  await h.highlight('m1', 0, 10); expect(portal.hidden).toBe(true);
  expect(h.requests.filter(r => r.action === 'message')).toHaveLength(0);
  h.dom.window.dispatchEvent(new h.dom.window.Event('pointerup'));
  expect(portal.hidden).toBe(true); await new Promise(r => setTimeout(r, 190));
  expect(portal.hidden).toBe(false); expect(portal.shadowRoot!.querySelector('.quote')!.textContent).toBe('He watched');
  // A fresh keyboard selection is hidden immediately and appears only after settling.
  const selection = h.dom.window.getSelection()!, range = selection.getRangeAt(0); range.setEnd(message.element.querySelector('p')!.firstChild!, 15);
  document.dispatchEvent(new h.dom.window.Event('selectionchange'));
  expect(portal.hidden).toBe(true);
  await new Promise(r => setTimeout(r, 80)); range.setEnd(message.element.querySelector('p')!.firstChild!, 24);
  document.dispatchEvent(new h.dom.window.Event('selectionchange'));
  await new Promise(r => setTimeout(r, 100)); expect(portal.hidden).toBe(true);
  await new Promise(r => setTimeout(r, 90)); expect(portal.hidden).toBe(false);
  expect(portal.shadowRoot!.querySelector('.quote')!.textContent).toBe('He watched the pale orbs');
  message.element.dispatchEvent(new h.dom.window.MouseEvent('pointerdown', { bubbles: true }));
  h.dom.window.dispatchEvent(new h.dom.window.Event('pointercancel'));
  await new Promise(r => setTimeout(r, 190)); expect(portal.hidden).toBe(true);
});

test('opening beside a moved mascot preserves its position through navigation and close/reopen', async () => {
  const h = await harness(), pet = h.widgets[0], panel = h.widgets[1];
  const button = pet.root.shadowRoot!.querySelector('button')!;
  button.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
  button.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
  const original = { x: pet.x, y: pet.y }; button.click();
  expect(panel.x).toBe(original.x + 110 + 12); expect(panel.y).toBeGreaterThanOrEqual(8);
  h.click('[data-tab=settings]'); expect({ x: pet.x, y: pet.y }).toEqual(original);
  const position = { x: panel.x, y: panel.y }; h.click('[data-tab=chat]'); expect({ x: panel.x, y: panel.y }).toEqual(position);
  h.click('.close'); expect({ x: pet.x, y: pet.y }).toEqual(original);
  button.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
  button.click(); expect(panel.x).toBe(original.x + 40 + 110 + 12); expect(pet.x).toBe(original.x + 40);
});

async function enableCommentary(h: Awaited<ReturnType<typeof harness>>) {
  h.open(); h.click('[data-tab=settings]');
  const checkbox = h.root.querySelector<HTMLInputElement>('.commentary-enabled')!; checkbox.checked = true;
  h.click('.save-settings'); await until(() => h.f.state().settings.commentaryEnabled);
  await until(() => !h.root.querySelector<HTMLButtonElement>('.save-settings')!.disabled); h.click('.close');
}
test('opt-in commentary handles messages and swipes without opening the menu or writing to chat', async () => {
  const h = await harness(); const event = { chatId: 'chat-a', messageId: 'm1', generationType: 'normal' };
  h.event(event); await settleView(); expect(h.f.modelInputs).toHaveLength(0);
  await enableCommentary(h); h.f.outputs.push('Well, that is suspicious as hell.');
  h.event(event); await until(() => h.f.modelInputs.length === 1);
  const portal = document.querySelector<HTMLElement>('[data-kazzware-owned=commentary]')!;
  await until(() => !portal.hidden); expect(portal.textContent).toBe('');
  expect(portal.shadowRoot!.querySelector('span')!.textContent).toContain('suspicious');
  expect(h.widgets[1].visible).toBe(false); expect(h.f.updates).toHaveLength(0);
  h.event({ chatId: 'chat-a', message: h.f.messages.get('chat-a')![0] }, 'MESSAGE_SENT'); await settleView();
  expect(h.f.modelInputs).toHaveLength(1);
  portal.shadowRoot!.querySelector('button')!.click(); expect(portal.hidden).toBe(true);
  h.event(event); await settleView(); expect(portal.hidden).toBe(true);
  const message = h.f.messages.get('chat-a')![0]; message.swipe_id = 1; message.content = 'The door opened.';
  h.f.outputs.push('Doors. Always a terrible idea.');
  h.event({ chatId: 'chat-a', message, action: 'navigated' }, 'MESSAGE_SWIPED');
  await until(() => h.f.modelInputs.length === 2); await until(() => !portal.hidden);
  expect(portal.shadowRoot!.querySelector('span')!.textContent).toContain('Doors.');
  h.event({ ...event, generationType: 'quiet' }); h.event({ ...event, error: 'Failed' });
  await settleView(); expect(h.f.modelInputs).toHaveLength(2);
});

test('switching commentary off cancels its pending response and prevents a late bubble', async () => {
  const h = await harness(); await enableCommentary(h);
  const gate = deferred(); h.f.setGate(() => gate.promise); h.f.outputs.push('Too late.');
  h.event({ chatId: 'chat-a', messageId: 'm1', generationType: 'swipe' });
  await until(() => h.f.modelInputs.length === 1);
  h.open(); h.click('[data-tab=settings]'); h.root.querySelector<HTMLInputElement>('.commentary-enabled')!.checked = false; h.click('.save-settings');
  expect((h.f.modelInputs[0] as { signal: AbortSignal }).signal.aborted).toBe(true);
  gate.resolve(); await until(() => !h.f.state().settings.commentaryEnabled); h.click('.close');
  await settleView(); expect(document.querySelector<HTMLElement>('[data-kazzware-owned=commentary]')!.hidden).toBe(true);
  h.event({ chatId: 'chat-a', messageId: 'm1', generationType: 'normal' }); await settleView(); expect(h.f.modelInputs).toHaveLength(1);
});
