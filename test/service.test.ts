import { describe, expect, test } from 'bun:test';
import { CHANNEL, type View } from '../src/shared';
import { deferred, fake, until } from './fake';
describe('editing and durable Undo', () => {
  test('applies immediately, with exact surroundings and durable undo', async () => {
    const f = fake(); await f.ready(); const before = f.messages.get('chat-a')![0].content;
    f.outputs.push('{"replacement":"eyes"}');
    const reply = await f.request('edit', { ...f.editData(), range: { start: 20, end: 24 } });
    expect(reply.ok).toBe(true); expect(f.updates).toHaveLength(1);
    expect(f.updates[0].content).toBe(before.slice(0, 20) + 'eyes' + before.slice(24));
    expect(f.state().undo[0].status).toBe('applied');
    expect((await f.request('undo', { undoId: f.state().undo[0].id })).ok).toBe(true);
    expect(f.messages.get('chat-a')![0].content).toBe(before);
  });
  test('rejects stale source and switched swipe before model call', async () => {
    const f = fake(); await f.ready(); const data = f.editData(); f.messages.get('chat-a')![0].swipe_id = 1;
    expect((await f.request('edit', data)).ok).toBe(false); expect(f.modelInputs).toHaveLength(0); expect(f.updates).toHaveLength(0);
  });
  test('preserves a manual edit made while the model runs', async () => {
    const f = fake(); await f.ready(); const gate = deferred(); f.setGate(() => gate.promise); f.outputs.push('{"replacement":"new"}');
    const work = f.request('edit', f.editData()); await until(() => f.modelInputs.length === 1);
    f.messages.get('chat-a')![0].content = 'Manual revision'; gate.resolve();
    expect((await work).ok).toBe(false); expect(f.updates).toHaveLength(0);
  });
  test('refuses Undo over a newer manual edit', async () => {
    const f = fake(); await f.ready(); f.outputs.push('{"replacement":"New wording"}'); await f.request('edit', f.editData());
    f.messages.get('chat-a')![0].content = 'Manual revision';
    expect((await f.request('undo', { undoId: f.state().undo[0].id })).error).toContain('newer work is untouched'); expect(f.updates).toHaveLength(1);
  });
  test('does not write a message if the write-ahead journal fails', async () => {
    const f = fake(); await f.ready(); f.outputs.push('{"replacement":"New wording"}'); f.failNextSave();
    expect((await f.request('edit', f.editData())).ok).toBe(false); expect(f.updates).toHaveLength(0);
  });
  test('can Undo a write whose final storage save failed', async () => {
    const f = fake(); await f.ready(); const before = f.messages.get('chat-a')![0].content; f.outputs.push('{"replacement":"New wording"}'); f.failNextSave(2);
    expect((await f.request('edit', f.editData())).ok).toBe(false); expect(f.state().undo[0].status).toBe('prepared');
    expect((await f.request('undo', { undoId: f.state().undo[0].id })).ok).toBe(true); expect(f.messages.get('chat-a')![0].content).toBe(before);
  });
  test('rejects malformed, truncated, and still-sloppy model responses', async () => {
    const f = fake(); await f.ready(); f.outputs.push('Oops'); expect((await f.request('edit', f.editData())).ok).toBe(false);
    f.outputs.push('{"replacement":"orbs"}'); expect((await f.request('edit', { ...f.editData(), mode: 'deslop' })).ok).toBe(false);
    f.outputs.push('{"replacement":"eyes"}'); f.setFinish('length'); expect((await f.request('edit', f.editData())).ok).toBe(false); expect(f.updates).toHaveLength(0);
  });
});
describe('request isolation', () => {
  test('a delayed result cannot mutate the old or new chat after switching', async () => {
    const f = fake(); await f.ready(); const gate = deferred(); f.setGate(() => gate.promise); f.outputs.push('{"replacement":"new"}');
    const work = f.request('edit', f.editData()); await until(() => f.modelInputs.length === 1); await f.switchChat('chat-b'); gate.resolve();
    expect((await work).ok).toBe(false); expect(f.updates).toHaveLength(0);
  });
  test('explicit cancellation prevents an unfinished edit', async () => {
    const f = fake(); await f.ready(); const gate = deferred(); f.setGate(() => gate.promise); f.outputs.push('{"replacement":"new"}');
    const work = f.request('edit', f.editData()); await until(() => f.modelInputs.length === 1); await f.request('cancel'); gate.resolve();
    expect((await work).ok).toBe(false); expect(f.updates).toHaveLength(0);
  });
  test('replayed request IDs do not repeat model calls or writes', async () => {
    const f = fake(); await f.ready(); f.outputs.push('{"replacement":"New wording"}'); const data = f.editData();
    await f.request('edit', data, { id: 'same-id' }); await f.request('edit', data, { id: 'same-id' }); expect(f.modelInputs).toHaveLength(1); expect(f.updates).toHaveLength(1);
  });
  test('other users and spoofed frontend sessions cannot borrow a binding', async () => {
    const f = fake(); await f.ready();
    expect((await f.request('bind', {}, {}, 'bob', 'bob-session')).ok).toBe(false);
    const count = f.replies.length; await f.request('load', {}, {}, 'alice', 'other-session'); expect(f.replies).toHaveLength(count);
  });
  test('model calls use the chosen connection and never expose connection secrets', async () => {
    const f = fake(); await f.ready(); f.outputs.push('{"replacement":"New wording"}'); const reply = await f.request('edit', f.editData());
    expect(f.modelInputs[0]).toMatchObject({ connection_id: 'connection', userId: 'alice', type: 'quiet' }); expect(JSON.stringify(reply)).not.toContain('NEVER-EXPOSE');
    expect(JSON.stringify(f.modelInputs)).not.toContain('NEVER-EXPOSE');
  });
});
describe('notebook, assistant, fandom', () => {
  test('gallery is opt-in, deduplicates events across clients and persists comments', async () => {
    const f = fake(); await f.ready(); expect((await f.request('gallery')).ok).toBe(false);
    await f.request('settings', { settings: { ...f.state().settings, galleryEnabled: true, interval: 1 } });
    f.outputs.push('{"title":"The Lighthouse Discourse","posts":[{"author":"fan","title":"AITA?","body":"He waited."}]}');
    await f.request('tick', { generationType: 'swipe', messageId: 'm1' }); expect(f.modelInputs).toHaveLength(0);
    await f.request('tick', { generationType: 'normal', messageId: 'm1' });
    await f.request('bind', {}, { client: 'other-client', binding: 'other' }, 'alice', 'other-session');
    await f.request('tick', { generationType: 'normal', messageId: 'm1' }, { client: 'other-client', binding: 'other' }, 'alice', 'other-session'); expect(f.modelInputs).toHaveLength(1);
    const page = f.state().pages[0]; await f.request('react', { pageId: page.id, postId: page.posts[0].id, kind: 'comment', text: '<script>hello</script>' });
    expect(f.state().pages[0].comments[0].body).toBe('<script>hello</script>'); expect(f.updates).toHaveLength(0);
  });
  test('summary covers all chunks and lorebook attachment preserves metadata', async () => {
    const f = fake(); await f.ready(); f.messages.get('chat-a')![0].content = 'A'.repeat(25000);
    f.outputs.push('Part one.', 'Full summary.', '{"name":"Lighthouse lore","entries":[{"title":"Lighthouse","keys":["lighthouse"],"content":"A haunted light."}]}');
    expect((await f.request('lorebook')).ok).toBe(true); expect(f.modelInputs).toHaveLength(3);
    expect(f.state().summaries[0].text).toBe('Full summary.'); expect(f.books).toHaveLength(2);
    expect(f.chats.get('chat-a')!.metadata).toMatchObject({ custom: true, chat_world_book_ids: ['existing', 'new-book'] });
  });
  test('assistant searches old chat messages and keeps its own transcript separate', async () => {
    const f = fake(); await f.ready(); f.outputs.push('{"action":"search","query":"orbs"}', '{"action":"answer","text":"Found it in Elias’s first message."}');
    const reply = await f.request('ask', { text: 'Find the orbs line.' }); expect(reply.ok).toBe(true);
    expect(f.state().turns).toHaveLength(2); expect(f.updates).toHaveLength(0); expect(JSON.stringify(f.modelInputs[1])).toContain('m1');
  });
  test('no chat or unbound actions cannot operate', async () => {
    const f = fake(); expect((await f.request('edit', f.editData())).ok).toBe(false); await f.switchChat(null);
    expect((await f.request('gallery')).result).toBeNull(); expect(f.modelInputs).toHaveLength(0);
  });
});


