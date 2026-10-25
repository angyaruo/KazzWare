import { afterEach, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import type { SpindleFrontendContext } from 'lumiverse-spindle-types';
import { setup } from '../src/frontend';
import { deferred, fake, until } from './fake';
const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
async function harness(plainHTTP = false) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: plainHTTP ? 'http://192.0.2.1:7860' : 'https://lumiverse.test' });
  // jsdom does not enforce secure-context restrictions; match a browser on LAN HTTP.
  if (plainHTTP) Object.defineProperty(dom.window.crypto, 'randomUUID', { value: undefined });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, Node: dom.window.Node, Element: dom.window.Element, crypto: dom.window.crypto })) { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value }); }
  cleanups.push(() => { dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  const f = fake(); await f.ready(); let onBackend: (payload: unknown) => void = () => {};
  let stateCallback: (value: unknown) => void = () => {}; let eventCallback: (value: unknown) => void = () => {};
  let messageAction: (id: string) => void = () => {}; let inputAction: () => void = () => {}; let ready = false; let subscriptions = 0;
  const widgets: { root: HTMLElement; visible: boolean; destroyed: boolean; width: number; height: number }[] = [];
  const requests: { action: string; data: Record<string, unknown>; id: string; client: string; binding: string }[] = [];
  const sub = () => { subscriptions++; return () => subscriptions--; };
  f.api.sendToFrontend = payload => { f.replies.push(payload); onBackend(payload); };
  const ctx = {
    deferReady() {}, ready() { ready = true; },
    onBackendMessage(callback: typeof onBackend) { onBackend = callback; return sub(); },
    sendToBackend(payload: Parameters<typeof f.service.receive>[0]) { requests.push(payload as typeof requests[number]); void f.service.receive(payload, 'alice', 'ui-session'); },
    ui: {
      createFloatWidget(options: { width: number; height: number }) { const w = { root: dom.window.document.createElement('div'), visible: false, destroyed: false, ...options }; dom.window.document.body.append(w.root); widgets.push(w); return { ...w, root: w.root, setFullscreen(v: boolean) { w.root.dataset.fullscreen = String(v); }, setVisible(v: boolean) { w.visible = v; }, setSize(width: number, height: number) { w.width = width; w.height = height; }, getPosition() { return { x: 8, y: 8 }; }, moveTo() {}, destroy() { w.destroyed = true; w.root.remove(); } }; },
      registerInputBarAction() { return { onClick(callback: () => void) { inputAction = callback; return sub(); }, setEnabled() {}, destroy() {} }; },
    },
    registerMessageAction(options: { onClick: (id: string) => void }) { messageAction = options.onClick; return { destroy() {} }; },
    state: { get() { return { chatId: 'chat-a' }; }, subscribe(_key: string, callback: typeof stateCallback) { stateCallback = callback; return sub(); } },
    events: { on(_event: string, callback: typeof eventCallback) { eventCallback = callback; return sub(); } },
    dom: { getMessageId() { return null; }, createSandboxFrame() { return { element: dom.window.document.createElement('iframe'), onMessage() {}, destroy() {} }; } },
  };
  const teardown = setup(ctx as unknown as SpindleFrontendContext); cleanups.push(teardown);
  const root = widgets[1].root.shadowRoot!;
  const click = (selector: string) => { const element = root.querySelector<HTMLButtonElement>(selector); if (!element) throw new Error(`Missing ${selector}`); element.click(); };
  await until(() => root.querySelector('.chat-name')?.textContent === 'The Lighthouse');
  return { f, dom, root, widgets, requests, click, teardown, open: () => inputAction(), get ready() { return ready; }, get subscriptions() { return subscriptions; }, select: (id: string) => messageAction(id), switch: (id: string | null) => stateCallback({ chatId: id }), event: (payload: unknown) => eventCallback(payload) };
}

test('plain HTTP without randomUUID starts the mascot, both menu actions, and chat switching', async () => {
  const h = await harness(true);
  expect(globalThis.crypto.randomUUID).toBeUndefined();
  expect(h.ready).toBe(true); expect(h.widgets).toHaveLength(2);
  expect(h.widgets[0].visible).toBe(true); expect(h.widgets[1].visible).toBe(false);
  h.widgets[0].root.shadowRoot!.querySelector('button')!.click(); expect(h.widgets[1].visible).toBe(true);
  h.click('.close'); expect(h.widgets[1].visible).toBe(false);
  h.open(); expect(h.widgets[1].visible).toBe(true);
  h.select('m1'); await until(() => !!h.root.querySelector('.raw'));
  expect(h.root.querySelector<HTMLTextAreaElement>('.raw')!.value).toContain('orbs');
  const firstBind = h.requests.find(r => r.action === 'bind')!;
  h.switch('chat-b'); await until(() => h.root.querySelector('.chat-name')!.textContent === 'Other chat');
  const lastBind = h.requests.filter(r => r.action === 'bind').at(-1)!;
  expect(lastBind.client).toBe(firstBind.client); expect(lastBind.binding).not.toBe(firstBind.binding);
  expect(new Set(h.requests.map(r => r.id)).size).toBe(h.requests.length);
  h.switch(null); expect(h.widgets.every(w => !w.visible)).toBe(true);
  h.teardown(); expect(h.widgets.every(w => w.destroyed)).toBe(true); expect(h.subscriptions).toBe(0);
});

test('UI selects a source range, applies without a confirmation screen, and undoes it', async () => {
  const h = await harness(); expect(h.ready).toBe(true); expect(h.widgets[0].visible).toBe(true);
  h.select('m1'); await until(() => !!h.root.querySelector('.raw'));
  const raw = h.root.querySelector<HTMLTextAreaElement>('.raw')!; raw.setSelectionRange(20, 24); raw.dispatchEvent(new h.dom.window.Event('select'));
  const direction = h.root.querySelector<HTMLTextAreaElement>('.direction')!; direction.value = 'Make this plainer'; direction.dispatchEvent(new h.dom.window.Event('input'));
  h.f.outputs.push('{"replacement":"eyes"}'); h.click('.apply');
  await until(() => h.f.updates.length === 1 && !!h.root.querySelector('[data-undo]'));
  expect(h.requests.find(r => r.action === 'edit')!.data.range).toEqual({ start: 20, end: 24 });
  expect(h.root.textContent).toContain('Edit completed');
  h.click('[data-undo]'); await until(() => h.f.updates.length === 2); expect(h.f.messages.get('chat-a')![0].content).toContain('orbs');
});
test('UI chat switch clears old prose immediately and ignores its late response', async () => {
  const h = await harness(); h.select('m1'); await until(() => !!h.root.querySelector('.raw'));
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
test('narrow screens use the host fullscreen surface for native mobile scrolling', async () => {
  const h = await harness(); Object.defineProperty(h.dom.window, 'innerWidth', { value: 390, configurable: true });
  h.dom.window.dispatchEvent(new h.dom.window.Event('resize'));
  expect(h.widgets[1].root.dataset.fullscreen).toBe('true'); expect(h.widgets[0].root.dataset.fullscreen).toBeUndefined();
});
test('highlight-only UI edits preserve CRLF outside the selected text', async () => {
  const h = await harness(); h.f.messages.get('chat-a')![0].content = 'First\r\nold\r\nlast';
  h.select('m1'); await until(() => !!h.root.querySelector('.raw'));
  const raw = h.root.querySelector<HTMLTextAreaElement>('.raw')!; expect(raw.value).toBe('First\nold\nlast'); raw.setSelectionRange(6, 9); raw.dispatchEvent(new h.dom.window.Event('select'));
  const input = h.root.querySelector<HTMLTextAreaElement>('.direction')!; input.value = 'Replace'; input.dispatchEvent(new h.dom.window.Event('input'));
  h.f.outputs.push('{"replacement":"new"}'); h.click('.apply'); await until(() => h.f.updates.length === 1);
  expect(h.f.updates[0].content).toBe('First\r\nnew\r\nlast');
});
