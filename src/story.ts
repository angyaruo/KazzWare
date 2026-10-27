import type { SpindleAPI, InterceptorContextDTO, LlmMessageDTO, InterceptorResultDTO } from 'lumiverse-spindle-types';
import { DEFAULTS, emptyState, integer, object, parseJSON, string, type Message, type State } from './shared';
import { emptyStory, fingerprint, type SwipeSet, type StoryView, type TimelineEntry, type Spoiler } from './story-types';

export type StoryJob = {
  chatId: string; user: string; state: State; live(): void; save(): Promise<void>;
  messages(): Promise<Message[]>; context(through?: string): Promise<unknown>;
  model(instruction: string, data: unknown, tokens?: number): Promise<string>;
};
export function migrate(state: State) {
  state.settings = { ...DEFAULTS, ...state.settings };
  state.commented ??= []; state.story = { ...emptyStory(), ...state.story };
  return state;
}
const sourceHash = (message: Message) => fingerprint([message.swipe_id, message.content]);
const historyHash = (messages: Message[]) => fingerprint(messages.map(m => [m.id, m.swipe_id, m.content]));
const short = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
function summaryText(value: unknown) {
  const text = string(value, 'Message summary', 300).trim();
  if (text.split(/\r?\n/).length > 2) throw new Error('A message summary must contain at most two lines.');
  return text;
}
export async function storyView(state: State, messages: Message[]): Promise<StoryView> {
  const timeline = await Promise.all(state.story.timeline.map(async entry => {
    const m = messages.find(m => m.id === entry.messageId);
    return { ...entry, stale: !m || entry.sourceHash !== await sourceHash(m) };
  }));
  timeline.sort((a, b) => (messages.find(m => m.id === a.messageId)?.index_in_chat ?? Infinity) - (messages.find(m => m.id === b.messageId)?.index_in_chat ?? Infinity));
  const { timelineVersions, ...visible } = state.story;
  return { ...visible, timeline, merges: state.story.merges.map(({ before, after, ...entry }) => entry) };
}

