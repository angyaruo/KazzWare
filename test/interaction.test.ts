import { afterEach, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import type { SpindleDOMHelper } from 'lumiverse-spindle-types';
import { draggable } from '../src/drag';
import { inlineGallery } from '../src/inline-gallery';
import { nativeRange, readNativeSelection } from '../src/native-selection';
import { deferred, until } from './fake';
import type { GalleryPage } from '../src/shared';

const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
function browser() {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, Node: dom.window.Node, Element: dom.window.Element })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  cleanups.push(() => { dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  return dom.window;
}

test('mouse and touch drags move the widget, suppress only the drag click, and clean up capture', () => {
  const win = browser(), root = document.createElement('div'), handle = document.createElement('button'); root.append(handle); document.body.append(root);
  let position = { x: 100, y: 100 }, captured: number | undefined, clicks = 0;
  // A zoomed host: physical dimensions are 1.5 times the widget's layout size.
  Object.defineProperty(root, 'offsetWidth', { value: 100 });
  root.getBoundingClientRect = () => ({ width: 150, height: 150 }) as DOMRect;
  handle.setPointerCapture = id => { captured = id; }; handle.hasPointerCapture = id => captured === id; handle.releasePointerCapture = () => { captured = undefined; };
  const drag = draggable(handle, { root, getPosition: () => position, moveTo: (x, y) => { position = { x, y }; } });
  cleanups.push(drag.destroy); handle.addEventListener('click', () => clicks++);
  function pointer(type: string, x: number, y: number, id = 1, pointerType = 'mouse') {
    const event = new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: pointerType }, isPrimary: { value: true } });
    (type === 'pointerdown' ? handle : win).dispatchEvent(event);
  }
  pointer('pointerdown', 50, 50); pointer('pointerup', 52, 52); handle.dispatchEvent(new win.MouseEvent('click', { detail: 1 })); expect(clicks).toBe(1);
  pointer('pointerdown', 50, 50); pointer('pointermove', 125, 80); pointer('pointerup', 125, 80);
  expect(position).toEqual({ x: 150, y: 120 }); expect(captured).toBeUndefined();
  handle.dispatchEvent(new win.MouseEvent('click', { detail: 1 })); expect(clicks).toBe(1);
  handle.dispatchEvent(new win.MouseEvent('click', { detail: 0 })); expect(clicks).toBe(2);
  pointer('pointerdown', 100, 100, 2, 'touch'); pointer('pointermove', 130, 130, 3, 'touch'); expect(position.x).toBe(150);
  pointer('pointermove', 130, 130, 2, 'touch'); pointer('pointercancel', 130, 130, 2, 'touch'); expect(position).toEqual({ x: 170, y: 140 }); expect(captured).toBeUndefined();
  const imageDrag = new win.Event('dragstart', { cancelable: true }); handle.dispatchEvent(imageDrag); expect(imageDrag.defaultPrevented).toBe(true);
  pointer('pointerdown', 100, 100); drag.destroy(); pointer('pointermove', 200, 200); expect(position.x).toBe(170);
});

test('native ranges preserve Unicode and CRLF; ambiguous or markup-altered text is rejected', () => {
  expect(nativeRange('A\r\nB\r\nC', 'A\nB')).toEqual({ start: 0, end: 4 });
  expect(nativeRange('His **cold eyes** watched.', 'cold eyes')).toEqual({ start: 6, end: 15 });
  expect(nativeRange('His **cold** eyes watched.', 'cold eyes')).toBeUndefined();
  expect(nativeRange('echo and echo', 'echo')).toBeUndefined();
  expect(nativeRange('A\r\nB then A\nB', 'A\nB')).toBeUndefined();
  expect(nativeRange('A 🦂 waits.', '🦂')).toEqual({ start: 2, end: 4 });
});

test('native selection ignores message controls and highlights spanning different messages', () => {
  const win = browser(); document.body.innerHTML = '<article id="a"><p>One message</p><button>One message</button></article><article id="b"><p>Another message</p></article>';
  const dom = { getMessageId: (el: Element) => el.closest('article')?.id || null } as SpindleDOMHelper;
  const select = (start: Node, end: Node) => { const range = document.createRange(); range.setStart(start, 0); range.setEnd(end, 3); const selection = win.getSelection()!; selection.removeAllRanges(); selection.addRange(range); };
  select(document.querySelector('#a p')!.firstChild!, document.querySelector('#a p')!.firstChild!); expect(readNativeSelection(dom)?.messageId).toBe('a');
  select(document.querySelector('#a p')!.firstChild!, document.querySelector('#b p')!.firstChild!); expect(readNativeSelection(dom)).toBeUndefined();
  select(document.querySelector('button')!.firstChild!, document.querySelector('button')!.firstChild!); expect(readNativeSelection(dom)).toBeUndefined();
});

test('inline Gallery restores one entry per page, isolates reactions, and retires frames and injections', async () => {
  browser(); const article = document.createElement('article'); document.body.append(article);
  const page: GalleryPage = { id: 'page', throughMessage: 'm1', title: '<script>no</script>', format: 'forum', createdAt: 0, posts: [{ id: 'post', author: 'fan', title: 'title', body: 'body' }], votes: [], comments: [] };
  const injections: Element[] = [], retired: Element[] = [], frames: { destroyed: boolean; send(data: unknown): void }[] = [], reactions: unknown[] = [];
  let gate: ReturnType<typeof deferred> | undefined;
  const dom = {
    findMessageElement: () => article.isConnected ? article : null,
    inject: (target: Element) => { const wrapper = document.createElement('div'); target.append(wrapper); injections.push(wrapper); return wrapper; },
    uninject: (element: Element) => { retired.push(element); element.remove(); },
    createSandboxFrame: () => {
      const element = document.createElement('iframe'), state = { destroyed: false, send: (_: unknown) => {} }; frames.push(state);
      return { element, onMessage(callback: (data: unknown) => void) { state.send = callback; }, destroy() { state.destroyed = true; element.remove(); } };
    },
  } as unknown as SpindleDOMHelper;
  const gallery = inlineGallery(dom, async () => { if (gate) await gate.promise; return page; }, async data => { reactions.push(data); return true; }); cleanups.push(gallery.clear);
  gallery.sync([page], false); expect(injections).toHaveLength(0);
  gallery.sync([page], true); gallery.sync([page], true); expect(injections).toHaveLength(1);
  const shadow = injections[0].shadowRoot!; expect(shadow.querySelector('script')).toBeNull();
  shadow.querySelector<HTMLButtonElement>('.toggle')!.click(); await until(() => frames.length === 1);
  frames[0].send({ kind: 'vote', postId: 'foreign' }); expect(reactions).toHaveLength(0);
  frames[0].send({ kind: 'vote', postId: 'post' }); await until(() => frames.length === 2);
  expect(reactions).toEqual([{ pageId: 'page', kind: 'vote', postId: 'post', text: undefined }]); expect(frames[0].destroyed).toBe(true);
  // Model the documented host replay: it moves the same injection and handlers.
  article.remove(); gallery.sync([page], true); document.body.append(article); gallery.sync([page], true); expect(injections).toHaveLength(1);
  shadow.querySelector<HTMLButtonElement>('.toggle')!.click(); expect(frames[1].destroyed).toBe(true);
  gate = deferred(); shadow.querySelector<HTMLButtonElement>('.toggle')!.click(); gallery.clear(); gate.resolve(); await Promise.resolve();
  expect(retired).toHaveLength(1); expect(document.querySelector('[data-kazzware-owned=gallery]')).toBeNull(); expect(frames).toHaveLength(2);
});
