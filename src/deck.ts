import raw from '@deck';
import type { Chapter, Deck, Item } from './types';

export const deck = raw as Deck;
export const itemById = new Map<string, Item>(deck.items.map((i) => [i.id, i]));

export const meaningText = (it: Item) => it.senses.map((s) => (s.label ? `${s.label} ` : '') + s.meanings.join('、')).join(' / ');
export const shortMeaning = (it: Item) => it.senses[0].meanings.slice(0, 3).join('、');

/** 章ID、または 'due' / 'all-<deck>' の疑似章から出題項目を決める */
export function itemsFor(chapterId: string, dueIds: string[] = []): { title: string; items: Item[] } {
  if (chapterId === 'due') return { title: '今日の復習', items: dueIds.map((id) => itemById.get(id)).filter((x): x is Item => !!x) };
  if (chapterId.startsWith('all-')) {
    const d = chapterId.slice(4);
    return { title: d === 'kobun' ? '古文単語 すべて' : '漢文 すべて', items: deck.items.filter((i) => i.deck === d) };
  }
  const ch: Chapter | undefined = deck.chapters.find((c) => c.id === chapterId);
  return { title: ch?.title ?? '', items: (ch?.itemIds ?? []).map((id) => itemById.get(id)!).filter(Boolean) };
}
