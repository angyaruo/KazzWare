import type { State, ConversationInfo } from './shared';

export const MAX_CONVERSATIONS = 50;
export function migrateConversations(state: State) {
  state.conversation ??= { id: 'initial', title: 'Conversation with Kazz', createdAt: state.turns[0]?.at || Date.now(), updatedAt: state.turns.at(-1)?.at || Date.now() };
  state.conversations ??= [];
}
export function expectConversation(state: State, id: unknown) {
  if (id !== undefined && id !== state.conversation.id) throw new Error('The Kazz conversation changed. Reload before trying again.');
}
function archive(state: State) {
  if (!state.turns.length) return;
  if (state.conversations.length >= MAX_CONVERSATIONS) throw new Error('There are 50 saved conversations in this roleplay. Delete an old one in Manage chats first.');
  state.conversations.push({ ...state.conversation, turns: state.turns });
}
export function newConversation(state: State) {
  archive(state);
  state.conversation = { id: crypto.randomUUID(), title: 'New conversation', createdAt: Date.now(), updatedAt: Date.now() };
  state.turns = [];
}
export function switchConversation(state: State, id: string) {
  const saved = state.conversations.find(c => c.id === id);
  if (!saved) throw new Error('That saved Kazz conversation is no longer available.');
  state.conversations = state.conversations.filter(c => c.id !== id);
  archive(state);
  const { turns, ...info } = saved;
  state.conversation = info;
  state.turns = turns;
}
export function conversationInfo(info: ConversationInfo, turns: State['turns']) {
  return { ...info, turnCount: turns.length };
}
