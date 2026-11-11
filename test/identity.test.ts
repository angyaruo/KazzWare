import { expect, test } from 'bun:test';
import type { SpindleFrontendContext } from 'lumiverse-spindle-types';
import { frontendIdentity, hostUUID, identityRequest, UUID_COMPATIBILITY } from '../src/identity';
import { CHANNEL } from '../src/shared';
import { deferred, fake, until } from './fake';

test('host UUID capability and helper failures are explicit with no local generation fallback', async () => {
  const f = fake(); const api = f.api as unknown as Parameters<typeof hostUUID>[0];
  expect(await hostUUID(api)).toBe(f.uuidCalls[0]);
  f.api.host.capabilities['uuid-v1'] = 0;
  await expect(hostUUID(api)).rejects.toThrow(UUID_COMPATIBILITY);
  expect(f.uuidCalls).toHaveLength(1);
  f.api.host.capabilities['uuid-v1'] = 1; f.api.uuid.v4 = async () => { throw new Error('Host UUID unavailable'); };
  await expect(hostUUID(api)).rejects.toThrow('Host UUID unavailable');
  f.api.uuid.v4 = async () => 'invalid'; await expect(hostUUID(api)).rejects.toThrow('invalid UUID');
});

test('bootstrap identities use authenticated document routing and never broadcast without a session', async () => {
  const f = fake(), sent: { value: Record<string, unknown>; user: string; target: unknown }[] = [];
  f.api.sendToFrontend = ((value: Record<string, unknown>, user: string, target: unknown) => sent.push({ value, user, target })) as unknown as typeof f.api.sendToFrontend;
  const api = f.api as unknown as Parameters<typeof identityRequest>[0];
  await identityRequest(api, { channel: CHANNEL, action: 'identity', nonce: 'one', frontendSessionId: 'forged' }, 'alice', 'real-document');
  expect(sent[0]).toEqual({ value: { channel: CHANNEL, action: 'identity', nonce: 'one', client: f.uuidCalls[0] }, user: 'alice', target: { frontendSessionId: 'real-document' } });
  await identityRequest(api, { channel: CHANNEL, action: 'identity', nonce: 'two' }, 'alice', 'other-document');
  expect(sent[1].value.client).not.toBe(sent[0].value.client);
  await identityRequest(api, { channel: CHANNEL, action: 'identity', nonce: 'three' }, 'alice');
  await identityRequest(api, { channel: CHANNEL, action: 'identity', nonce: 'four' }, '', 'real-document');
  expect(sent).toHaveLength(2); expect(f.store.size).toBe(0); expect(f.modelInputs).toHaveLength(0);
  f.api.host.capabilities['uuid-v1'] = 0;
  await identityRequest(api, { channel: CHANNEL, action: 'identity', nonce: 'old-host' }, 'alice', 'real-document');
  expect(sent[2].value.error).toBe(UUID_COMPATIBILITY); expect(sent[2].target).toEqual({ frontendSessionId: 'real-document' });
});

test('frontend waits for its own host-generated identity and cleans up temporary subscriptions', async () => {
  let listener: (value: unknown) => void = () => {}, request: Record<string, unknown> = {}, subscribed = 0, ready = false;
  const ctx = { frontendSessionId: 'document-a',
    ready() { expect(subscribed).toBe(1); ready = true; },
    onBackendMessage(fn: typeof listener) { listener = fn; subscribed++; return () => { subscribed--; }; },
    sendToBackend(value: unknown) { expect(ready).toBe(true); request = value as typeof request; },
  } as unknown as SpindleFrontendContext;
  const result = frontendIdentity(ctx); let resolved = false; void result.then(() => { resolved = true; });
  expect(subscribed).toBe(1);
  listener({ channel: CHANNEL, action: 'identity', nonce: 'wrong', client: '00000000-0000-4000-8000-000000000001' });
  await Promise.resolve(); expect(resolved).toBe(false);
  listener({ channel: CHANNEL, action: 'identity', nonce: request.nonce, client: '00000000-0000-4000-8000-000000000001' });
  expect(await result).toBe('00000000-0000-4000-8000-000000000001'); expect(subscribed).toBe(0);
  const failed = frontendIdentity(ctx); listener({ channel: CHANNEL, action: 'identity', nonce: request.nonce, error: UUID_COMPATIBILITY });
  await expect(failed).rejects.toThrow(UUID_COMPATIBILITY); expect(subscribed).toBe(0);
  await expect(frontendIdentity({ ...ctx, frontendSessionId: undefined })).rejects.toThrow(UUID_COMPATIBILITY);
  await expect(frontendIdentity({ ...ctx, onBackendMessage() { throw new Error('Listener unavailable'); } })).rejects.toThrow('Listener unavailable');
  const sendFailure = { ...ctx, sendToBackend() { throw new Error('Transport unavailable'); } };
  await expect(frontendIdentity(sendFailure)).rejects.toThrow('Transport unavailable'); expect(subscribed).toBe(0);
});

