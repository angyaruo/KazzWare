import { escapeHTML as e, type ViewState } from './shared';

export type ChatStream = { conversationId: string; user: string; text: string };
export const CHAT_CSS = `
.chat-layout{height:100%;min-height:0;display:flex;flex-direction:column;gap:10px}
.chat-session{pointer-events:auto;display:flex;align-items:baseline;gap:12px;padding:9px 12px;background:#0d1118ed;border-left:2px solid var(--glow);border-radius:2px 9px 2px 2px}
.chat-session strong{font:700 13px var(--display);white-space:nowrap}.chat-session>span{font:10px var(--mono);color:#b2bac6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.chat-composer-block{position:relative;flex-shrink:0}.chat-perch{position:relative;height:104px;pointer-events:none;z-index:2}
.chat-perch img{position:absolute;left:9%;bottom:-12px;width:66%;height:140px;object-fit:contain;filter:drop-shadow(0 4px 8px #0009)}
.chat-actions{position:absolute;right:5px;bottom:12px;display:flex;gap:6px;align-items:center;pointer-events:auto}
.chat-icon{min-height:38px;width:38px;padding:0;border:1px solid #a44659;border-radius:3px 9px 3px 3px;background:#111720f5;color:#f4f4f5;font:24px/1 var(--mono);box-shadow:inset 0 1px #ffffff16,0 0 10px #ff24451c}
.chat-icon:hover:enabled,.chat-icon:focus-visible{border-color:var(--glow);box-shadow:0 0 12px #ff24453d}.chat-options{position:relative}.chat-popover{position:absolute;top:calc(100% + 6px);right:0;z-index:5;width:162px;padding:6px;background:#11151c;border:1px solid #b44a5d;border-radius:4px;box-shadow:0 8px 20px #000b}.chat-popover button{display:block;width:100%;text-align:left;font-size:12px;padding:10px 8px;border:0;background:none}.chat-popover button:hover:enabled{background:#ff284524}
.chat-compose{position:relative;pointer-events:auto;background:linear-gradient(130deg,#202632ea,#0c1017f2 70%);backdrop-filter:blur(12px);border:1px solid #824052;border-radius:3px 12px 3px 3px;padding:10px 12px 8px;box-shadow:inset 0 1px #ffffff1a,0 4px 18px #0005;margin:0}
.chat-compose>label{font:700 10px var(--mono);letter-spacing:1px;color:#e5e8ed}.chat-compose textarea{margin-top:6px;min-height:56px;max-height:140px;font:14px/1.5 system-ui;border-color:#414b5a;background:#0c1118cc;resize:vertical}.chat-compose .send{display:block;min-height:30px;padding:4px 16px;margin:6px 0 0 auto;font-size:12px}
.transcript{pointer-events:auto;display:flex;flex-direction:column;gap:12px;min-height:84px;max-height:none;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#824052 transparent;padding:3px 6px 6px 0;flex:1}
.bubble{pointer-events:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#0e131bf5;color:#e9edf2;border:1px solid #45505e;border-radius:2px 13px 13px 13px;padding:11px 13px;font-size:13px;line-height:1.6;margin-right:22px;box-shadow:0 4px 14px #0004;flex-shrink:0}.bubble.user{margin:0 0 0 32px;background:#dfe4eb;color:#11151b;border-color:#dfe4eb;border-radius:13px 2px 13px 13px}.speaker{display:block;font:700 9px var(--mono);letter-spacing:1px;opacity:.7;margin-bottom:5px}.chat-pending{display:flex;flex-direction:column;gap:12px;flex-shrink:0}.chat-pending[hidden],.typing[hidden]{display:none}.typing{color:#bec7d4;font-style:italic}.typing-dots{display:inline-flex;padding-left:2px}.typing-dots i{font-style:normal;animation:typing-dot 1.2s ease-in-out infinite}.typing-dots i:nth-child(2){animation-delay:.16s}.typing-dots i:nth-child(3){animation-delay:.32s}@keyframes typing-dot{0%,70%,100%{opacity:.3;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}
.chat-empty{background:#0d1219e8;padding:13px;border:1px dashed #616774;border-radius:3px 12px 3px 3px}.chat-empty strong{font-size:14px}.chat-empty p{font-size:12px;color:#b9c1cd;margin:5px 0 0}.chat-disclaimer{pointer-events:auto;display:block;background:#0d1118ed;padding:7px 10px;border-radius:3px;font-size:10px;color:#b9c1cd;line-height:1.5}
.chat-manager,.reset-chat-confirm{pointer-events:auto;background:#111720f7;border:1px solid #8e4052;border-radius:3px 12px 3px 3px;padding:12px}.chat-manager-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px}.chat-manager small{font-size:10px;color:#b9c1cd}.saved-chats{max-height:220px;overflow:auto;margin-top:8px;scrollbar-width:thin}.saved-chat{display:flex;gap:6px;align-items:center;border-top:1px solid #3d4552;padding:7px 0}.open-conversation{flex:1;min-width:0;text-align:left;border:0;background:none;padding:5px}.open-conversation strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.open-conversation small{display:block;margin-top:4px}.delete-conversation{flex-shrink:0;font-size:20px}.saved-chats p,.reset-chat-confirm p{font-size:12px;line-height:1.6}.reset-chat-confirm .row{margin-top:12px}.reset-chat-confirm button{font-size:12px}.reset-chat-confirm .confirm-reset-chat{border-color:var(--glow)}
.chat-layout:has(.chat-manager:not([hidden])),.chat-layout:has(.reset-chat-confirm:not([hidden])){height:auto;min-height:100%}.chat-layout:has(.chat-manager:not([hidden])) .transcript,.chat-layout:has(.reset-chat-confirm:not([hidden])) .transcript{flex:none;max-height:200px}
@media(max-height:550px){.chat-layout{height:auto;min-height:100%}.transcript{flex:none;max-height:160px}}
@container kazz (max-width:340px){.chat-perch{height:100px}.chat-perch img{left:1%;height:133px;width:70%}.chat-actions{right:0;gap:5px}.chat-icon{width:36px;min-height:36px}.chat-compose{padding:12px 10px 9px}.chat-session{gap:8px}.chat-session strong{font-size:12px}.chat-compose textarea{font-size:16px}.bubble{font-size:13px;margin-right:10px}.bubble.user{margin-left:16px}}
@media(prefers-reduced-motion:reduce){.typing-dots i{animation:none}}
`;
type ChatUI = {
  state: ViewState; illustration: string; draft: string; stream?: ChatStream;
  busy(): boolean; draftChanged(text: string): void; submit(text: string): void;
  action(action: string, data?: Record<string, unknown>): Promise<boolean>;
};
export function paintChatStream(root: HTMLElement, stream?: ChatStream) {
  const transcript = root.querySelector<HTMLElement>('.transcript');
  const pending = root.querySelector<HTMLElement>('.chat-pending');
  if (!transcript || !pending || !stream) return;
  const follow = transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop < 72;
  pending.hidden = false;
  root.querySelector<HTMLElement>('.chat-empty')?.setAttribute('hidden', '');
  pending.querySelector('.pending-user')!.textContent = stream.user;
  pending.querySelector('.stream-text')!.textContent = stream.text;
  pending.querySelector<HTMLElement>('.typing')!.hidden = !!stream.text;
  if (follow) transcript.scrollTop = transcript.scrollHeight;
}
export function mountChat(root: HTMLElement, ui: ChatUI) {
  const { state } = ui;
  root.innerHTML = `<div class="chat-layout"><div class="chat-session"><strong>Chat with Kazz</strong><span title="${e(state.conversation.title)}">${e(state.conversation.title)}</span></div>
    <div class="chat-composer-block"><div class="chat-perch"><img draggable="false" src="${ui.illustration}" alt="Kazz leaning on your direct line"><div class="chat-actions">
      <button class="new-kazz-chat chat-icon" aria-label="New chat with Kazz" title="New chat · saves this conversation" data-mutate>+</button>
      <div class="chat-options"><button class="chat-more chat-icon" aria-label="More chat options" aria-expanded="false" aria-controls="kazz-chat-options" title="More chat options">…</button><div id="kazz-chat-options" class="chat-popover" hidden><button class="manage-chats">Manage chats</button><button class="clear-chat" data-mutate>Clear history</button></div></div>
    </div></div><form class="chat-compose"><label for="kazz-ask">YOUR DIRECT LINE / KAZZ</label><textarea id="kazz-ask" class="ask" placeholder="Alright, Kazz…" maxlength="8000">${e(ui.draft)}</textarea><button class="primary send" type="submit" data-mutate>Send ↗</button></form></div>
    <section class="chat-manager" aria-label="Saved Kazz chats" hidden><div class="chat-manager-heading"><strong>Saved chats</strong><button class="close-manager chat-icon" aria-label="Close saved chats">×</button></div><small>Saved within this roleplay · ${state.conversations.length} / 50</small><div class="saved-chats">${[...state.conversations].sort((a, b) => b.updatedAt - a.updatedAt).map(c => `<div class="saved-chat"><button class="open-conversation" data-id="${e(c.id)}" data-mutate><strong>${e(c.title)}</strong><small>${new Date(c.updatedAt).toLocaleString()} · ${c.turnCount} messages</small></button><button class="delete-conversation chat-icon" data-id="${e(c.id)}" aria-label="Delete ${e(c.title)}" title="Delete saved chat" data-mutate>×</button></div>`).join('') || '<p>No saved chats yet. + saves this conversation and opens a fresh one.</p>'}</div></section>
    <section class="reset-chat-confirm" role="group" aria-label="Confirm clearing chat history" hidden><p></p><div class="row"><button class="confirm-reset-chat" data-mutate>Clear history</button><button class="cancel-reset-chat">Cancel</button></div></section>
    <div class="transcript" role="log" aria-label="Conversation with Kazz" tabindex="0">${state.turns.map(t => `<div class="bubble ${t.role}"><span class="speaker">${t.role === 'user' ? 'YOU' : 'KAZZ'}</span>${e(t.content)}</div>`).join('') || '<div class="chat-empty"><strong>I’m listening.</strong><p>Type above to start a conversation.</p></div>'}<div class="chat-pending" hidden><div class="bubble user"><span class="speaker">YOU</span><span class="pending-user"></span></div><div class="bubble assistant" aria-live="off"><span class="speaker">KAZZ</span><span class="typing" role="status" aria-label="Kazz is typing">Kazz is typing<span class="typing-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></span><span class="stream-text"></span></div></div></div>
    <small class="chat-disclaimer">Private Kazz chat · edits have Undo.</small></div>`;
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const on = (selector: string, action: () => void) => get(selector).addEventListener('click', action);
  const options = get('.chat-popover'), more = get<HTMLButtonElement>('.chat-more'), manager = get('.chat-manager'), confirm = get('.reset-chat-confirm');
  let deleteId: string | undefined;
  function closeOptions() { options.hidden = true; more.setAttribute('aria-expanded', 'false'); }
  function hideConfirm() { confirm.hidden = true; deleteId = undefined; }
  function showConfirm(id?: string) {
    if (ui.busy()) return;
    closeOptions(); deleteId = id; confirm.hidden = false;
    get('.reset-chat-confirm p').textContent = id ? 'Delete this saved Kazz conversation? This cannot be undone. Your current conversation stays open.' : 'Clear this Kazz conversation’s history? This cannot be undone. Saved chats, roleplay messages, notes and Undo stay saved.';
    get('.confirm-reset-chat').textContent = id ? 'Delete saved chat' : 'Clear history';
    get('.cancel-reset-chat').focus();
  }
  on('.chat-more', () => { options.hidden = !options.hidden; more.setAttribute('aria-expanded', String(!options.hidden)); });
  on('.new-kazz-chat', () => { if (!ui.busy()) void ui.action('newConversation'); });
  on('.manage-chats', () => { closeOptions(); hideConfirm(); manager.hidden = false; get('.close-manager').focus(); });
  on('.close-manager', () => { manager.hidden = true; hideConfirm(); more.focus(); });
  on('.clear-chat', () => showConfirm());
  on('.cancel-reset-chat', () => { hideConfirm(); more.focus(); });
  on('.confirm-reset-chat', () => { if (!ui.busy()) void ui.action(deleteId ? 'deleteConversation' : 'resetChat', deleteId ? { id: deleteId } : {}); });
  root.querySelectorAll<HTMLButtonElement>('.open-conversation').forEach(b => b.addEventListener('click', () => { if (!ui.busy()) void ui.action('switchConversation', { id: b.dataset.id }); }));
  root.querySelectorAll<HTMLButtonElement>('.delete-conversation').forEach(b => b.addEventListener('click', () => showConfirm(b.dataset.id)));
  // Property handlers replace old mounts; no accumulating document listeners.
  root.onclick = event => { if (!(event.target as Element).closest('.chat-options')) closeOptions(); };
  root.onkeydown = event => { if (event.key === 'Escape' && (!options.hidden || !confirm.hidden || !manager.hidden)) { closeOptions(); hideConfirm(); manager.hidden = true; more.focus(); event.stopPropagation(); } };
  get<HTMLTextAreaElement>('.ask').addEventListener('input', ev => ui.draftChanged((ev.target as HTMLTextAreaElement).value));
  get('form').addEventListener('submit', event => { event.preventDefault(); const text = get<HTMLTextAreaElement>('.ask').value; if (!ui.busy() && text.trim()) ui.submit(text); });
  paintChatStream(root, ui.stream);
  get('.transcript').scrollTop = get('.transcript').scrollHeight;
}
