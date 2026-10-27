import type { SpindleDOMHelper } from 'lumiverse-spindle-types';
import { uniqueRange, type Range } from './shared';

export type NativeSelection = { messageId: string; text: string; domRange: globalThis.Range };
export function readNativeSelection(dom: SpindleDOMHelper): NativeSelection | undefined {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const element = (node: Node) => node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const a = element(range.startContainer), b = element(range.endContainer);
  if (!a || !b) return;
  const excluded = 'button,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-kazzware-owned],header,h1,h2,h3,h4,h5,h6';
  if (a.closest(excluded) || b.closest(excluded)) return;
  const messageId = dom.getMessageId(a);
  if (!messageId || messageId !== dom.getMessageId(b)) return;
  const text = selection.toString();
  if (!text.trim() || text.length > 100_000) return;
  return { messageId, text, domRange: range.cloneRange() };
}

/** Match literal prose, allowing only browser whitespace normalization. Never guess
 * which duplicate or stripped Markdown/HTML fragment the user intended. */
export function nativeRange(source: string, selected: string): Range | undefined {
  if (!selected.trim()) return;
  const chars: string[] = [], starts: number[] = [], ends: number[] = [];
  for (let i = 0; i < source.length; i++) {
    if (/\s/u.test(source[i])) {
      if (chars.at(-1) === ' ') ends[ends.length - 1] = i + 1;
      else { chars.push(' '); starts.push(i); ends.push(i + 1); }
    } else { chars.push(source[i]); starts.push(i); ends.push(i + 1); }
  }
  const found = uniqueRange(chars.join(''), selected.replace(/\s+/gu, ' '));
  if (found) return { start: starts[found.start], end: ends[found.end - 1] };
}
