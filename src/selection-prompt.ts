import type { SpindleDOMHelper } from 'lumiverse-spindle-types';
import type { Message, Range } from './shared';
import { nativeRange, readNativeSelection, type NativeSelection } from './native-selection';

type Options = {
  available(): boolean;
  load(id: string): Promise<Message>;
  pin(): void;
  open(message: Message, range: Range, direction: string): void;
  edit(message: Message, range: Range, direction: string): Promise<{ ok: boolean; undoId?: string; error?: string }>;
  undo(id: string): Promise<boolean>;
};
export function selectionPrompt(dom: SpindleDOMHelper, options: Options) {
  const portal = dom.createElement('div'); portal.dataset.kazzwareOwned = 'selection';
  Object.assign(portal.style, { position: 'fixed', zIndex: '2147483000', width: 'min(350px, calc(100vw - 16px))', pointerEvents: 'auto' });
  document.body.append(portal); portal.hidden = true;
  const root = portal.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>:host{color:#eceef0;font:13px/1.5 system-ui;color-scheme:dark}*{box-sizing:border-box}[hidden]{display:none!important}form{margin:0;padding:12px;background:#17191df2;border:2px solid #d0d3d9;box-shadow:0 6px 20px #0005;backdrop-filter:blur(12px);border-radius:14px}header{display:flex;align-items:center;gap:8px;font:700 12px ui-monospace,monospace;color:#d0d3d9}header button{margin-left:auto}button,input{font:inherit;border:1px solid #686c74;border-radius:8px;color:#eceef0;background:#23262c;min-height:44px;padding:8px}button{cursor:pointer}button:disabled{opacity:.45;cursor:wait}input{width:100%;font-size:16px;margin:10px 0;background:#0b1015}label{display:block;margin-top:7px}button:hover:enabled{border-color:#ff3b58;box-shadow:0 0 15px #ff3b5840}button:focus-visible,input:focus-visible{outline:2px solid #ff3b58;outline-offset:2px}.quote{font-size:11px;color:#b9bdc5;overflow:hidden;max-height:3em;overflow-wrap:anywhere;margin:8px 0}.actions{display:flex;gap:8px;flex-wrap:wrap}.apply{background:#eceef0;color:#0c0e12;font-weight:800}.feedback{margin-top:8px;font-size:12px;color:#eceef0}.feedback.error{color:#ffadb5}</style><form aria-label="Edit highlighted text"><header>✂ KAZZ / JUST THIS BIT<button type="button" class="close" aria-label="Close selection editor">×</button></header><div class="quote"></div><label for="selection-direction">What should change?</label><input id="selection-direction" maxlength="8000" placeholder="Shorter? Different POV? Spit it out…" autocomplete="off"><div class="actions"><button class="apply" type="submit" disabled>Edit selection</button><button class="more" type="button" disabled>More options ↗</button><button class="undo" type="button" hidden>Undo edit</button></div><div class="feedback" role="status" aria-live="polite"></div></form>`;
  const input = root.querySelector<HTMLInputElement>('input')!, apply = root.querySelector<HTMLButtonElement>('.apply')!, more = root.querySelector<HTMLButtonElement>('.more')!, undo = root.querySelector<HTMLButtonElement>('.undo')!, feedback = root.querySelector<HTMLElement>('.feedback')!;
  let sequence = 0, timer: ReturnType<typeof setTimeout> | undefined, selected: NativeSelection | undefined;
  let message: Message | undefined, range: Range | undefined, undoId = '', working = false, dismissed = '';
  let lastAnchor: DOMRect | undefined;
  let pointerHeld = false;
  const signature = (selection: NativeSelection) => selection.messageId + '\0' + selection.text;
  const say = (text: string, error = false) => { feedback.textContent = text; feedback.classList.toggle('error', error); };
  const close = () => { if (selected) dismissed = signature(selected); ++sequence; clearTimeout(timer); selected = undefined; message = undefined; range = undefined; portal.hidden = true; working = false; };
  function position() {
    if (portal.hidden || !selected) return;
    if (!selected.domRange.startContainer.isConnected && !working && !undoId) { close(); return; }
    const measured = selected.domRange.getBoundingClientRect?.();
    if (measured && (measured.width || measured.height)) lastAnchor = measured;
    const rect = lastAnchor; if (!rect) return;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0, width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
    const box = portal.getBoundingClientRect();
    portal.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - box.width - 8))}px`;
    portal.style.top = `${Math.max(top + 8, Math.min(rect.bottom + 10 + box.height <= top + height - 8 ? rect.bottom + 10 : rect.top - box.height - 10, top + height - box.height - 8))}px`;
    portal.style.maxHeight = `${Math.max(100, height - 16)}px`; portal.style.overflowY = 'auto';
  }
  function capture() {
    if (!options.available() || working || document.activeElement === portal) return;
    const next = readNativeSelection(dom);
    if (!next) { if (!undoId) close(); dismissed = ''; return; }
    if (signature(next) === dismissed || (selected && signature(next) === signature(selected))) return;
    clearTimeout(timer);
    ++sequence; selected = next; lastAnchor = undefined; message = undefined; range = undefined; undoId = ''; undo.hidden = true; input.value = ''; input.disabled = false;
    apply.disabled = true; more.disabled = true; options.pin();
    root.querySelector('.quote')!.textContent = next.text.slice(0, 200); say('Checking the highlight…');
    portal.hidden = false; position();
    const request = sequence;
    void options.load(next.messageId).then(value => {
      if (request !== sequence || !options.available()) return;
      message = value; range = nativeRange(value.content, next.text);
      if (!range) { say('Cannot match this highlight uniquely. Select a smaller plain-text passage in the message.', true); return; }
      more.disabled = false; apply.disabled = !input.value.trim();
      say(`Only this passage · ${range.end - range.start} characters`); position();
    }).catch(error => { if (request === sequence) say((error as Error).message, true); });
  }
  input.addEventListener('input', () => { apply.disabled = working || !range || !input.value.trim(); });
  root.querySelector('.close')!.addEventListener('click', close);
  more.addEventListener('click', () => { if (!message || !range || working || !options.available()) return; options.open(message, range, input.value); close(); });
  root.querySelector('form')!.addEventListener('submit', async event => {
    event.preventDefault();
    if (!message || !range || !input.value.trim() || !options.available() || working) return;
    const request = sequence; working = true; apply.disabled = more.disabled = input.disabled = true; say('Stitching it up…');
    const result = await options.edit(message, range, input.value);
    if (request !== sequence) return;
    working = false;
    if (result.ok) { range = undefined; undoId = result.undoId || ''; undo.hidden = !undoId; say('Done. Everything outside the highlight stayed intact.'); }
    else { apply.disabled = more.disabled = input.disabled = false; say(result.error || 'Could not edit. Select the passage again if the message changed.', true); }
    position();
  });
  undo.addEventListener('click', async () => {
    if (!undoId || working || !options.available()) return;
    const request = sequence; working = true; undo.disabled = true;
    const ok = await options.undo(undoId); if (request !== sequence) return;
    working = false; undo.disabled = false; if (ok) { undo.hidden = true; say('Undone. Original wording restored.'); } else say('Undo could not be applied. Check Editor for details.', true);
  });
  const escape = (event: KeyboardEvent) => { if (!portal.hidden && event.key === 'Escape') { event.stopImmediatePropagation(); close(); } };
  // Selection changes fire repeatedly during mouse drags and mobile handle moves.
  // Delay the *surface*, not just the lookup; never place controls under a held pointer.
  const schedule = () => {
    clearTimeout(timer);
    if (pointerHeld || working || document.activeElement === portal) return;
    const next = readNativeSelection(dom);
    if (selected && (!next || signature(next) !== signature(selected))) close();
    timer = setTimeout(capture, 160);
  };
  const outside = (event: PointerEvent) => {
    if (event.composedPath().includes(portal)) return;
    pointerHeld = true; close();
  };
  const release = () => { pointerHeld = false; schedule(); };
  const cancel = () => { pointerHeld = false; close(); };
  document.addEventListener('selectionchange', schedule); window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', cancel, true); window.addEventListener('blur', cancel);
  document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escape, true);
  document.addEventListener('scroll', position, true); window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position); window.visualViewport?.addEventListener('scroll', position);
  return { close, reset() { pointerHeld = false; close(); dismissed = ''; }, destroy() {
    close(); portal.remove(); document.removeEventListener('selectionchange', schedule); window.removeEventListener('pointerup', release, true);
    window.removeEventListener('pointercancel', cancel, true); window.removeEventListener('blur', cancel);
    document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true);
    document.removeEventListener('scroll', position, true); window.removeEventListener('resize', position);
    window.visualViewport?.removeEventListener('resize', position); window.visualViewport?.removeEventListener('scroll', position);
  } };
}