test('automatic fandom anchors and context stop at the triggering message even if more replies arrive', async () => {
  const f = fake(); await f.ready(); await f.request('settings', { settings: { ...f.state().settings, galleryEnabled: true, interval: 1 } });
  f.messages.get('chat-a')!.push({ ...f.messages.get('chat-a')![0], id: 'future', content: 'FUTURE SPOILER', index_in_chat: 1 });
  const gate = deferred(); f.setGate(() => gate.promise);
  f.outputs.push('{"title":"Old drama","posts":[{"author":"fan","title":"Wait","body":"The key."}]}');
  const work = f.request('tick', { generationType: 'normal', messageId: 'm1' }); await until(() => f.modelInputs.length === 1);
  f.messages.get('chat-a')!.push({ ...f.messages.get('chat-a')![0], id: 'newest', index_in_chat: 2 }); gate.resolve();
  expect((await work).ok).toBe(true); expect(f.state().pages[0].throughMessage).toBe('m1');
  expect(JSON.stringify(f.modelInputs[0])).not.toContain('FUTURE SPOILER');
});


test('commentary is off for older storage, bounded, deduplicated across clients, and uses the selected connection', async () => {
  const f = fake(); await f.ready();
  delete (f.state().settings as { commentaryEnabled?: boolean }).commentaryEnabled;
  delete (f.state() as { commented?: string[] }).commented;
  const data = { messageId: 'm1', expected: f.messages.get('chat-a')![0].content, swipe: 0 };
  expect((await f.request('commentary', data)).result).toBeNull(); expect(f.modelInputs).toHaveLength(0);
  f.state().settings.commentaryEnabled = true; f.outputs.push('Kazz: "' + 'word '.repeat(60) + '"\nAnother line that must never appear.');
  const reply = await f.request('commentary', data); expect(reply.ok).toBe(true);
  const line = reply.result as string; expect(Array.from(line).length).toBeLessThanOrEqual(160); expect(line.split(/\s+/).length).toBeLessThanOrEqual(18); expect(line).not.toContain('\n');
  expect((f.modelInputs[0] as { connection_id: string }).connection_id).toBe('connection');
  await f.request('bind', {}, { client: 'client-b', binding: 'binding-b' }, 'alice', 'session-b');
  expect((await f.request('commentary', data, { client: 'client-b', binding: 'binding-b' }, 'alice', 'session-b')).result).toBeNull();
  expect(f.modelInputs).toHaveLength(1); expect(f.updates).toHaveLength(0); expect(f.state().turns).toHaveLength(0); expect(f.state().count).toBe(0);
});

