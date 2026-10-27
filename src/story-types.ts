export type SwipeSet = { messageId: string; active: number; swipes: string[]; dates: number[]; revision: string };
export type MergeRecord = { id: string; messageId: string; before: SwipeSet; after: string; createdAt: number; status: 'prepared' | 'applied' | 'undone' };
export type TimelineEntry = { id: string; messageId: string; swipe: number; sourceHash: string; summary: string; storyDate: string; storyTime: string; location: string; characters: string; createdAt: number; manual: boolean; stale?: boolean };
export type Spoiler = { id: string; text: string; afterMessages: number | null; anchor: string; status: 'planned' | 'ready' | 'fulfilled' | 'paused'; reason: string; createdAt: number };
export type NameRecord = { id: string; before: string; after: string; status: 'prepared' | 'applied' | 'undone'; createdAt: number };
export type StoryState = { timeline: TimelineEntry[]; timelineVersions: TimelineEntry[]; spoilers: Spoiler[]; merges: MergeRecord[]; names: NameRecord[]; nameSeen: string[]; nameCount: number; nameAttempted: boolean; timelineSeen: string[]; planKey: string; planAnchor: string; planHash: string };
export type StoryView = Omit<StoryState, 'merges' | 'timelineVersions'> & { merges: Omit<MergeRecord, 'before' | 'after'>[] };
export const emptyStory = (): StoryState => ({ timeline: [], timelineVersions: [], spoilers: [], merges: [], names: [], nameSeen: [], nameCount: 0, nameAttempted: false, timelineSeen: [], planKey: '', planAnchor: '', planHash: '' });

export async function fingerprint(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
