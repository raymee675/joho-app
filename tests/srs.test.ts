import { nextBox, nextDue, DAY_MS, dateKey, BOX_DAYS } from '../src/srs';

describe('srs', () => {
  it('正解で 1 段階上がり、覚えた(3)で頭打ち', () => {
    expect(nextBox(0, true)).toBe(1);
    expect(nextBox(2, true)).toBe(3);
    expect(nextBox(3, true)).toBe(3);
    expect(nextBox(5, true)).toBe(3); // 旧データ
  });
  it('不正解で苦手(0)に戻る', () => expect(nextBox(3, false)).toBe(0));
  it('間隔は箱ごとの日数', () => expect(nextDue(3, 0)).toBe(BOX_DAYS[3] * DAY_MS));
  it('dateKey は YYYY-MM-DD', () => expect(dateKey(new Date(2026, 0, 5).getTime())).toBe('2026-01-05'));
});
