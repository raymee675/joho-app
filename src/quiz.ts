import { shuffle } from './srs';
import type { Chapter, Item } from './types';

export const SET_SIZE = 10;

export interface Choice { id: string; text: string }
export interface Question { item: Item; choices: Choice[] }
export type Verdict = 'correct' | 'wrong' | 'timeout' | 'unknown';
export interface Result { item: Item; verdict: Verdict }

export type QuizMode = 'meaning' | 'reading';

/** 読み。無い語は「読みを選ぶ」の対象外 */
export const readingOf = (it: Item): string | null => it.reading;

/** 「読みを選ぶ」の見出しに添えるヒント（読みが分かる label は含めない） */
export const hintText = (it: Item): string => it.senses.flatMap((s) => s.meanings).slice(0, 3).join('、');

/** 選択肢に出す訳。senses[0].meanings を「・」でつなぎ、先頭 3 つまで */
export const choiceText = (it: Item): string => (it.senses[0]?.meanings ?? []).slice(0, 3).join('・');

/** モードに応じた選択肢の文字列（読みが無ければ空） */
export const optionText = (it: Item, mode: QuizMode = 'meaning'): string => (mode === 'reading' ? readingOf(it) ?? '' : choiceText(it));

const normalizedMeaning = (meaning: string): string => meaning
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[（(［\[].*?[）)］\]]/g, '')
  .replace(/[\s　・、，,。．.「」『』…〜～]/g, '');

const meaningsOf = (item: Item): string[] => item.senses.flatMap((sense) => sense.meanings)
  .map(normalizedMeaning)
  .filter(Boolean);

/** 表記違いを含め、同じ訳や明らかに訳の一部を共有する語を避ける */
const meaningsOverlap = (a: Item, b: Item): boolean => {
  const left = meaningsOf(a);
  const right = meaningsOf(b);
  return left.some((x) => right.some((y) => {
    if (x === y) return true;
    const shorter = x.length < y.length ? x : y;
    const longer = x.length < y.length ? y : x;
    // 1〜2文字の部分一致は偶然の一致が多いため、完全一致の場合だけ除外する。
    return shorter.length >= 3 && longer.includes(shorter);
  }));
};

/** 正解 + 意味が重ならない別語の訳を優先品詞順に並べた問題を作る */
export function makeQuestion(
  item: Item,
  pool: Item[],
  rng: () => number = Math.random,
  n = 4,
  mode: QuizMode = 'meaning',
  chapters: Chapter[] = [],
): Question {
  const correct = optionText(item, mode);
  const seen = new Set([correct]);
  const picked: Choice[] = [];
  const others = shuffle(pool.filter((p) => p.id !== item.id), rng);
  const checkMeanings = mode === 'meaning' && item.deck === 'kobun';
  const itemGroups = checkMeanings
    ? chapters.filter((chapter) => chapter.itemIds.includes(item.id))
    : [];
  const relatedIds = new Set(itemGroups.flatMap((chapter) => chapter.itemIds));
  // 読み問題では、同じ語の別の読みを紛らわしい誤答として優先する
  const sameWord = mode === 'reading' ? others.filter((p) => p.word === item.word) : [];
  const samePos = others.filter((p) => !sameWord.includes(p) && item.pos !== null && p.pos === item.pos);
  const diffPos = others.filter((p) => !(item.pos !== null && p.pos === item.pos));
  const pickedItems: Item[] = [];
  for (const p of [...sameWord, ...samePos, ...diffPos]) {
    if (picked.length >= n - 1) break;
    const text = optionText(p, mode);
    if (!text || seen.has(text)) continue;
    if (checkMeanings && (
      p.word === item.word
      || relatedIds.has(p.id)
      || meaningsOverlap(item, p)
      || pickedItems.some((prior) => meaningsOverlap(prior, p))
    )) continue;
    seen.add(text);
    picked.push({ id: p.id, text });
    pickedItems.push(p);
  }
  return { item, choices: shuffle([{ id: item.id, text: correct }, ...picked], rng) };
}

/** 全語をシャッフルして出題順にし、limit があればその数で切る */
export function pickItems(items: Item[], limit: number | null, rng: () => number = Math.random): Item[] {
  const s = shuffle(items, rng);
  return limit === null ? s : s.slice(0, limit);
}

/** 選んだ選択肢 id（null = 時間切れ / 'unknown' = わからない）を採点する */
export function grade(item: Item, picked: string | null): Verdict {
  if (picked === null) return 'timeout';
  if (picked === 'unknown') return 'unknown';
  return picked === item.id ? 'correct' : 'wrong';
}

export const wrongItems = (results: Result[]): Item[] => results.filter((r) => r.verdict !== 'correct').map((r) => r.item);

export const accuracy = (results: Result[]): number =>
  results.length ? Math.round((results.filter((r) => r.verdict === 'correct').length / results.length) * 100) : 0;
