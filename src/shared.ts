export const CHANNEL = 'kazzware.v1';
export type Range = { start: number; end: number };
export type Message = { id: string; content: string; name: string; is_user: boolean; swipe_id: number; index_in_chat: number };
export type Settings = { connectionId: string; slop: string[]; wholeWords: boolean; galleryEnabled: boolean; interval: number; format: 'random' | 'forum' | 'thread' | 'wiki'; contextMessages: number; mascotSize: number };
export type Post = { id: string; author: string; title: string; body: string };
export type GalleryPage = { id: string; title: string; format: 'forum' | 'thread' | 'wiki'; posts: Post[]; createdAt: number; throughMessage: string; votes: string[]; comments: { id: string; postId: string; body: string; author: string }[] };
export type Undo = { id: string; label: string; messageId: string; before: string; after: string; swipe: number; createdAt: number; status: 'prepared' | 'applied' | 'undone' };
export type Turn = { role: 'user' | 'assistant'; content: string; at: number };
export type Summary = { id: string; text: string; throughMessage: string; messages: number; createdAt: number };
export type State = { version: 1; settings: Settings; undo: Undo[]; turns: Turn[]; summaries: Summary[]; pages: GalleryPage[]; counted: string[]; count: number; lorebooks: { id: string; name: string; createdAt: number }[] };
export type ViewState = Omit<State, 'undo' | 'pages'> & { undo: Omit<Undo, 'before' | 'after'>[]; pages: Omit<GalleryPage, 'posts' | 'votes' | 'comments'>[] };
export type View = { state: ViewState; chatName: string; messages: Message[]; totalMessages: number; connections: { id: string; name: string; model: string; provider: string }[] };
export type Request = { channel: typeof CHANNEL; client: string; binding: string; id: string; chatId: string | null; action: string; data?: Record<string, unknown> };
export type Reply = { channel: typeof CHANNEL; client: string; binding: string; id: string; ok?: boolean; result?: unknown; error?: string; progress?: string };
export const DEFAULTS: Settings = { connectionId: '', slop: ['a shiver ran down', 'a testament to', 'couldn’t help but', 'could not help but', 'orbs'], wholeWords: true, galleryEnabled: false, interval: 5, format: 'random', contextMessages: 30, mascotSize: 110 };
export function emptyState(): State { return { version: 1, settings: { ...DEFAULTS, slop: [...DEFAULTS.slop] }, undo: [], turns: [], summaries: [], pages: [], counted: [], count: 0, lorebooks: [] }; }
export function string(value: unknown, name: string, max = 8000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters.`);
  return value;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
export function integer(value: unknown, min: number, max: number): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new Error(`Expected a whole number between ${min} and ${max}.`);
  return Number(value);
}
export function settings(value: unknown): Settings {
  const v = object(value);
  if (typeof v.connectionId !== 'string' || v.connectionId.length > 200 || !Array.isArray(v.slop) || v.slop.length > 300) throw new Error('Invalid connection or phrase list (maximum 300 phrases).');
  if (typeof v.wholeWords !== 'boolean' || typeof v.galleryEnabled !== 'boolean') throw new Error('Invalid toggle.');
  if (!['random', 'forum', 'thread', 'wiki'].includes(String(v.format))) throw new Error('Unknown gallery format.');
  return { connectionId: v.connectionId, slop: [...new Set(v.slop.map(x => string(x, 'Phrase', 200).trim()))], wholeWords: v.wholeWords, galleryEnabled: v.galleryEnabled, interval: integer(v.interval, 1, 100), format: v.format as Settings['format'], contextMessages: integer(v.contextMessages, 5, 100), mascotSize: integer(v.mascotSize, 70, 180) };
}
export function parseJSON(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return object(JSON.parse(cleaned)); } catch { throw new Error('The model returned an invalid response. Nothing was applied; try again or choose another connection.'); }
}
export function replaceRange(source: string, range: Range, replacement: string): string {
  integer(range.start, 0, source.length); integer(range.end, range.start + 1, source.length);
  for (const pos of [range.start, range.end]) {
    if (pos > 0 && /[\uD800-\uDBFF]/.test(source[pos - 1]) && /[\uDC00-\uDFFF]/.test(source[pos] || '')) throw new Error('Selection splits a Unicode character. Reselect the text.');
  }
  return source.slice(0, range.start) + replacement + source.slice(range.end);
}
export function uniqueRange(source: string, selected: string): Range | undefined {
  if (!selected) return;
  const start = source.indexOf(selected);
  if (start < 0 || source.indexOf(selected, start + 1) >= 0) return;
  return { start, end: start + selected.length };
}
/** Textareas normalize CRLF and bare CR to LF; map their UTF-16 offsets back to source. */
export function textareaRange(source: string, start: number, end: number): Range {
  const offset = (position: number) => {
    let displayed = 0, original = 0;
    while (original < source.length && displayed < position) {
      if (source[original] === '\r' && source[original + 1] === '\n') original++;
      original++; displayed++;
    }
    return original;
  };
  return { start: offset(start), end: offset(end) };
}
export function textareaOffset(source: string, offset: number): number { return source.slice(0, offset).replace(/\r\n?/g, '\n').length; }
export function slopHits(text: string, phrases: string[], wholeWords: boolean): { phrase: string; count: number }[] {
  return phrases.map(phrase => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = wholeWords ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped;
    return { phrase, count: Array.from(text.matchAll(new RegExp(pattern, 'giu'))).length };
  }).filter(x => x.count > 0);
}
export function escapeHTML(text: string): string { return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
export function messageView(m: Message): Message { return { id: m.id, content: m.content, name: m.name, is_user: m.is_user, swipe_id: m.swipe_id, index_in_chat: m.index_in_chat }; }
export function sameMessage(m: Message | undefined, content: string, swipe: number): boolean { return !!m && m.content === content && m.swipe_id === swipe; }
