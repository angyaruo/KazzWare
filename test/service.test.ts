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
