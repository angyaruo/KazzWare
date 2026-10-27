import { expect, test } from 'bun:test';
import type { SpindleAPI, InterceptorContextDTO, InterceptorResultDTO } from 'lumiverse-spindle-types';
import { fake, deferred, until } from './fake';
import { timelinePrompt } from '../src/story';
import { settings, DEFAULTS } from '../src/shared';
import type { SwipeSet } from '../src/story-types';

async function setupSwipes() {
  const f = fake(); await f.ready();
  const m = f.messages.get('chat-a')![0]; m.swipes = [m.content, 'The lighthouse went dark.', 'He returned the key.']; m.swipe_dates = [100, 200, 300];
  const snapshot = (await f.request('swipes', { messageId: 'm1' })).result as SwipeSet;
  return { f, m, snapshot, data: { messageId: 'm1', revision: snapshot.revision, indices: [0, 2] } };
}
const summary = (text = 'Elias waits by the lighthouse.') => JSON.stringify({ summary: text, storyDate: '', storyTime: 'midnight', location: 'lighthouse', characters: 'Elias' });
const context = (overrides: Partial<InterceptorContextDTO> = {}) => ({ userId: 'alice', chatId: 'chat-a', generationType: 'normal', signal: new AbortController().signal, isDryRun: false, ...overrides }) as InterceptorContextDTO;
const prompt = [{ role: 'system' as const, content: 'Roleplay.' }, { role: 'user' as const, content: 'Continue.', __isChatHistory: true, sourceMessageId: 'm1' }];

