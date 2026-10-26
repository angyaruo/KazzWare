import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { messageInView } from '../src/message-targeting';

test('reading line respects ancestor clipping and rejects offscreen, detached and zero-size messages', () => {
  const dom = new JSDOM('<div id="scroller" style="overflow-y:auto"></div>');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  try {
    const box = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 500, width: 500, height, x: 0, y: top, toJSON() {} });
    const scroller = dom.window.document.querySelector('#scroller')!;
    scroller.getBoundingClientRect = () => box(100, 400);
    const mounted = (id: string, top: number, height: number) => { const element = dom.window.document.createElement('article'); element.getBoundingClientRect = () => box(top, height); scroller.append(element); return { messageId: id, element }; };
    const first = mounted('first', 110, 80), centered = mounted('center', 220, 230), clipped = mounted('clipped', 501, 200), zero = mounted('zero', 300, 0), detached = mounted('detached', 0, 900);
    detached.element.remove();
    const list = [first, centered, clipped, zero, detached];
    expect(messageInView({ listMessageElements: () => list })).toBe('center');
    centered.element.remove(); expect(messageInView({ listMessageElements: () => list })).toBe('first');
    first.element.remove(); expect(messageInView({ listMessageElements: () => list })).toBeNull();
    const long = mounted('long', -900, 1500); list.push(long);
    expect(messageInView({ listMessageElements: () => list })).toBe('long');
  } finally { dom.window.close(); if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});
