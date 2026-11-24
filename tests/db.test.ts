import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { recordAnswer, getProgress, getToday, getStreak, getSettings, setSettings, setKnown, dueItems, weakItems, resetDbConnection } from '../src/db';
import { DAY_MS } from '../src/srs';

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory();
});

describe('db', () => {
  const now = new Date(2026, 5, 10, 12).getTime();
  it('正解で box+1、due 更新、今日の回答数+1', async () => {
    const p = await recordAnswer('a', true, now);
    expect(p).toMatchObject({ correct: 1, box: 1, due: now + DAY_MS });
    await recordAnswer('a', true, now);
    expect((await getProgress('a'))!.box).toBe(2);
    expect(await getToday(now)).toBe(2);
  });
  it('weakItems は苦手の語だけ（期限に関係なく）', async () => {
    await recordAnswer('a', false, now);
    await recordAnswer('b', true, now);
    expect((await weakItems()).map((p) => p.itemId)).toEqual(['a']);
  });
  it('不正解で box 0', async () => {
    await recordAnswer('a', true, now);
    await recordAnswer('a', false, now);
    expect(await getProgress('a')).toMatchObject({ wrong: 1, box: 0 });
  });
  it('streak: 連続日数。今日未回答なら昨日から', async () => {
    await recordAnswer('a', true, now - 2 * DAY_MS);
    await recordAnswer('a', true, now - DAY_MS);
    expect(await getStreak(now)).toBe(2);
    await recordAnswer('a', true, now);
    expect(await getStreak(now)).toBe(3);
  });
  it('streak: 途切れたら 0', async () => {
    await recordAnswer('a', true, now - 3 * DAY_MS);
    expect(await getStreak(now)).toBe(0);
  });
  it('設定の既定値と保存', async () => {
    expect(await getSettings()).toEqual({ dailyGoal: 30, hideCardAnswer: true });
    await setSettings({ dailyGoal: 50 });
    expect((await getSettings()).dailyGoal).toBe(50);
  });
  it('known と dueItems', async () => {
    await setKnown('k', true);
    expect((await getProgress('k'))!.known).toBe(true);
    await recordAnswer('a', false, now);
    expect((await dueItems(now)).map((p) => p.itemId)).toEqual(['a']);
    expect(await dueItems(now - 1)).toEqual([]);
  });
  it('旧4択設定が残っていてもカード設定を読み込める', async () => {
    await getSettings();
    const old = await openDB('joho-app', 2);
    await old.put('settings', 10, 'quizSeconds');
    await old.put('settings', true, 'hideQuizChoices');
    await old.put('settings', false, 'hideCardAnswer');
    old.close();
    expect(await getSettings()).toEqual({ dailyGoal: 30, hideCardAnswer: false });
  });
});
