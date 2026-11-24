import { RANK_TEST_SIZE } from './rank';
import { shuffle } from './srs';
import type { Item } from './types';

export function selectCards(items: Item[], params: URLSearchParams, rankup = false, rng = Math.random): Item[] {
  const ordered = rankup || params.get('shuffle') === '1' ? shuffle(items, rng) : [...items];
  if (rankup) return ordered.slice(0, RANK_TEST_SIZE);
  const n = Number(params.get('n'));
  return Number.isSafeInteger(n) && n > 0 ? ordered.slice(0, n) : ordered;
}