test('merge needs distinct swipes, creates a new active variant, and Undo restores originals and dates', async () => {
  const { f, m, snapshot, data } = await setupSwipes();
  expect((await f.request('mergeSwipes', { ...data, indices: [1, 1] })).ok).toBe(false); expect(f.modelInputs).toHaveLength(0);
  f.outputs.push('{"replacement":"He waited, then returned the key."}');
  expect((await f.request('mergeSwipes', { ...data, direction: 'Keep the key return.' })).ok).toBe(true);
  expect(m.swipes!.slice(0, 3)).toEqual(snapshot.swipes); expect(m.swipe_id).toBe(3); expect(m.content).toBe('He waited, then returned the key.');
  expect(m.swipe_dates!.slice(0, 3)).toEqual([100, 200, 300]);
  expect((await f.request('undoMerge', { id: f.state().story.merges[0].id })).ok).toBe(true);
  expect(m.swipes).toEqual(snapshot.swipes); expect(m.swipe_dates).toEqual(snapshot.dates); expect(m.swipe_id).toBe(0);
});
test('merge rejects changed sources during generation and Undo protects newer swipe work', async () => {
  const { f, m, data } = await setupSwipes(), gate = deferred(); f.setGate(() => gate.promise); f.outputs.push('{"replacement":"Merged."}');
  const pending = f.request('mergeSwipes', data); await until(() => f.modelInputs.length === 1); m.swipes![1] = 'Edited elsewhere.'; gate.resolve();
  expect((await pending).ok).toBe(false); expect(f.updates).toHaveLength(0);
  f.setGate(undefined); f.outputs.push('{"replacement":"Merged."}'); const s = (await f.request('swipes', { messageId: 'm1' })).result as SwipeSet;
  await f.request('mergeSwipes', { ...data, revision: s.revision }); m.swipes![0] = 'New manual edit.';
  expect((await f.request('undoMerge', { id: f.state().story.merges[0].id })).ok).toBe(false); expect(m.swipes![0]).toBe('New manual edit.');
});
test('merge journals before writes and can recover a failed post-write save', async () => {
  const { f, m, data } = await setupSwipes(); f.outputs.push('{"replacement":"Merged."}'); f.failNextSave(2);
  expect((await f.request('mergeSwipes', data)).ok).toBe(false); expect(m.swipes).toHaveLength(4); expect(f.state().story.merges[0].status).toBe('prepared');
  expect((await f.request('undoMerge', { id: f.state().story.merges[0].id })).ok).toBe(true); expect(m.swipes).toHaveLength(3);
});
test('automatic naming counts new message IDs, ignores swipe ticks, and honors 10–50 bounds', async () => {
  const f = fake(); await f.ready(); f.state().settings.autoName = true; f.state().settings.nameInterval = 10;
  await f.request('storyTick', { messageId: 'm1', countNew: false }); expect(f.modelInputs).toHaveLength(0);
  f.outputs.push('{"name":"Elias and the Missing Key"}'); await f.request('storyTick', { messageId: 'm1', countNew: true });
  expect(f.chats.get('chat-a')!.name).toBe('Elias and the Missing Key');
  await f.request('storyTick', { messageId: 'm1', countNew: true }); expect(f.modelInputs).toHaveLength(1);
  for (let i = 1; i <= 10; i++) {
    f.messages.get('chat-a')!.push({ ...f.messages.get('chat-a')![0], id: `new-${i}`, content: `Event ${i}`, index_in_chat: i });
    if (i === 10) f.outputs.push('{"name":"The Key Returns at Midnight"}');
    await f.request('storyTick', { messageId: `new-${i}`, countNew: true });
    expect(f.modelInputs.length).toBe(i === 10 ? 2 : 1);
  }
  expect(() => settings({ ...DEFAULTS, nameInterval: 9 })).toThrow(); expect(() => settings({ ...DEFAULTS, nameInterval: 51 })).toThrow();
  const latest = f.state().story.names.at(-1)!; await f.request('undoName', { id: latest.id }); expect(f.chats.get('chat-a')!.name).toBe('Elias and the Missing Key');
});
test('naming detects a manual rename during generation and refuses Undo over a later title', async () => {
  const f = fake(); await f.ready(); const gate = deferred(); f.setGate(() => gate.promise); f.outputs.push('{"name":"Kazz title"}');
  const pending = f.request('nameChat'); await until(() => f.modelInputs.length === 1); f.chats.get('chat-a')!.name = 'My own title'; gate.resolve();
  expect((await pending).ok).toBe(false); expect(f.chats.get('chat-a')!.name).toBe('My own title');
  f.setGate(undefined); f.outputs.push('{"name":"Another title"}'); await f.request('nameChat'); f.chats.get('chat-a')!.name = 'Handwritten';
  expect((await f.request('undoName', { id: f.state().story.names[0].id })).ok).toBe(false);
});
test('Summary+ supports edits, unknown dates and stale-source exclusion from prompt injection', async () => {
  const f = fake(); await f.ready(); f.outputs.push(summary()); await f.request('timelineMessage', { messageId: 'm1' });
  const entry = f.state().story.timeline[0]; expect(entry.storyDate).toBe(''); expect(entry.storyTime).toBe('midnight');
  await f.request('timelineSave', { ...entry, summary: 'Elias waits.\nThe key is missing.', storyDate: 'Day 3' });
  expect(f.state().story.timeline[0].manual).toBe(true);
  f.state().settings.timelineInject = true;
  const result = await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context()) as InterceptorResultDTO;
  expect(result.messages).toHaveLength(3); expect(result.messages[1].content).toContain('Day 3'); expect(result.breakdown?.[0].messageIndex).toBe(1); expect(result.messages.at(-1)).toEqual(prompt.at(-1));
  f.messages.get('chat-a')![0].swipe_id = 1;
  expect(await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context())).toEqual(prompt);
  const view = (await f.request('load')).result as { state: { story: { timeline: { stale: boolean }[] } } }; expect(view.state.story.timeline[0].stale).toBe(true);
  expect((await f.request('timelineSave', { ...entry, summary: 'one\ntwo\nthree' })).ok).toBe(false);
});
test('automatic summaries dedupe current swipes, preserve manual notes and reject changed messages', async () => {
  const f = fake(); await f.ready(); f.state().settings.timelineAuto = true; f.outputs.push(summary());
  await f.request('storyTick', { messageId: 'm1' }); await f.request('storyTick', { messageId: 'm1' }); expect(f.modelInputs).toHaveLength(1);
  const entry = f.state().story.timeline[0]; await f.request('timelineSave', { ...entry, summary: 'A user-edited note.' }); await f.request('storyTick', { messageId: 'm1' }); expect(f.state().story.timeline[0].summary).toBe('A user-edited note.');
  f.messages.get('chat-a')![0].content = 'Changed text.'; const gate = deferred(); f.setGate(() => gate.promise); f.outputs.push(summary());
  const pending = f.request('timelineMessage', { messageId: 'm1' }); await until(() => f.modelInputs.length === 2); f.messages.get('chat-a')![0].content = 'Changed again.'; gate.resolve();
  expect((await pending).ok).toBe(false); expect(f.state().story.timeline[0].summary).toBe('A user-edited note.');
});
test('future beats wait for their threshold, can be deferred, and never appear as established history', async () => {
  const f = fake(); await f.ready(); f.state().settings.spoilersEnabled = true;
  await f.request('spoilerSave', { text: 'A letter arrives.', afterMessages: 2 }); const id = f.state().story.spoilers[0].id;
  await f.request('planSpoilers'); expect(f.modelInputs).toHaveLength(0);
  const base = f.messages.get('chat-a')![0]; f.messages.get('chat-a')!.push({ ...base, id: 'm3', is_user: true, index_in_chat: 1 }, { ...base, id: 'm4', index_in_chat: 2 });
  f.outputs.push('{"readyId":null,"reason":"The argument needs room."}'); await f.request('planSpoilers'); expect(f.state().story.spoilers[0].status).toBe('planned');
  expect(await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context())).toEqual(prompt);
  f.outputs.push(JSON.stringify({ readyId: id, reason: 'The scene has settled.' })); await f.request('planSpoilers');
  const result = await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context()) as InterceptorResultDTO;
  expect(result.messages[1].content).toContain('FUTURE INTENT — NOT ESTABLISHED HISTORY'); expect(result.messages[1].content).toContain('A letter arrives.');
  await f.request('spoilerSave', { id, text: 'A letter arrives.', afterMessages: 2, status: 'fulfilled' });
  expect(await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context())).toEqual(prompt);
});
test('prompt hook isolates users, skips quiet calls, and excludes future/rejected history on regeneration', async () => {
  const f = fake(); await f.ready(); f.state().settings.timelineInject = true; f.outputs.push(summary()); await f.request('timelineMessage', { messageId: 'm1' });
  expect(await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context({ userId: 'bob' }))).toEqual(prompt);
  expect(await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context({ generationType: 'quiet' }))).toEqual(prompt);
  expect(await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context({ generationType: 'swipe', excludeMessageId: 'm1' }))).toEqual(prompt);
  const abort = new AbortController(); abort.abort(); expect(await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context({ signal: abort.signal }))).toEqual(prompt);
});
test('a newer reply invalidates a ready future beat; edited events require reassessment', async () => {
  const f = fake(); await f.ready(); f.state().settings.spoilersEnabled = true;
  await f.request('spoilerSave', { text: 'The door opens.', afterMessages: null }); const id = f.state().story.spoilers[0].id;
  f.outputs.push(JSON.stringify({ readyId: id, reason: 'Natural pause.' })); await f.request('planSpoilers');
  f.messages.get('chat-a')!.push({ ...f.messages.get('chat-a')![0], id: 'm3', index_in_chat: 1 });
  expect(await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context())).toEqual(prompt);
  await f.request('spoilerSave', { id, text: 'A different door opens.', afterMessages: null }); expect(f.state().story.spoilers[0].status).toBe('planned');
});

