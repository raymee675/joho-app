import { accuracy, choiceText, grade, makeQuestion, pickItems, wrongItems } from '../src/quiz';
import type { Item } from '../src/types';

const mk = (id: string, meanings: string[], pos: string | null = null): Item => ({
  id, deck: 'kobun', chapterId: 'c', no: null, word: id, kanji: null, reading: null, pos,
  senses: [{ label: null, meanings }], notes: [],
});
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('quiz', () => {
  it('訳は「・」でつなぎ先頭3つまで', () => {
    expect(choiceText(mk('a', ['1', '2', '3', '4']))).toBe('1・2・3');
  });
  it('選択肢は正解 + 別語3つで、訳は重複しない', () => {
    const pool = [mk('a', ['x']), mk('b', ['x']), mk('c', ['y']), mk('d', ['z']), mk('e', ['w']), mk('f', ['y'])];
    const q = makeQuestion(pool[0], pool, seeded());
    expect(q.choices).toHaveLength(4);
    expect(q.choices.filter((c) => c.id === 'a')).toHaveLength(1);
    expect(new Set(q.choices.map((c) => c.text)).size).toBe(4);
  });
  it('同じ pos を優先する', () => {
    const pool = [mk('a', ['a'], 'N'), mk('b', ['b'], 'N'), mk('c', ['c'], 'N'), mk('d', ['d'], 'N'), mk('e', ['e'], 'V'), mk('f', ['f'], 'V')];
    for (let s = 1; s < 20; s++) {
      const q = makeQuestion(pool[0], pool, seeded(s));
      expect(q.choices.map((c) => c.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    }
  });
  it('候補が足りなければ選択肢は減る', () => {
    const pool = [mk('a', ['x']), mk('b', ['y'])];
    expect(makeQuestion(pool[0], pool, seeded()).choices).toHaveLength(2);
  });
  it('pickItems は全語を含み、limit で切る', () => {
    const items = Array.from({ length: 25 }, (_, i) => mk(String(i), [String(i)]));
    expect(pickItems(items, null, seeded()).map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
    expect(pickItems(items, 10, seeded())).toHaveLength(10);
  });
  it('採点', () => {
    const a = mk('a', ['x']);
    expect(grade(a, 'a')).toBe('correct');
    expect(grade(a, 'b')).toBe('wrong');
    expect(grade(a, null)).toBe('timeout');
    expect(grade(a, 'unknown')).toBe('unknown');
  });
  it('間違いと正答率', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((i) => mk(i, [i]));
    const r = [{ item: a, verdict: 'correct' as const }, { item: b, verdict: 'timeout' as const }, { item: c, verdict: 'unknown' as const }];
    expect(wrongItems(r)).toEqual([b, c]);
    expect(accuracy(r)).toBe(33);
    expect(accuracy([])).toBe(0);
  });
});

import { optionText, readingOf } from '../src/quiz';
import { isWeak } from '../src/srs';
import { countStatuses, wordStatus } from '../src/status';

const kb = (id: string, reading: string | null, extra: Partial<Item> = {}): Item => ({ ...mk(id, [id]), deck: 'kanbun', reading, ...extra });

describe('漢文の読み問題', () => {
  it('readingOf は reading をそのまま返す', () => {
    expect(readingOf(kb('a', 'をシム'))).toBe('をシム');
    expect(readingOf(kb('a', null, { kanji: 'おいて' }))).toBeNull();
  });
  it('読み問題では同じ漢字の別の読みを誤答に優先する', () => {
    const pool = [kb('a', 'をシム', { word: '愛' }), kb('b', 'めヅ', { word: '愛' }), kb('c', 'おいて'), kb('d', 'いはく'), kb('e', 'もって')];
    for (let s = 1; s < 20; s++) {
      const q = makeQuestion(pool[0], pool, seeded(s), 4, 'reading');
      expect(q.choices.some((c) => c.id === 'b')).toBe(true);
    }
  });
  it('読みの選択肢は他の語の reading で、重複せず、読みの無い語は入らない', () => {
    const pool = [kb('a', 'もって'), kb('b', 'もって'), kb('c', 'おいて'), kb('d', 'しかうして'), kb('e', null), kb('f', 'いはく'), kb('g', 'おいて')];
    for (let s = 1; s < 30; s++) {
      const q = makeQuestion(pool[0], pool, seeded(s), 4, 'reading');
      const texts = q.choices.map((c) => c.text);
      expect(texts).toHaveLength(4);
      expect(new Set(texts).size).toBe(4);
      expect(q.choices.find((c) => c.id === 'a')!.text).toBe('もって');
      expect(q.choices.some((c) => c.id === 'e' || c.id === 'b')).toBe(false);
    }
  });
  it('意味問題でも同じ文字列の選択肢は出ない', () => {
    const pool = Array.from({ length: 8 }, (_, i) => mk(`w${i}`, [i % 2 ? 'odd' : 'even']));
    const q = makeQuestion(pool[0], pool, seeded(), 4, 'meaning');
    expect(new Set(q.choices.map((c) => c.text)).size).toBe(q.choices.length);
    expect(q.choices).toHaveLength(2);
  });
  it('optionText はモードで切り替わる', () => {
    const it = kb('a', 'よみ');
    expect(optionText(it, 'reading')).toBe('よみ');
    expect(optionText(it)).toBe('a');
    expect(optionText(kb('b', null), 'reading')).toBe('');
  });
});

describe('定着度（未学習 + 4 段階）', () => {
  it('苦手 = 解いたことがあり段階 0', () => {
    expect(isWeak({ lastSeen: 1, box: 0 })).toBe(true);
    expect(isWeak({ lastSeen: 1, box: 1 })).toBe(false);
    expect(isWeak({ lastSeen: 0, box: 0 })).toBe(false);
  });
  it('段階の名前', () => {
    expect(wordStatus(undefined)).toBe('new');
    expect(wordStatus({ lastSeen: 0, box: 0 })).toBe('new');
    expect(wordStatus({ lastSeen: 1, box: 0 })).toBe('weak');
    expect(wordStatus({ lastSeen: 1, box: 1 })).toBe('vague');
    expect(wordStatus({ lastSeen: 1, box: 2 })).toBe('almost');
    expect(wordStatus({ lastSeen: 1, box: 3 })).toBe('mastered');
    expect(wordStatus({ lastSeen: 1, box: 5 })).toBe('mastered'); // 旧データ
  });
  it('章ごとの集計', () => {
    const prog = new Map([['a', { lastSeen: 1, box: 0 }], ['b', { lastSeen: 1, box: 3 }], ['c', { lastSeen: 1, box: 3 }]]);
    expect(countStatuses(['a', 'b', 'c', 'd'], prog)).toEqual({ new: 1, weak: 1, vague: 0, almost: 0, mastered: 2 });
  });
});
