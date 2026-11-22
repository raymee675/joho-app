import { accuracy, grade, makeQuestion, pickItems, wrongItems } from '../src/quiz';
import { countStatuses, wordStatus } from '../src/status';
import type { Item } from '../src/types';
const mk = (id: string, answer = id, chapter = 1, extra: Partial<Item> = {}): Item => ({ id, deck: 'joho', chapterId: `joho-ch${chapter}`, chapter, no: 1, question: `${id}の問題`, answer, explanation: null, ...extra });
const seeded = (seed = 1) => () => ((seed = seed * 16807 % 2147483647) / 2147483647);
describe('問題文から解答を選ぶ', () => {
  it('同じ章を優先し、重複・3倍以上の長さ・選択式の解答を除く', () => {
    const pool = [mk('a', 'CPU'), mk('b', 'CPU'), mk('c', 'RAM'), mk('d', 'SSD'), mk('e', 'HDD'), mk('f', 'GPU', 2), mk('g', '長すぎる解答の文字列'), mk('h', '○'), mk('i', '① 手法', 1, { choices: ['手法', '方法'], correctIndex: 0 })];
    for (let s = 1; s < 20; s++) expect(makeQuestion(pool[0], pool, seeded(s)).choices.map(c => c.id).sort()).toEqual(['a', 'c', 'd', 'e']);
  });
  it('章の候補が不足すれば全体から補い、安全な候補だけ出す', () => {
    const pool = [mk('a', 'CPU'), mk('b', 'RAM'), mk('c', 'SSD', 2), mk('d', 'HDD', 2)];
    expect(makeQuestion(pool[0], pool).choices).toHaveLength(4);
    expect(makeQuestion(pool[0], [pool[0]]).choices).toHaveLength(1);
  });
  it('元の選択肢を保ち、正しい選択肢のIDだけで採点', () => {
    const item = mk('a', '① SSD', 1, { choices: ['RAM', 'SSD', 'CPU'], correctIndex: 1 });
    const q = makeQuestion(item, []);
    expect(q.choices.map(c => c.text)).toEqual(item.choices);
    expect(q.choices.map(c => grade(item, c.id))).toEqual(['wrong', 'correct', 'wrong']);
    const binary = mk('b', '×');
    expect(makeQuestion(binary, []).choices.map(c => [c.text, grade(binary, c.id)])).toEqual([['○', 'wrong'], ['×', 'correct']]);
  });
  it('出題数、採点、誤答だけの再出題、正答率', () => {
    const items = ['a', 'b', 'c'].map(id => mk(id));
    expect(pickItems(items, 2, seeded())).toHaveLength(2);
    expect(pickItems(items, null)).toHaveLength(3);
    expect(grade(items[0], null)).toBe('timeout');
    expect(grade(items[0], 'unknown')).toBe('unknown');
    const results = [{ item: items[0], verdict: 'correct' as const }, { item: items[1], verdict: 'wrong' as const }];
    expect(accuracy(results)).toBe(50);
    expect(accuracy([])).toBe(0);
    expect(wrongItems(results)).toEqual([items[1]]);
  });
  it('5段階の定着度を集計', () => {
    expect(wordStatus(undefined)).toBe('new');
    expect(wordStatus({ lastSeen: 1, box: 0 })).toBe('weak');
    expect(wordStatus({ lastSeen: 1, box: 1 })).toBe('vague');
    expect(wordStatus({ lastSeen: 1, box: 2 })).toBe('almost');
    expect(wordStatus({ lastSeen: 1, box: 3 })).toBe('mastered');
    expect(countStatuses(['a','b'], new Map([['a', { lastSeen: 1, box: 0 }]]))).toEqual({ new: 1, weak: 1, vague: 0, almost: 0, mastered: 0 });
  });
});