test('commentary rejects stale swipes and discards results when a newer message arrives', async () => {
  const f = fake(); await f.ready(); f.state().settings.commentaryEnabled = true;
  const message = f.messages.get('chat-a')![0], data = { messageId: 'm1', expected: message.content, swipe: 0 };
  expect((await f.request('commentary', { ...data, swipe: 4 })).result).toBeNull(); expect(f.modelInputs).toHaveLength(0);
  const gate = deferred(); f.setGate(() => gate.promise); f.outputs.push('A stale opinion.');
  const pending = f.request('commentary', data); await until(() => f.modelInputs.length === 1);
  f.messages.get('chat-a')!.push({ ...message, id: 'm-new', content: 'New action.', index_in_chat: 1 });
  gate.resolve(); expect((await pending).result).toBeNull();
  expect((await f.request('commentary', data)).result).toBeNull(); expect(f.modelInputs).toHaveLength(1);
});

test('commentary frequency counts unique messages/swipes once, skips provider calls, and resets on preference changes', async () => {
  const f = fake(); await f.ready();
  await f.request('settings', { settings: { ...f.state().settings, commentaryEnabled: true, commentaryInterval: 3 } });
  const message = f.messages.get('chat-a')![0];
  const tick = () => f.request('commentary', { messageId: message.id, expected: message.content, swipe: message.swipe_id });
  expect((await tick()).result).toBeNull(); await tick(); expect(f.state().commentaryCount).toBe(1);
  message.swipe_id++; message.content = 'Another possibility.'; expect((await tick()).result).toBeNull(); expect(f.modelInputs).toHaveLength(0);
  message.swipe_id++; message.content = 'Third possibility.'; f.outputs.push('Three terrible options. Impressive.'); expect((await tick()).result).toContain('Three'); expect(f.state().commentaryCount).toBe(0);
  await tick(); expect(f.modelInputs).toHaveLength(1);
  message.content = 'Changed again.'; await tick(); expect(f.state().commentaryCount).toBe(1);
  await f.request('settings', { settings: { ...f.state().settings, commentaryInterval: 2 } }); expect(f.state().commentaryCount).toBe(0);
  expect(f.updates).toHaveLength(0);
});

test('failed commentary events are consumed once and chat changes cancel pending commentary', async () => {
  const f = fake(); await f.ready(); f.state().settings.commentaryEnabled = true;
  const message = f.messages.get('chat-a')![0], data = { messageId: 'm1', expected: message.content, swipe: 0 };
  expect((await f.request('commentary', data)).ok).toBe(false);
  expect((await f.request('commentary', data)).result).toBeNull(); expect(f.modelInputs).toHaveLength(1);
  message.swipe_id = 1; message.content = 'Another swipe.';
  const gate = deferred(); f.setGate(() => gate.promise); f.outputs.push('You should never see this.');
  const pending = f.request('commentary', { ...data, swipe: 1, expected: message.content }); await until(() => f.modelInputs.length === 2);
  await f.switchChat('chat-b'); gate.resolve(); expect((await pending).ok).toBe(false); expect(f.updates).toHaveLength(0);
});
