import { expect, test } from 'bun:test';
import { answerPreview } from '../src/answer-stream';
import { emptyState, settings, DEFAULTS, type View } from '../src/shared';
import { deferred, fake, until } from './fake';

test('new and reopened conversations retain dialogue separately; clearing and deleting are scoped', async () => {
  const f = fake(); await f.ready();
  f.outputs.push('{"action":"answer","text":"First answer"}');
  await f.request('ask', { text: 'First topic' }); const first = f.state().conversation.id;
  const firstTurns = structuredClone(f.state().turns);
  f.state().summaries.push({ id: 'note', text: 'Keep note', throughMessage: 'm1', messages: 1, createdAt: 0 });
  expect((await f.request('newConversation', { conversationId: first })).ok).toBe(true);
  const second = f.state().conversation.id;
  expect(second).not.toBe(first); expect(f.state().turns).toEqual([]);
  expect(f.state().conversations[0]).toMatchObject({ id: first, title: 'First topic', turns: firstTurns });
  f.outputs.push('{"action":"answer","text":"Second answer"}');
  await f.request('ask', { text: 'Second topic', conversationId: second });
  expect(JSON.stringify(f.modelInputs.at(-1))).not.toContain('First answer');
  expect((await f.request('switchConversation', { id: first, conversationId: second })).ok).toBe(true);
  expect(f.state().turns).toEqual(firstTurns);
  expect(f.state().conversations[0]).toMatchObject({ id: second, title: 'Second topic' });
  f.outputs.push('{"action":"answer","text":"Welcome back"}');
  await f.request('ask', { text: 'Continue', conversationId: first });
  expect(JSON.stringify(f.modelInputs.at(-1))).toContain('First answer');
  expect(JSON.stringify(f.modelInputs.at(-1))).not.toContain('Second answer');
  const calls = f.modelInputs.length;
  expect((await f.request('resetChat', { conversationId: first })).ok).toBe(true);
  expect(f.state().turns).toEqual([]); expect(f.state().conversations).toHaveLength(1);
  expect((await f.request('deleteConversation', { id: second, conversationId: first })).ok).toBe(true);
  expect(f.state().conversations).toEqual([]); expect(f.state().summaries[0].text).toBe('Keep note');
  expect(f.updates).toEqual([]); expect(f.modelInputs).toHaveLength(calls);
  expect((await f.request('load')).result).toMatchObject({ state: { conversation: { id: first }, turns: [] } });
});

test('legacy history migrates without a new model call; archives are metadata-only in routine views', async () => {
  const f = fake(); await f.ready(); const legacy = f.state();
  Reflect.deleteProperty(legacy, 'conversation'); Reflect.deleteProperty(legacy, 'conversations');
  legacy.turns = [{ role: 'assistant', content: 'Legacy reply', at: 123 }];
  const view = (await f.request('load')).result as View;
  expect(view.state.conversation).toMatchObject({ id: 'initial', createdAt: 123 });
  expect(view.state.turns[0].content).toBe('Legacy reply');
  await f.request('newConversation');
  f.state().conversations[0].turns[0].content = 'SAVED-BODY'.repeat(10_000);
  const saved = (await f.request('load')).result as View;
  expect(saved.state.conversations[0]).toMatchObject({ id: 'initial', turnCount: 1 });
  expect(saved.state.conversations[0]).not.toHaveProperty('turns');
  expect(JSON.stringify(saved).length).toBeLessThan(5000); expect(f.modelInputs).toHaveLength(0);
});

test('failed save, stale conversation and per-roleplay boundaries preserve history', async () => {
  const f = fake(); await f.ready(); f.state().turns.push({ role: 'user', content: 'Keep me', at: 1 });
  const before = structuredClone(f.state()); f.failNextSave();
  expect((await f.request('newConversation')).ok).toBe(false); expect(f.state()).toEqual(before);
  await f.request('newConversation');
  expect((await f.request('ask', { text: 'stale', conversationId: before.conversation.id })).ok).toBe(false);
  expect(f.modelInputs).toHaveLength(0);
  f.store.set('alice/chats/chat-b.json', emptyState()); await f.switchChat('chat-b');
  expect((await f.request('switchConversation', { id: before.conversation.id })).ok).toBe(false);
  expect(f.state('chat-a').conversations[0].turns[0].content).toBe('Keep me');
});

