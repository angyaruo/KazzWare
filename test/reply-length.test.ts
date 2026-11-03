import { expect, test } from 'bun:test';
import { limitReply } from '../src/reply-length';
import { DEFAULTS, settings } from '../src/shared';
import { deferred, fake, until } from './fake';

test('word limits preserve short replies and formatting; long replies end at a Unicode word boundary', () => {
  const text = 'Hey, Operator!\n\nThat’s a gorgeous idea, holy shit. 🌑';
  expect(limitReply(text, 80)).toEqual({ text, limited: false });
  expect(limitReply(text, 0)).toEqual({ text, limited: false });
  expect(limitReply(text, 3)).toEqual({ text: 'Hey, Operator!\n\nThat’s…', limited: true });
  expect(limitReply('🌑 ¡Sí, cabrón! Más palabras.', 2)).toEqual({ text: '🌑 ¡Sí, cabrón!…', limited: true });
  expect(limitReply('🌑 🌑', 1).limited).toBe(false);
  const japanese = 'これはとても長い日本語の文章です。続きがあります。';
  const clipped = limitReply(japanese, 3);
  expect(clipped.limited).toBe(true); expect(clipped.text.length).toBeLessThan(japanese.length);
  expect(clipped.text).not.toMatch(/[\uD800-\uDBFF]$/);
});

test('legacy settings default to conversational replies; no cap and custom values are validated', async () => {
  const f = fake(); await f.ready(); Reflect.deleteProperty(f.state().settings, 'chatMaxWords');
  expect((await f.request('load')).result).toMatchObject({ state: { settings: { chatMaxWords: 80 } } });
  for (const words of [0, 1, 80, 2000]) expect(settings({ ...DEFAULTS, chatMaxWords: words }).chatMaxWords).toBe(words);
  for (const words of [-1, 2001, 4.5, '40']) expect(() => settings({ ...DEFAULTS, chatMaxWords: words })).toThrow();
});

test('changing reply length is saved per roleplay without generation or disturbing history and preferences', async () => {
  const f = fake(); await f.ready(); f.state().turns.push({ role: 'user', content: 'Keep this', at: 1 });
  const before = structuredClone(f.state());
  expect((await f.request('replyLength', { words: 40 })).ok).toBe(true);
  expect(f.state()).toEqual({ ...before, settings: { ...before.settings, chatMaxWords: 40 } });
  expect(f.modelInputs).toHaveLength(0); expect(f.updates).toHaveLength(0);
  f.failNextSave(); expect((await f.request('replyLength', { words: 200 })).ok).toBe(false);
  expect(f.state().settings.chatMaxWords).toBe(40);
  expect((await f.request('replyLength', { words: 2001 })).ok).toBe(false);
  await f.switchChat('chat-b'); expect((await f.request('load')).result).toMatchObject({ state: { settings: { chatMaxWords: 80 } } });
  expect(f.state('chat-a').settings.chatMaxWords).toBe(40);
});

test('saved and streamed dialogue obey the word cap even when a model ignores the instruction', async () => {
  const f = fake(); await f.ready(); await f.request('replyLength', { words: 3 });
  const answer = JSON.stringify({ action: 'answer', text: 'One two three four five six seven.' });
  const gate = deferred(); f.outputs.push(answer);
  f.stream(['{"action":"answer","text":"One two three four', ' five six seven."}'], i => i === 0 ? gate.promise : Promise.resolve());
  const work = f.request('ask', { text: 'Hello' });
  await until(() => f.replies.some(r => r.stream));
  expect(f.replies.find(r => r.stream)?.stream?.text).toBe('One two three…');
  gate.resolve(); expect((await work).ok).toBe(true);
  expect(f.state().turns.at(-1)).toMatchObject({ content: 'One two three…', wordLimit: 3 });
  expect(f.replies.filter(r => r.stream).every(r => r.stream!.text === 'One two three…')).toBe(true);
  expect(JSON.stringify(f.modelInputs[0])).toContain('strict maximum of 3 words');
});

test('word cap can be disabled and never clips tool arguments or message edits; token ceiling stays independent', async () => {
  const f = fake(); await f.ready(); f.state().settings.chatMaxWords = 1; f.state().settings.maxOutputTokens = 512;
  const replacement = 'A longer edited message with every required source detail.';
  f.outputs.push('{"action":"edit","messageId":"m1","direction":"Use simpler wording and retain details"}', JSON.stringify({ replacement }), '{"action":"answer","text":"Done, boss!"}');
  expect((await f.request('ask', { text: 'Edit the latest message.' })).ok).toBe(true);
  expect(f.updates[0].content).toBe(replacement); expect(f.state().turns.at(-1)?.content).toBe('Done…');
  for (const input of f.modelInputs) expect(input).toMatchObject({ parameters: { max_tokens: 512 } });
  await f.request('replyLength', { words: 0 });
  f.outputs.push('{"action":"answer","text":"One two three four five."}');
  await f.request('ask', { text: 'Longer answer please.' });
  expect(f.state().turns.at(-1)).toMatchObject({ content: 'One two three four five.' });
  expect(f.state().turns.at(-1)).not.toHaveProperty('wordLimit');
});

test('all supported output-limit finish reasons reject partial replies and explain the budget', async () => {
  for (const reason of ['length', 'max_tokens', 'max_output_tokens', 'MAX_TOKENS']) {
    const f = fake(); await f.ready(); f.outputs.push('{"action":"answer","text":"Incomplete"}'); f.setFinish(reason);
    const response = await f.request('ask', { text: 'Hello' });
    expect(response.ok).toBe(false); expect(response.error).toContain('Reasoning and JSON');
    expect(f.state().turns.filter(t => t.role === 'assistant')).toHaveLength(0);
  }
});