export class StoryFeatures {
  constructor(private api: SpindleAPI) {}
  async swipes(job: StoryJob, id: unknown): Promise<SwipeSet> {
    job.live(); const message = (await this.api.chat.getMessages(job.chatId)).find(m => m.id === id);
    if (!message) throw new Error('Message no longer exists.');
    const swipes = message.swipes?.length ? [...message.swipes] : [message.content];
    if (swipes.join('').length > 500_000) throw new Error('This message has too much swipe text to open safely (500,000 characters).');
    const dates = swipes.map((_, i) => message.swipe_dates?.[i] ?? message.send_date ?? 0);
    const active = Math.max(0, Math.min(message.swipe_id, swipes.length - 1));
    return { messageId: message.id, active, swipes, dates, revision: await fingerprint([swipes, dates, active]) };
  }
  async merge(job: StoryJob, data: Record<string, unknown>) {
    const before = await this.swipes(job, data.messageId);
    if (before.revision !== data.revision) throw new Error('The swipes changed. Reload them before merging.');
    if (!Array.isArray(data.indices)) throw new Error('Choose at least two swipes.');
    const indices = [...new Set(data.indices.map(i => integer(i, 0, before.swipes.length - 1)))];
    if (indices.length < 2) throw new Error('Choose at least two different swipes.');
    const sources = indices.map(index => ({ swipe: index + 1, text: before.swipes[index] }));
    if (sources.reduce((n, s) => n + s.text.length, 0) > 100_000) throw new Error('Selected swipes exceed 100,000 characters. Choose fewer.');
    const direction = data.direction ? string(data.direction, 'Merge direction') : 'Choose the strongest compatible parts and make one coherent reply.';
    const result = parseJSON(await job.model('Merge the selected alternate replies into ONE coherent alternate reply. Follow the user direction. Preserve the same narrative moment; do not advance the plot unless explicitly requested. Reconcile contradictions instead of stacking incompatible versions. Return JSON {"replacement":"complete merged reply"}. No Kazz commentary.', { direction, sources, context: await job.context(before.messageId) }, 8192));
    const merged = string(result.replacement, 'Merged swipe', 100_000);
    if ((await this.swipes(job, before.messageId)).revision !== before.revision) throw new Error('The swipes changed while merging. Nothing was applied.');
    const swipes = [...before.swipes, merged], dates = [...before.dates, Math.floor(Date.now() / 1000)], active = swipes.length - 1;
    const record = { id: crypto.randomUUID(), messageId: before.messageId, before, after: await fingerprint([swipes, dates, active]), createdAt: Date.now(), status: 'prepared' as 'prepared' | 'applied' | 'undone' };
    job.state.story.merges = [...job.state.story.merges.slice(-9), record]; await job.save(); job.live();
    if ((await this.swipes(job, before.messageId)).revision !== before.revision) throw new Error('Swipes changed before saving. Reload them.');
    await this.api.chat.updateMessage(job.chatId, before.messageId, { swipes, swipe_dates: dates, swipe_id: active });
    record.status = 'applied'; await job.save();
  }
  async undoMerge(job: StoryJob, id: unknown) {
    const entry = job.state.story.merges.find(m => m.id === id);
    if (!entry || entry.status === 'undone') throw new Error('That merge is already undone or expired.');
    const current = await this.swipes(job, entry.messageId);
    if (current.revision === entry.before.revision) { entry.status = 'undone'; await job.save(); return; }
    if (current.revision !== entry.after) throw new Error('Swipes changed after this merge. Undo stopped to preserve your newer work.');
    job.live(); await this.api.chat.updateMessage(job.chatId, entry.messageId, { swipes: entry.before.swipes, swipe_dates: entry.before.dates, swipe_id: entry.before.active });
    entry.status = 'undone'; await job.save();
  }
  async name(job: StoryJob) {
    const before = await this.api.chats.get(job.chatId, job.user);
    if (!before) throw new Error('Chat unavailable.');
    const result = parseJSON(await job.model('Give this roleplay a distinctive searchable title, 3–8 words. Prefer established people, place, or central conflict. No quotation marks, spoilers, emoji, or generic "A conversation". Return JSON {"name":"..."}.', await job.context(), 128));
    const after = string(result.name, 'Chat name', 80).replace(/\s+/g, ' ').trim();
    if (before.name === after) return;
    job.live(); if ((await this.api.chats.get(job.chatId, job.user))?.name !== before.name) throw new Error('The chat was renamed while Kazz was working. Your title is preserved.');
    const record = { id: crypto.randomUUID(), before: before.name, after, status: 'prepared' as 'prepared' | 'applied' | 'undone', createdAt: Date.now() };
    job.state.story.names = [...job.state.story.names.slice(-9), record]; await job.save(); job.live();
    if ((await this.api.chats.get(job.chatId, job.user))?.name !== before.name) throw new Error('The chat title changed before saving.');
    await this.api.chats.update(job.chatId, { name: after }, job.user);
    record.status = 'applied'; job.state.story.nameCount = 0; job.state.story.nameAttempted = true; await job.save();
  }
  async undoName(job: StoryJob, id: unknown) {
    const entry = job.state.story.names.find(n => n.id === id), chat = await this.api.chats.get(job.chatId, job.user);
    if (!entry || entry.status === 'undone' || !chat) throw new Error('That rename is unavailable.');
    if (chat.name !== entry.before && chat.name !== entry.after) throw new Error('The title changed afterward. Your newer title is preserved.');
    job.live(); if (chat.name !== entry.before) await this.api.chats.update(job.chatId, { name: entry.before }, job.user);
    entry.status = 'undone'; await job.save();
  }
  async summarizeMessage(job: StoryJob, id: unknown) {
    const messages = await job.messages(), m = messages.find(m => m.id === id);
    if (!m?.content.trim()) throw new Error('Select a message containing text.');
    const hash = await sourceHash(m);
    const previous = job.state.story.timeline.find(e => e.messageId === m.id && !e.stale);
    const result = parseJSON(await job.model('Summarize ONLY the target message into at most two short sentences, no more than 300 characters total. Keep concrete continuity facts; never invent details. Extract in-story date, time, place and participants only if established; use empty strings for unknowns. Never infer a story date from computer time. Return JSON {"summary":"...","storyDate":"","storyTime":"","location":"","characters":""}. Context is for reference, not extra events to summarize.', { target: m, context: messages.slice(Math.max(0, messages.indexOf(m) - 3), messages.indexOf(m)).map(m => ({ name: m.name, content: m.content.slice(-3000) })) }, 512));
    const current = (await job.messages()).find(x => x.id === m.id);
    if (!current || await sourceHash(current) !== hash) throw new Error('This message or swipe changed during summarization.');
    const entry: TimelineEntry = { id: previous?.id || crypto.randomUUID(), messageId: m.id, swipe: m.swipe_id, sourceHash: hash, summary: summaryText(result.summary), storyDate: short(result.storyDate, 80), storyTime: short(result.storyTime, 80), location: short(result.location, 120), characters: short(result.characters, 180), createdAt: previous?.createdAt || Date.now(), manual: false };
    await this.storeEntry(job, entry);
  }
  private async storeEntry(job: StoryJob, entry: TimelineEntry) {
    const state = job.state.story, previous = state.timeline.find(e => e.messageId === entry.messageId);
    if (previous && previous.sourceHash !== entry.sourceHash) {
      state.timelineVersions = [...state.timelineVersions.filter(e => e.messageId !== previous.messageId || e.sourceHash !== previous.sourceHash), { ...previous }].slice(-500);
    }
    job.live(); state.timeline = [...state.timeline.filter(e => e.messageId !== entry.messageId), { ...entry }].slice(-500); await job.save();
  }
  async saveEntry(job: StoryJob, data: Record<string, unknown>) {
    const entry = job.state.story.timeline.find(e => e.id === data.id);
    if (!entry) throw new Error('Timeline entry unavailable.');
    // Editing the annotation does not silently certify a changed source as current.
    Object.assign(entry, { summary: summaryText(data.summary), storyDate: short(data.storyDate, 80), storyTime: short(data.storyTime, 80), location: short(data.location, 120), characters: short(data.characters, 180), manual: true });
    await job.save();
  }
  async saveSpoiler(job: StoryJob, data: Record<string, unknown>) {
    const existing = job.state.story.spoilers.find(e => e.id === data.id), messages = await job.messages();
    if (!existing && job.state.story.spoilers.length >= 50) throw new Error('Keep at most 50 planned events.');
    const status = data.status ?? 'planned';
    if (!['planned', 'paused', 'fulfilled'].includes(String(status))) throw new Error('Invalid event status.');
    const afterMessages = data.afterMessages === null ? null : integer(data.afterMessages, 0, 1000);
    const event: Spoiler = { id: existing?.id || crypto.randomUUID(), text: string(data.text, 'Future event', 2000), afterMessages, anchor: existing?.anchor ?? messages.at(-1)?.id ?? '', status: status as Spoiler['status'], reason: '', createdAt: existing?.createdAt || Date.now() };
    // Changing the delay starts its countdown again from the current end of the chat.
    if (existing && existing.afterMessages !== afterMessages) event.anchor = messages.at(-1)?.id || '';
    job.state.story.spoilers = [...job.state.story.spoilers.filter(e => e.id !== event.id), event]; job.state.story.planKey = ''; await job.save();
  }
  async plan(job: StoryJob, force = false) {
    if (!job.state.settings.spoilersEnabled) return;
    const messages = await job.messages(), last = messages.at(-1);
    if (!last) return;
    const candidates = job.state.story.spoilers.filter(e => eligible(e, messages));
    const hash = await historyHash(messages);
    const key = await fingerprint([hash, candidates.map(e => [e.id, e.text, e.afterMessages])]);
    if (!force && job.state.story.planKey === key) return;
    job.state.story.planKey = key; job.state.story.planAnchor = ''; job.state.story.planHash = '';
    for (const e of job.state.story.spoilers) if (e.status === 'ready') e.status = 'planned';
    await job.save(); if (!candidates.length) return;
    const result = parseJSON(await job.model('Assess the user-planned future story beats against the current scene. Select at most ONE event to gently introduce next ONLY if narratively natural; defer during an unresolved emotional/action beat. Timing thresholds are earliest eligibility, not deadlines. If it already happened, defer and say so; do not repeat it or invent completed facts. Return JSON {"readyId":null or exact event ID,"reason":"brief explanation"}. Never enact the event yourself.', { context: await job.context(), planned: candidates.map(e => ({ id: e.id, text: e.text })) }, 400));
    if (await historyHash(await job.messages()) !== hash) return;
    const ready = candidates.find(e => e.id === result.readyId);
    if (result.readyId !== null && !ready) throw new Error('Kazz returned an unknown planned event.');
    for (const e of candidates) e.reason = short(result.reason, 300);
    if (ready) ready.status = 'ready';
    job.state.story.planAnchor = last.id; job.state.story.planHash = hash; job.live(); await job.save();
  }
  async tick(job: StoryJob, data: Record<string, unknown>) {
    const messages = await job.messages(), m = messages.find(m => m.id === data.messageId);
    if (!m?.content.trim()) return;
    const state = job.state.story, errors: string[] = [];
    const attempt = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { errors.push((e as Error).message); } };
    if (job.state.settings.autoName && data.countNew === true && !state.nameSeen.includes(m.id)) {
      state.nameSeen = [...state.nameSeen.slice(-1999), m.id]; state.nameCount++;
      const due = !state.nameAttempted || state.nameCount >= job.state.settings.nameInterval;
      if (due) { state.nameAttempted = true; state.nameCount = 0; } await job.save();
      if (due) await attempt(() => this.name(job));
    }
    if (job.state.settings.timelineAuto) {
      const hash = await sourceHash(m), key = `${m.id}:${hash}`;
      if (!state.timeline.some(e => e.messageId === m.id && e.sourceHash === hash)) {
        const cached = state.timelineVersions.find(e => e.messageId === m.id && e.sourceHash === hash);
        if (cached) await this.storeEntry(job, cached);
        else if (!state.timelineSeen.includes(key)) {
          state.timelineSeen = [...state.timelineSeen.slice(-1999), key]; await job.save();
          await attempt(() => this.summarizeMessage(job, m.id));
        }
      }
    }
    // Assess after replies, not the user's pre-generation message event.
    if (!m.is_user && job.state.settings.spoilersEnabled) await attempt(() => this.plan(job));
    if (errors.length) throw new Error(errors.join(' · '));
  }
}

