/** Only decode the first, explicitly reader-facing answer string. Never stream
 * action arguments or tool results. Final JSON still goes through validation. */
export function answerPreview(source: string): string | undefined {
  const prefix = /^\s*(?:```(?:json)?\s*)?\{\s*"action"\s*:\s*"answer"\s*,\s*"text"\s*:\s*"/i.exec(source);
  if (!prefix) return;
  let text = '';
  for (let i = prefix[0].length; i < source.length && text.length < 20_000; i++) {
    const c = source[i];
    if (c === '"') break;
    if (c.charCodeAt(0) < 32) return;
    if (c !== '\\') { text += c; continue; }
    const escape = source[i + 1];
    if (!escape) break;
    const length = escape === 'u' ? 6 : 2;
    if (source.length - i < length) break;
    try { text += JSON.parse(`"${source.slice(i, i + length)}"`) as string; }
    catch { return; }
    i += length - 1;
  }
  // A token can end halfway through a surrogate pair (literal or escaped).
  return text.slice(0, 20_000).replace(/[\uD800-\uDBFF]$/, '');
}
