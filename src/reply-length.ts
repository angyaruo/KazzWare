// Segment words rather than tokens or UTF-16 code units. This also handles
// scripts that do not put a space between every word; emoji are not words.
const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
export function limitReply(text: string, maxWords: number): { text: string; limited: boolean } {
  if (!maxWords) return { text, limited: false };
  let words = 0;
  for (const segment of segmenter.segment(text)) {
    if (!segment.isWordLike || ++words <= maxWords) continue;
    const prefix = text.slice(0, segment.index).trimEnd().replace(/[,:;\-–—]+$/u, '').trimEnd();
    return { text: prefix.endsWith('…') ? prefix : `${prefix}…`, limited: true };
  }
  return { text, limited: false };
}
export function replyLengthInstruction(maxWords: number): string {
  return `Write Kazz's own answer as a casual back-and-forth chat, not an essay. Prefer one to three short sentences and skip unnecessary recaps, headings and lists.${maxWords ? ` The user has set a strict maximum of ${maxWords} words for your answer text. Finish your thought within that limit, even if earlier replies were longer.` : ' Match the detail the user asks for.'} This preference applies only to your answer dialogue; tool arguments, message edits, summaries and lorebook content keep their own task requirements.`;
}
