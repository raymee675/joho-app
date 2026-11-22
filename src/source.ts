import { itemById, itemsFor } from './deck';
import { dueItems, getAllProgress } from './db';
import { STATUS_LABEL, isStatus, wordStatus, type WordStatus } from './status';
import type { Item } from './types';

/** 段階で絞った出題元の ID。`lv-<段階>-<章ID または all-<deck> または all>` */
export const levelSource = (status: WordStatus, scope: string) => `lv-${status}-${scope}`;

/**
 * 'due'（期限切れ全部）/ 'review'（全体の苦手）/ 'weak-<章ID>'（その章の苦手）/
 * 'lv-<段階>-<範囲>'（その範囲で、その段階の語）/ 'all-<deck>' / 章ID から出題項目を読み込む
 */
export async function loadSource(chapterId: string, now = Date.now()): Promise<{ title: string; items: Item[] }> {
  if (chapterId === 'review') return byStatus('weak', 'all');
  if (chapterId.startsWith('weak-')) return byStatus('weak', chapterId.slice(5));
  const m = /^lv-([a-z]+)-(.+)$/.exec(chapterId);
  if (m && isStatus(m[1])) return byStatus(m[1], m[2]);
  const due = chapterId === 'due' ? (await dueItems(now)).map((p) => p.itemId) : [];
  return itemsFor(chapterId, due);
}

async function byStatus(status: WordStatus, scope: string): Promise<{ title: string; items: Item[] }> {
  const prog = new Map((await getAllProgress()).map((p) => [p.itemId, p]));
  const base = scope === 'all' ? { title: '全体', items: [...itemById.values()] } : itemsFor(scope);
  return { title: `${base.title} の${STATUS_LABEL[status]}`, items: base.items.filter((i) => wordStatus(prog.get(i.id)) === status) };
}