test('new conversation, Undo, summaries and Gallery IDs all come from the host helper', async () => {
  const f = fake(); await f.ready();
  f.state().turns.push({ role: 'user', content: 'Keep me', at: 1 });
  await f.request('newConversation');
  expect(f.uuidCalls).toContain(f.state().conversation.id); expect(f.state().conversations[0].id).toBe('initial');
  f.outputs.push('{"replacement":"He waited by the door."}'); await f.request('edit', f.editData());
  expect(f.uuidCalls).toContain(f.state().undo[0].id);
  f.outputs.push('{"summary":"He waited by the door."}'); await f.request('summary');
  expect(f.uuidCalls).toContain(f.state().summaries[0].id);
  f.state().settings.galleryEnabled = true;
  f.outputs.push('{"title":"Fans react","posts":[{"author":"fan","title":"hello","body":"The door is suspicious."},{"author":"other","title":"same","body":"Agreed."},{"author":"third","title":"wait","body":"Who has the key?"}]}');
  expect((await f.request('gallery')).ok).toBe(true); const page = f.state().pages[0];
  expect(f.uuidCalls).toContain(page.id); for (const post of page.posts) expect(f.uuidCalls).toContain(post.id);
  await f.request('react', { pageId: page.id, postId: page.posts[0].id, kind: 'comment', text: 'Yes.' });
  expect(f.uuidCalls).toContain(f.state().pages[0].comments[0].id);
});

test('a delayed host UUID cannot save into a chat after its binding is cancelled', async () => {
  const f = fake(); await f.ready(); const gate = deferred(), original = f.api.uuid.v4;
  let requested = false;
  f.api.uuid.v4 = async () => { requested = true; await gate.promise; return original(); };
  const request = f.request('newConversation'); await until(() => requested);
  await f.switchChat('chat-b'); gate.resolve(); expect((await request).ok).toBe(false);
  expect(f.state('chat-a').conversation.id).toBe('initial'); expect(f.state('chat-a').conversations).toHaveLength(0);
});

test('story records use host UUIDs and edits retain the IDs of existing notes and future beats', async () => {
  const f = fake(); await f.ready();
  f.outputs.push('{"summary":"He watches the window.","storyDate":"","storyTime":"","location":"","characters":"Elias"}');
  expect((await f.request('timelineMessage', { messageId: 'm1' })).ok).toBe(true);
  const note = f.state().story.timeline[0]; expect(f.uuidCalls).toContain(note.id);
  const beforeEdit = f.uuidCalls.length;
  expect((await f.request('timelineSave', { ...note, summary: 'An edited note.' })).ok).toBe(true);
  expect(f.state().story.timeline[0].id).toBe(note.id); expect(f.uuidCalls).toHaveLength(beforeEdit);
  expect((await f.request('spoilerSave', { text: 'Mention the window.', afterMessages: null })).ok).toBe(true);
  const future = f.state().story.spoilers[0]; expect(f.uuidCalls).toContain(future.id);
  const beforeFutureEdit = f.uuidCalls.length;
  expect((await f.request('spoilerSave', { ...future, text: 'Mention the window later.' })).ok).toBe(true);
  expect(f.state().story.spoilers[0].id).toBe(future.id); expect(f.uuidCalls).toHaveLength(beforeFutureEdit);
  f.outputs.push('{"name":"The Window and the Watcher"}'); await f.request('nameChat');
  expect(f.uuidCalls).toContain(f.state().story.names[0].id);
  const message = f.messages.get('chat-a')![0]; message.swipes = [message.content, 'He waits.']; message.swipe_dates = [1, 2];
  const swipes = (await f.request('swipes', { messageId: 'm1' })).result as { revision: string };
  f.outputs.push('{"replacement":"He watches the window and waits."}');
  expect((await f.request('mergeSwipes', { messageId: 'm1', revision: swipes.revision, indices: [0, 1] })).ok).toBe(true);
  expect(f.uuidCalls).toContain(f.state().story.merges[0].id);
});

test('host UUID failure occurs before any saved record or native message mutation', async () => {
  const f = fake(); await f.ready(); f.api.uuid.v4 = async () => { throw new Error('UUID host failed'); };
  const before = structuredClone(f.state());
  expect((await f.request('newConversation')).error).toContain('UUID host failed');
  expect(f.state()).toEqual(before);
  f.outputs.push('{"replacement":"A different message."}');
  expect((await f.request('edit', f.editData())).error).toContain('UUID host failed');
  expect(f.state()).toEqual(before); expect(f.updates).toHaveLength(0);
});
