import { expect, test } from 'bun:test';
import type { View } from '../src/shared';
import { fake } from './fake';
test('routine UI replies exclude large undo snapshots and page bodies', async () => {
  const f = fake(); await f.ready(); const state = f.state();
  state.undo.push({ id: 'undo', label: 'Edit', messageId: 'm1', before: 'x'.repeat(100000), after: 'y'.repeat(100000), swipe: 0, createdAt: 0, status: 'applied' });
  state.pages.push({ id: 'page', title: 'Fandom', format: 'wiki', posts: [{ id: 'post', author: 'fan', title: 'Title', body: 'A'.repeat(8000) }], comments: [], votes: [], createdAt: 0, throughMessage: 'm1' });
  f.messages.get('chat-a')![0].content = 'z'.repeat(100000);
  const response = (await f.request('load')).result as View;
  expect(JSON.stringify(response).length).toBeLessThan(5000); expect(response.state.undo[0]).not.toHaveProperty('before');
  expect((await f.request('message', { messageId: 'm1' })).result).toMatchObject({ content: 'z'.repeat(100000) });
  expect((await f.request('page', { pageId: 'page' })).result).toMatchObject({ posts: [{ body: 'A'.repeat(8000) }] });
});
