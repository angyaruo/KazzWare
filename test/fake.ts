import type { SpindleAPI } from 'lumiverse-spindle-types';
import { KazzService } from '../src/service';
import { CHANNEL, emptyState, type Message, type Reply, type Request, type State } from '../src/shared';
type FakeMessage = Message & { swipes?: string[]; swipe_dates?: number[]; send_date?: number };
export function fake() {
  const store = new Map<string, State>(); const replies: Reply[] = []; const updates: { chat: string; id: string; content: string }[] = [];
  const modelInputs: unknown[] = []; const outputs: string[] = []; const books: unknown[] = [];
  const chats = new Map([['chat-a', { id: 'chat-a', character_id: 'character', name: 'The Lighthouse', metadata: { custom: true, chat_world_book_ids: ['existing'] } }], ['chat-b', { id: 'chat-b', character_id: 'character', name: 'Other chat', metadata: {} }]]);
  const messages = new Map<string, FakeMessage[]>([['chat-a', [{ id: 'm1', content: 'He watched the pale orbs. Then he waited.', name: 'Elias', is_user: false, swipe_id: 0, index_in_chat: 0 }]], ['chat-b', [{ id: 'm2', content: 'Different story.', name: 'Ari', is_user: false, swipe_id: 0, index_in_chat: 0 }]]]);
  let failSave = 0, saves = 0, finish = 'stop';
  let gate: (() => Promise<void>) | undefined;
  const api = {
    sendToFrontend: (reply: Reply) => { replies.push(structuredClone(reply)); },
    chats: { get: async (id: string, user: string) => user === 'alice' ? structuredClone(chats.get(id)) : null, update: async (id: string, input: Record<string, unknown>) => { const c = { ...chats.get(id)!, ...input }; chats.set(id, c); return c; }, getMemories: async () => [] },
    chat: { getMessages: async (id: string) => structuredClone(messages.get(id) || []), updateMessage: async (chat: string, id: string, patch: { content?: string; swipes?: string[]; swipe_id?: number; swipe_dates?: number[] }) => { const m = messages.get(chat)!.find(m => m.id === id)!; if (patch.swipes) m.swipes = [...patch.swipes]; if (patch.swipe_dates) m.swipe_dates = [...patch.swipe_dates]; if (patch.swipe_id !== undefined) m.swipe_id = patch.swipe_id; if (patch.content !== undefined) { m.content = patch.content; if (m.swipes?.length) m.swipes[m.swipe_id] = patch.content; } else if (m.swipes?.length) m.content = m.swipes[m.swipe_id]; updates.push({ chat, id, content: m.content }); } },
    connections: { list: async () => [{ id: 'connection', name: 'My connection', model: 'test', provider: 'test', api_key: 'NEVER-EXPOSE' }], get: async (id: string) => id === 'connection' ? { id } : null },
    characters: { get: async () => ({ name: 'Elias' }), list: async () => ({ data: [], total: 0 }) },
    personas: { getActive: async () => ({ name: 'Traveler' }) },
    world_books: { getActivated: async () => [], create: async (data: unknown) => { const b = { id: 'new-book', ...(data as object) }; books.push(b); return b; }, entries: { create: async (_id: string, data: unknown) => { books.push(data); return data; } } },
    userStorage: {
      getJson: async (path: string, options: { fallback: State; userId: string }) => structuredClone(store.get(`${options.userId}/${path}`) || options.fallback),
      setJson: async (path: string, value: State, options: { userId: string }) => { saves++; if (saves === failSave) throw new Error('Storage failed'); store.set(`${options.userId}/${path}`, structuredClone(value)); },
    },
    generate: { quietStream: async function* (input: unknown) { modelInputs.push(input); if (gate) await gate(); const content = outputs.shift() || ''; yield { type: 'done', content, finish_reason: finish }; } },
  };
  const service = new KazzService(api as unknown as SpindleAPI);
  let binding = 'binding-a', chatId: string | null = 'chat-a', sequence = 0;
  async function request(action: string, data: Record<string, unknown> = {}, extra: Partial<Request> = {}, user = 'alice', session = 'session-a') {
    const req: Request = { channel: CHANNEL, client: 'client-a', binding, id: `req-${++sequence}`, chatId, action, data, ...extra };
    await service.receive(req, user, session);
    return replies.filter(r => r.id === req.id && r.ok !== undefined).at(-1)!;
  }
  function state(id = 'chat-a') { return store.get(`alice/chats/${id}.json`) || emptyState(); }
  async function ready() { const s = emptyState(); s.settings.connectionId = 'connection'; store.set('alice/chats/chat-a.json', s); await request('bind'); }
  function editData() { const m = messages.get('chat-a')![0]; return { messageId: m.id, expected: m.content, swipe: m.swipe_id, direction: 'Use simpler wording' }; }
  return { service, api, store, replies, updates, modelInputs, outputs, books, chats, messages, request, ready, state, editData,
    switchChat(id: string | null) { chatId = id; binding = `binding-${++sequence}`; return request('bind'); },
    setGate(fn: (() => Promise<void>) | undefined) { gate = fn; }, failNextSave(offset = 1) { failSave = saves + offset; }, setFinish(value: string) { finish = value; } };
}
export function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
export async function until(check: () => boolean) { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(r => setTimeout(r, 2)); } throw new Error('Condition timed out'); }
