import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { deck } from '../src/deck';
import { clearChapter, getChapterRecords, getDays, getProgress, recordAnswer, resetDbConnection, setLevel, weakItems } from '../src/db';
import { chapterOf, currentRank, isPassed, nextRank, passMark, rankNo, ranksOf } from '../src/rank';
import { DAY_MS } from '../src/srs';
import { lastDays } from '../src/pages/Stats';

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory();
});

const now = new Date(2026, 5, 10, 12).getTime();

describe('ランク', () => {
  const list = ranksOf('joho');
  it('合格ラインは 8 割（10 問なら 8 問）', () => {
    expect(passMark(10)).toBe(8);
    expect(isPassed(8, 10)).toBe(true);
    expect(isPassed(7, 10)).toBe(false);
    expect(isPassed(0, 0)).toBe(false);
  });
  it('いまのランク = まだクリアしていない最初の章', async () => {
    expect(currentRank('joho', new Map())).toBe(list[0]);
    await clearChapter(list[0].id, 9, now);
    expect(currentRank('joho', await getChapterRecords())).toBe(list[1]);
  });
  it('番号・次のランク・出題元から章を取り出す', () => {
    expect(rankNo(list[1].id)).toBe(2);
    expect(nextRank(list[0].id)).toBe(list[1]);
    expect(nextRank(list[list.length - 1].id)).toBeNull();
    expect(chapterOf(`lv-new-${list[0].id}`)).toBe(list[0].id);
    expect(chapterOf(`weak-${list[0].id}`)).toBe(list[0].id);
    expect(chapterOf('all-joho')).toBeNull();
  });
  it('クリア記録は最高点を残し、クリア日は変えない', async () => {
    await clearChapter('c', 8, now);
    await clearChapter('c', 10, now + DAY_MS);
    await clearChapter('c', 9, now + 2 * DAY_MS);
    expect((await getChapterRecords()).get('c')).toEqual({ chapterId: 'c', clearedAt: now, best: 10 });
  });
});

describe('自分で苦手に入れる', () => {
  it('setLevel は段階だけ変え、回答数には数えない', async () => {
    await recordAnswer('a', true, now);
    await setLevel('a', 0, now);
    expect((await getProgress('a'))!.box).toBe(0);
    expect((await weakItems()).map((p) => p.itemId)).toEqual(['a']);
    const [day] = await getDays();
    expect(day.answered).toBe(1);
    expect(day.levels).toEqual([1, 0, 0, 0]);
  });
  it('未学習の語も苦手に入れられる', async () => {
    await setLevel('b', 0, now);
    expect((await getProgress('b'))!.lastSeen).toBe(now);
  });
});

describe('学習記録', () => {
  it('日ごとに回答数・正解数・段階ごとの語数を残す', async () => {
    await recordAnswer('a', true, now);
    await recordAnswer('b', false, now);
    await recordAnswer('a', true, now);
    expect(await getDays()).toEqual([{ date: '2026-06-10', answered: 3, correct: 2, levels: [1, 0, 1, 0] }]);
  });
  it('lastDays: 記録の無い日は前の日の段階を引き継ぐ', async () => {
    await recordAnswer('a', true, now - 2 * DAY_MS);
    await recordAnswer('b', true, now);
    const rows = lastDays(await getDays(), now, 4);
    expect(rows.map((r) => r.answered)).toEqual([0, 1, 0, 1]);
    expect(rows.map((r) => r.levels[1])).toEqual([0, 1, 1, 2]);
    expect(rows[3].label).toBe('6/10');
  });
  it('v1 の DB から上げても、進み具合が残る', async () => {
    await resetDbConnection();
    const old = await openDB('joho-app', 1, {
      upgrade(d) {
        d.createObjectStore('progress', { keyPath: 'itemId' });
        d.createObjectStore('days', { keyPath: 'date' });
        d.createObjectStore('settings');
      },
    });
    await old.put('progress', { itemId: 'x', correct: 3, wrong: 0, lastSeen: now, box: 5, due: now, known: true });
    old.close();
    expect((await getProgress('x'))!.box).toBe(5);
    await clearChapter(deck.chapters[0].id, 8, now);
    expect((await getChapterRecords()).size).toBe(1);
  });
});

describe('段階ごとの出題元', () => {
  it('lv-<段階>-<範囲> はその段階の語だけ（章・デッキ全体・すべて）', async () => {
    const { loadSource } = await import('../src/source');
    const ch = ranksOf('joho')[0];
    const [a, b] = ch.itemIds;
    await setLevel(a, 3, now);
    await setLevel(b, 2, now);
    const otherId = deck.chapters[1].itemIds[0];
    await setLevel(otherId, 3, now);
    expect((await loadSource(`lv-mastered-${ch.id}`, now)).items.map((i) => i.id)).toEqual([a]);
    expect((await loadSource(`lv-almost-${ch.id}`, now)).items.map((i) => i.id)).toEqual([b]);
    expect((await loadSource('lv-mastered-all-joho', now)).items.map((i) => i.id)).toEqual([a, otherId]);
    expect((await loadSource('lv-mastered-all', now)).items.map((i) => i.id).sort()).toEqual([a, otherId].sort());
    expect((await loadSource('lv-mastered-all', now)).title).toBe('全体 の覚えた');
  });
});