test('new chat waits for an in-flight answer then archives it; retention limit never silently deletes', async () => {
  const f = fake(); await f.ready(); const gate = deferred(); f.setGate(() => gate.promise);
  f.outputs.push('{"action":"answer","text":"Complete before archiving"}');
  const reply = f.request('ask', { text: 'Question' }); await until(() => f.modelInputs.length === 1);
  const fresh = f.request('newConversation'); gate.resolve(); await reply; await fresh;
  expect(f.state().conversations[0].turns.at(-1)?.content).toBe('Complete before archiving');
  expect(f.state().turns).toHaveLength(0);
  for (let i = 1; i < 50; i++) f.state().conversations.push({ ...f.state().conversations[0], id: String(i) });
  f.state().turns.push({ role: 'user', content: 'Retain current', at: 1 });
  expect((await f.request('newConversation')).ok).toBe(false);
  expect(f.state().conversations).toHaveLength(50); expect(f.state().turns[0].content).toBe('Retain current');
  expect((await f.request('switchConversation', { id: 'initial' })).ok).toBe(true);
  expect(f.state().conversations).toHaveLength(50);
});

test('stream decoder handles every JSON token boundary and keeps action arguments private', () => {
  const reply = 'Hi "Operator"!\nSlashes \\ and emoji 🌑 <script>hi</script>';
  for (const wire of [JSON.stringify({ action: 'answer', text: reply }), '```json\n{"action":"answer","text":"Hi \\uD83C\\uDF11"}\n```']) {
    let last = '';
    for (let i = 0; i <= wire.length; i++) {
      const preview = answerPreview(wire.slice(0, i));
      if (preview !== undefined) { expect(preview.startsWith(last)).toBe(true); expect(preview).not.toMatch(/[\uD800-\uDBFF]$/); last = preview; }
    }
    expect(last).toBe(wire.startsWith('```') ? 'Hi 🌑' : reply);
  }
  for (const wire of ['{"action":"edit","direction":"PRIVATE"}', '{"action":"resource","text":"PRIVATE"}', '{"reasoning":"PRIVATE","action":"answer","text":"hi"}']) expect(answerPreview(wire)).toBeUndefined();
  expect(answerPreview('{"action":"answer","text":"bad\\q')).toBeUndefined();
  expect(answerPreview(JSON.stringify({ action: 'answer', text: 'x'.repeat(19_999) + '🌑' }))?.length).toBe(19_999);
});

test('answer tokens arrive before completion; tool actions do not stream; cutoff is enforced', async () => {
  const f = fake(); await f.ready(); const gate = deferred();
  const answer = '{"action":"answer","text":"Streamed reply"}';
  f.outputs.push(answer); f.stream(['{"action":"answer","text":"Streamed', ' reply"}'], i => i === 0 ? gate.promise : Promise.resolve());
  const work = f.request('ask', { text: 'hello' });
  await until(() => f.replies.some(r => r.stream?.text === 'Streamed'));
  expect(f.state().turns).toHaveLength(1); expect(f.replies.some(r => r.ok === true && r.result && (r.result as View).state?.turns.length === 2)).toBe(false);
  gate.resolve(); expect((await work).ok).toBe(true); expect(f.state().turns.at(-1)?.content).toBe('Streamed reply');
  f.state().settings.maxOutputTokens = 256; f.setFinish('length'); f.outputs.push(answer);
  expect((await f.request('ask', { text: 'cut off' })).ok).toBe(false);
  expect(f.state().turns.filter(t => t.role === 'assistant')).toHaveLength(1);
  expect(f.modelInputs.at(-1)).toMatchObject({ parameters: { max_tokens: 256 } });
  for (const value of [255, 32769, 1.5, '8192']) expect(() => settings({ ...DEFAULTS, maxOutputTokens: value })).toThrow();
  expect(settings({ ...DEFAULTS, maxOutputTokens: 32768 }).maxOutputTokens).toBe(32768);
  const g = fake(); await g.ready(); g.outputs.push('{"action":"search","query":"orbs"}', answer);
  g.stream(['{"action":"search","query":"PRIVATE"}']);
  expect((await g.request('ask', { text: 'Find orbs' })).ok).toBe(true);
  expect(JSON.stringify(g.replies.filter(r => r.stream))).not.toContain('PRIVATE');
});

test('failed final save keeps only the user request; switching roleplays aborts late token delivery', async () => {
  const f = fake(); await f.ready(); f.failNextSave(2);
  const answer = '{"action":"answer","text":"Unsaved reply"}'; f.outputs.push(answer); f.stream([answer]);
  expect((await f.request('ask', { text: 'Save failure' })).ok).toBe(false);
  expect(f.replies.some(r => r.stream?.text === 'Unsaved reply')).toBe(true);
  expect(f.state().turns.map(t => t.role)).toEqual(['user']);
  const g = fake(); await g.ready(); const gate = deferred(); g.outputs.push(answer);
  g.stream(['{"action":"answer","text":"First', ' LATE"}'], i => i === 0 ? gate.promise : Promise.resolve());
  const pending = g.request('ask', { text: 'Switch away' });
  await until(() => g.replies.some(r => r.stream?.text === 'First'));
  await g.switchChat('chat-b'); gate.resolve(); expect((await pending).ok).toBe(false);
  expect(g.replies.filter(r => r.stream).map(r => r.stream!.text)).toEqual(['First']);
});
