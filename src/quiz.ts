import { shuffle } from './srs';
import type { Item } from './types';
export const SET_SIZE = 10;
export interface Choice { id: string; text: string }
export interface Question { item: Item; choices: Choice[] }
export type Verdict = 'correct' | 'wrong' | 'timeout' | 'unknown';
export interface Result { item: Item; verdict: Verdict }
export const optionText = (item: Item): string => item.answer;
export function makeQuestion(item: Item, pool: Item[], rng: () => number = Math.random, n = 4): Question {
  if (item.choices && item.correctIndex !== undefined) {
    return {
      item,
      choices: item.choices.map((text, i) => ({ id: i === item.correctIndex ? item.id : `${item.id}-choice-${i}`, text })),
    };
  }
  if (/^[○×]$/.test(item.answer)) {
    return { item, choices: ['○', '×'].map(text => ({ id: text === item.answer ? item.id : `${item.id}-other`, text })) };
  }
  const answer = item.answer.trim();
  const seen = new Set([answer]);
  const choices: Choice[] = [{ id: item.id, text: item.answer }];
  const others = shuffle(pool.filter(p => p.id !== item.id && !p.choices && !/^[○×]$/.test(p.answer)), rng);
  const candidates = [...others.filter(p => p.chapter === item.chapter), ...others.filter(p => p.chapter !== item.chapter)];
  for (const p of candidates) {
    if (choices.length >= n) break;
    const text = p.answer.trim();
    if (!text || seen.has(text) || Math.max(text.length, answer.length) / Math.min(text.length, answer.length) >= 3) continue;
    choices.push({ id: p.id, text });
    seen.add(text);
  }
  return { item, choices: shuffle(choices, rng) };
}
export function pickItems(items: Item[], limit: number | null, rng: () => number = Math.random): Item[] {
  const shuffled = shuffle(items, rng);
  return limit === null ? shuffled : shuffled.slice(0, limit);
}
export function grade(item: Item, picked: string | null): Verdict {
  return picked === null ? 'timeout' : picked === 'unknown' ? 'unknown' : picked === item.id ? 'correct' : 'wrong';
}
export const wrongItems = (results: Result[]): Item[] => results.filter(r => r.verdict !== 'correct').map(r => r.item);
export const accuracy = (results: Result[]): number => results.length ? Math.round(results.filter(r => r.verdict === 'correct').length / results.length * 100) : 0;
