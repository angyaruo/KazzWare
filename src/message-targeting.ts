import type { SpindleDOMHelper } from 'lumiverse-spindle-types';

/** Find the mounted message nearest the reading line inside its visible scrollport.
 * Use the host's public DOM API, never its private message attributes/classes.
 * Clipping matters: virtualized/offscreen messages can still have DOM elements.
 */
export function messageInView(dom: Pick<SpindleDOMHelper, 'listMessageElements'>): string | null {
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const bottom = top + (viewport?.height || window.innerHeight);
  const left = viewport?.offsetLeft ?? 0;
  const right = left + (viewport?.width || window.innerWidth);
  const clips = new Map<Element, { top: number; bottom: number; left: number; right: number }>();
  let best: { id: string; distance: number; visible: number } | undefined;
  for (const { messageId, element } of dom.listMessageElements()) {
    if (!element.isConnected) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    let clip = { top, bottom, left, right };
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      let bounds = clips.get(parent);
      if (!bounds) {
        const style = window.getComputedStyle(parent), box = parent.getBoundingClientRect();
        const y = /auto|scroll|hidden|clip/.test(style.overflowY);
        const x = /auto|scroll|hidden|clip/.test(style.overflowX);
        bounds = { top: y ? box.top : top, bottom: y ? box.bottom : bottom, left: x ? box.left : left, right: x ? box.right : right };
        clips.set(parent, bounds);
      }
      clip = { top: Math.max(clip.top, bounds.top), bottom: Math.min(clip.bottom, bounds.bottom), left: Math.max(clip.left, bounds.left), right: Math.min(clip.right, bounds.right) };
    }
    const visibleTop = Math.max(rect.top, clip.top), visibleBottom = Math.min(rect.bottom, clip.bottom);
    if (visibleBottom - visibleTop < 8 || Math.min(rect.right, clip.right) <= Math.max(rect.left, clip.left)) continue;
    const readingLine = clip.top + (clip.bottom - clip.top) * .48;
    const distance = Math.max(visibleTop - readingLine, readingLine - visibleBottom, 0);
    const visible = visibleBottom - visibleTop;
    if (!best || distance < best.distance || (distance === best.distance && visible > best.visible)) best = { id: messageId, distance, visible };
  }
  return best?.id ?? null;
}
