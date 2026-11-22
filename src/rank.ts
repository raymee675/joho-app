import { deck } from './deck';
import type { ChapterRecord } from './db';
import type { Chapter, DeckName } from './types';

/** ランクアップテストの問題数と合格ライン（mikan の「Rank アップテスト」に当たる） */
export const RANK_TEST_SIZE = 10;
export const PASS_RATE = 0.8;

/** ランク = 章を並び順に進めたもの。1 から数える */
export const ranksOf = (d: DeckName): Chapter[] => deck.chapters.filter((c) => c.deck === d);

export const rankNo = (chapterId: string): number => {
  const ch = deck.chapters.find((c) => c.id === chapterId);
  return ch ? ranksOf(ch.deck).indexOf(ch) + 1 : 0;
};

/** いま取り組むランク = まだクリアしていない最初の章。すべてクリアなら null */
export function currentRank(d: DeckName, records: Map<string, ChapterRecord>): Chapter | null {
  return ranksOf(d).find((c) => !records.has(c.id)) ?? null;
}

export const nextRank = (chapterId: string): Chapter | null => {
  const ch = deck.chapters.find((c) => c.id === chapterId);
  if (!ch) return null;
  const list = ranksOf(ch.deck);
  return list[list.indexOf(ch) + 1] ?? null;
};

export const passMark = (total: number): number => Math.ceil(total * PASS_RATE);
export const isPassed = (correct: number, total: number): boolean => total > 0 && correct >= passMark(total);

/** 出題元 ID（'lv-<段階>-<章>' / 'weak-<章>' / 章ID）から章 ID を取り出す。章でなければ null */
export function chapterOf(source: string): string | null {
  const id = source.replace(/^lv-[a-z]+-/, '').replace(/^weak-/, '');
  return deck.chapters.some((c) => c.id === id) ? id : null;
}
