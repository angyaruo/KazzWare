import type { SpindleDOMHelper, SpindleSandboxFrameHandle } from 'lumiverse-spindle-types';
import { escapeHTML as e, object, type GalleryPage, type ViewState } from './shared';
import { galleryHTML } from './gallery';

const STYLE = `:host{display:block;margin:18px 0 4px;color:#eceef0;font:14px/1.5 system-ui;isolation:isolate}*{box-sizing:border-box}[hidden]{display:none!important}button{cursor:pointer;font:700 13px/1.4 ui-monospace,monospace;color:#d0d3d9;background:#12171d;border:1px solid #d0d3d9;box-shadow:0 3px 10px #0004;backdrop-filter:blur(12px);border-radius:12px;padding:12px 15px;text-align:left;min-height:44px;max-width:100%;overflow-wrap:anywhere}button:hover{border-color:#ff3b58;box-shadow:0 0 15px #ff3b5840}button:focus-visible{outline:3px solid #ff3b58;outline-offset:4px}small{display:block;color:#b9bdc5;font:10px/1.6 ui-monospace,monospace}strong{display:block;margin-top:4px;color:#eceef0}.feed{margin-top:14px;background:#0c0e12;border:2px solid #7b8e9a;padding:8px;max-width:520px;border-radius:5px}.feed iframe{display:block;width:100%;border:0}.status{margin:8px 0;color:#d0d3d9;font:12px/1.5 system-ui}.reload{margin-top:8px;box-shadow:none}`;
type Entry = { wrapper: Element; shadow: ShadowRoot; page: ViewState['pages'][number]; open: boolean; sequence: number; frame?: SpindleSandboxFrameHandle };

export function inlineGallery(dom: SpindleDOMHelper, load: (id: string) => Promise<GalleryPage | null>, react: (data: Record<string, unknown>) => Promise<boolean>) {
  const entries = new Map<string, Entry>();
  async function expand(entry: Entry) {
    const sequence = ++entry.sequence;
    entry.frame?.destroy(); entry.frame = undefined;
    const status = entry.shadow.querySelector('.status')!;
    status.textContent = 'Tuning into the local drama…';
    try {
      const page = await load(entry.page.id);
      if (entries.get(entry.page.id) !== entry || !entry.open || sequence !== entry.sequence) return;
      if (!page) throw new Error('This saved page is no longer available.');
      const frame = dom.createSandboxFrame({ html: galleryHTML(page), autoResize: false, minHeight: 350, initialHeight: 440, maxHeight: 440 });
      entry.frame = frame; frame.element.title = 'Fictional Peanut Gallery page';
      entry.shadow.querySelector('.screen')!.append(frame.element); status.textContent = '';
      frame.onMessage(async payload => {
        if (entries.get(page.id) !== entry || !entry.open || sequence !== entry.sequence) return;
        let data: Record<string, unknown>; try { data = object(payload); } catch { return; }
        if (!['vote', 'comment'].includes(String(data.kind)) || !page.posts.some(p => p.id === data.postId)) return;
        status.textContent = 'Saving…';
        const ok = await react({ pageId: page.id, kind: data.kind, postId: data.postId, text: data.text });
        if (entries.get(page.id) !== entry || !entry.open || sequence !== entry.sequence) return;
        if (ok) await expand(entry); else status.textContent = 'Could not save. Kazz may be busy; try again.';
      });
    } catch (error) { if (entries.get(entry.page.id) === entry && sequence === entry.sequence) status.textContent = (error as Error).message; }
  }
  function retire(id: string, entry: Entry) { ++entry.sequence; entry.frame?.destroy(); dom.uninject(entry.wrapper); entries.delete(id); }
  return {
    sync(pages: ViewState['pages'], enabled: boolean) {
      for (const [id, entry] of entries) if (!enabled || !pages.some(page => page.id === id && page.throughMessage === entry.page.throughMessage)) retire(id, entry);
      if (!enabled) return;
      for (const page of pages) {
        if (entries.has(page.id)) continue;
        const message = dom.findMessageElement(page.throughMessage); if (!message) continue;
        const wrapper = dom.inject(message, '', 'beforeend'); wrapper.setAttribute('data-kazzware-owned', 'gallery');
        const shadow = wrapper.attachShadow({ mode: 'open' });
        shadow.innerHTML = `<style>${STYLE}</style><button class="toggle" aria-expanded="false"><small>KAZZNET / PEANUT GALLERY · ${e(page.format.toUpperCase())}</small><strong>${e(page.title)} ↗</strong></button><section class="feed" hidden><div class="status" role="status"></div><div class="screen"></div><button class="reload">Reload page</button></section>`;
        const entry: Entry = { wrapper, shadow, page, open: false, sequence: 0 }; entries.set(page.id, entry);
        // Keep these controls out of native message picking and selection handling.
        wrapper.addEventListener('pointerdown', event => event.stopPropagation());
        wrapper.addEventListener('click', event => event.stopPropagation());
        shadow.querySelector('.toggle')!.addEventListener('click', () => {
          entry.open = !entry.open; shadow.querySelector('.toggle')!.setAttribute('aria-expanded', String(entry.open));
          (shadow.querySelector('.feed') as HTMLElement).hidden = !entry.open;
          if (entry.open) void expand(entry); else { ++entry.sequence; entry.frame?.destroy(); entry.frame = undefined; }
        });
        shadow.querySelector('.reload')!.addEventListener('click', () => { void expand(entry); });
      }
    },
    clear() { for (const [id, entry] of entries) retire(id, entry); },
  };
}
