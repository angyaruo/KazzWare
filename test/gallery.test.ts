import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { galleryHTML } from '../src/gallery';
test('untrusted fandom HTML cannot execute; trusted clicks/comments use a narrow bridge', () => {
  const sent: unknown[] = [];
  const dom = new JSDOM(galleryHTML({ id: 'page', title: '</title><script>window.pwned=1</script>', format: 'forum', createdAt: 0, throughMessage: 'm1', votes: [], comments: [], posts: [{ id: 'post', title: '<img onerror="pwned=1">', author: 'fan', body: '<script>window.pwned=2</script>' }] }), { runScripts: 'dangerously', beforeParse(window) { (window as unknown as { spindleSandbox: unknown }).spindleSandbox = { postMessage: (p: unknown) => sent.push(p) }; } });
  expect((dom.window as unknown as { pwned: unknown }).pwned).toBeUndefined(); expect(dom.window.document.querySelectorAll('script')).toHaveLength(1);
  dom.window.document.querySelector<HTMLButtonElement>('[data-vote]')!.click(); expect(sent[0]).toEqual({ kind: 'vote', postId: 'post' });
  dom.window.document.querySelector<HTMLButtonElement>('[data-reply]')!.click(); expect(dom.window.document.querySelector('form')!.hidden).toBe(false);
  dom.window.document.querySelector('textarea')!.value = 'My hot take'; dom.window.document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  expect(sent[1]).toEqual({ kind: 'comment', postId: 'post', text: 'My hot take' }); dom.window.close();
});
