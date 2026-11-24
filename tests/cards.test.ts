import { selectCards } from '../src/cards';
import { deck } from '../src/deck';
import { shuffle } from '../src/srs';

describe('カードの出題順と枚数', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ ...deck.items[0], id: String(i) }));
  it('通常は元の順番、n は先頭からの枚数', () => {
    expect(selectCards(items, new URLSearchParams())).toEqual(items);
    expect(selectCards(items, new URLSearchParams('n=3'))).toEqual(items.slice(0, 3));
    for (const n of ['all', '-1', '0', '1.5', 'bad']) expect(selectCards(items, new URLSearchParams(`n=${n}`))).toEqual(items);
  });
  it('シャッフル後に制限し、元の配列は変更しない', () => {
    expect(selectCards(items, new URLSearchParams('shuffle=1&n=20'), false, () => 0)).toEqual(shuffle(items, () => 0).slice(0, 20));
    expect(items[0].id).toBe('0');
  });
  it('ランクアップは n によらず最大10枚を抽選', () => {
    expect(selectCards(items, new URLSearchParams('n=1'), true, () => 0)).toEqual(shuffle(items, () => 0).slice(0, 10));
    expect(selectCards(items.slice(0, 6), new URLSearchParams(), true)).toHaveLength(6);
  });
});