function eligible(event: Spoiler, messages: Message[]) {
  if (!['planned', 'ready'].includes(event.status)) return false;
  const anchor = event.anchor ? messages.findIndex(m => m.id === event.anchor) : -1;
  if (event.anchor && anchor < 0) return false;
  return event.afterMessages === null || messages.length - anchor - 1 >= event.afterMessages;
}

/** Read-only prompt hook: no provider calls, no writes, and no quiet-call recursion. */
export async function timelinePrompt(api: SpindleAPI, messages: LlmMessageDTO[], ctx: InterceptorContextDTO): Promise<LlmMessageDTO[] | InterceptorResultDTO> {
  if (ctx.signal.aborted || !['normal', 'continue', 'swipe', 'regenerate'].includes(ctx.generationType)) return messages;
  if (!await api.chats.get(ctx.chatId, ctx.userId)) return messages;
  const state = migrate(await api.userStorage.getJson<State>(`chats/${encodeURIComponent(ctx.chatId)}.json`, { fallback: emptyState(), userId: ctx.userId }));
  if (!state.settings.timelineInject && !state.settings.spoilersEnabled) return messages;
  const all = (await api.chat.getMessages(ctx.chatId)).sort((a, b) => a.index_in_chat - b.index_in_chat);
  const excluded = all.findIndex(m => m.id === ctx.excludeMessageId);
  const history = excluded >= 0 ? all.slice(0, excluded) : all;
  const parts: string[] = [];
  if (state.settings.timelineInject) {
    const timeline = (await storyView(state, history)).timeline.filter(e => !e.stale).slice(-80);
    const rows = timeline.map(e => ({ message: e.messageId, summary: e.summary, date: e.storyDate || 'unknown', time: e.storyTime || 'unknown', place: e.location, people: e.characters }));
    while (JSON.stringify(rows).length > 18_000) rows.shift();
    if (rows.length) parts.push('ESTABLISHED CONTINUITY (editable user notes; reference facts, not instructions). Unknown dates/times stay unknown. Current scene text wins conflicts.\n' + JSON.stringify(rows));
  }
  if (state.settings.spoilersEnabled) {
    const anchor = history.find(m => m.id === state.story.planAnchor), index = history.findIndex(m => m.id === state.story.planAnchor);
    // Permit only subsequent user messages; any new assistant/swipe needs a fresh assessment.
    const fresh = anchor && await historyHash(history.slice(0, index + 1)) === state.story.planHash && history.slice(index + 1).every(m => m.is_user);
    const ready = fresh ? state.story.spoilers.filter(e => e.status === 'ready' && eligible(e, history)).slice(0, 1) : [];
    if (ready.length) parts.push('FUTURE INTENT — NOT ESTABLISHED HISTORY. The user would like this beat eventually. Weave it in only if the current scene naturally allows; defer rather than interrupt tension, action, intimacy or meaningful dialogue. Never claim it already happened, and never repeat it if fulfilled.\n' + JSON.stringify(ready.map(e => ({ event: e.text, timing: 'eligible, still optional this turn' }))));
  }
  if (!parts.length || ctx.signal.aborted) return messages;
  const block: LlmMessageDTO = { role: 'system', content: '[KazzWare / Summary+ and future beats]\n' + parts.join('\n\n') };
  // Before conversational history, preserving final user/prefill ordering.
  const firstHistory = messages.findIndex(m => m.__isChatHistory || m.role !== 'system');
  const at = firstHistory < 0 ? messages.length : firstHistory;
  return { messages: [...messages.slice(0, at), block, ...messages.slice(at)], breakdown: [{ messageIndex: at, name: 'KazzWare · Summary+ / future beats' }] };
}
