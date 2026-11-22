import type { Progress } from './db';
import { levelOf } from './srs';

/** 未学習 + mikan 式の 4 段階 */
export type WordStatus = 'new' | 'weak' | 'vague' | 'almost' | 'mastered';

/** 円グラフ・凡例の並び順 */
export const STATUSES: WordStatus[] = ['mastered', 'almost', 'vague', 'weak', 'new'];
/** 段階ごとに出題できる段階（未学習以外） */
export const REVIEW_STATUSES: WordStatus[] = ['weak', 'vague', 'almost', 'mastered'];

export const STATUS_LABEL: Record<WordStatus, string> = { new: '未学習', weak: '苦手', vague: 'うろ覚え', almost: 'ほぼ覚え', mastered: '覚えた' };

const BY_LEVEL: WordStatus[] = ['weak', 'vague', 'almost', 'mastered'];

export function wordStatus(p: Pick<Progress, 'lastSeen' | 'box'> | undefined): WordStatus {
  if (!p || p.lastSeen === 0) return 'new';
  return BY_LEVEL[levelOf(p.box)];
}

export type StatusCounts = Record<WordStatus, number>;

export function countStatuses(ids: string[], prog: Map<string, Pick<Progress, 'lastSeen' | 'box'>>): StatusCounts {
  const c: StatusCounts = { new: 0, weak: 0, vague: 0, almost: 0, mastered: 0 };
  for (const id of ids) c[wordStatus(prog.get(id))]++;
  return c;
}

export const isStatus = (s: string): s is WordStatus => s in STATUS_LABEL;