test('revisiting a summarized swipe restores its edited note without another provider call', async () => {
  const f = fake(); await f.ready(); f.state().settings.timelineAuto = true;
  const m = f.messages.get('chat-a')![0], original = m.content;
  f.outputs.push(summary()); await f.request('storyTick', { messageId: m.id });
  await f.request('timelineSave', { ...f.state().story.timeline[0], summary: 'My precise note for swipe one.' });
  m.swipe_id = 1; m.content = 'Alternate events.'; f.outputs.push(summary('A different event.'));
  await f.request('storyTick', { messageId: m.id });
  m.swipe_id = 0; m.content = original; await f.request('storyTick', { messageId: m.id });
  expect(f.state().story.timeline[0].summary).toBe('My precise note for swipe one.');
  expect(f.state().story.timeline[0].manual).toBe(true); expect(f.modelInputs).toHaveLength(2);
  const view = (await f.request('load')).result as { state: { story: Record<string, unknown> } };
  expect(view.state.story).not.toHaveProperty('timelineVersions');
  await f.request('timelineDelete', { id: f.state().story.timeline[0].id });
  m.swipe_id = 1; m.content = 'Alternate events.'; await f.request('storyTick', { messageId: m.id });
  expect(f.state().story.timeline).toHaveLength(0);
});

test('editing an earlier message invalidates scene readiness even when the latest reply is unchanged', async () => {
  const f = fake(); await f.ready(); f.state().settings.spoilersEnabled = true;
  await f.request('spoilerSave', { text: 'A visitor arrives.', afterMessages: null });
  f.outputs.push(JSON.stringify({ readyId: f.state().story.spoilers[0].id, reason: 'The scene is calm.' }));
  await f.request('planSpoilers');
  f.messages.get('chat-a')![0].content = 'An earlier scene was changed into an unresolved crisis.';
  expect(await timelinePrompt(f.api as unknown as SpindleAPI, prompt, context())).toEqual(prompt);
});
