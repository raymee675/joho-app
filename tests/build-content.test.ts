// @ts-expect-error JS module without types
import { buildDeck } from '../scripts/build-content.mjs';

const e = (no: number | null, word: string) => ({ no, word, kanji: null, reading: null, senses: [{ label: null, meanings: ['x'] }], notes: [] });
const raw = (kind: string, entries: unknown[], section = '動詞') => ({ image: 'a', page: 1, kind, section, entries });

describe('buildDeck', () => {
  it('kind でデッキを分け、other は除外', () => {
    const d = buildDeck([raw('kobun-word', [e(1, 'a')]), raw('kanbun-word', [e(1, 'b')]), raw('other', [e(1, 'c')])]);
    expect(d.items.map((i: { id: string }) => i.id)).toEqual(['kobun-1', 'kanbun-1']);
  });
  it('意味が空・語が空は除外', () => {
    const bad = { ...e(2, 'z'), senses: [{ label: null, meanings: [] }] };
    expect(buildDeck([raw('kobun-word', [bad, e(3, '')])]).items).toHaveLength(0);
  });
  it('no が重複したら先勝ち', () => {
    const d = buildDeck([raw('kobun-word', [e(1, 'a')]), raw('kobun-word', [e(1, 'b')])]);
    expect(d.items).toHaveLength(1);
    expect(d.items[0].word).toBe('a');
  });
  it('グループ定義が無ければ、品詞に関係なく並び順に20個ずつ章に分ける', () => {
    const d = buildDeck([
      raw('kobun-word', Array.from({ length: 30 }, (_, i) => e(i + 1, `v${i}`)), '動詞'),
      raw('kobun-word', Array.from({ length: 15 }, (_, i) => e(i + 31, `n${i}`)), '名詞'),
    ]);
    expect(d.chapters.map((c: { title: string }) => c.title)).toEqual(['古文単語 1', '古文単語 2', '古文単語 3']);
    expect(d.chapters.map((c: { itemIds: string[] }) => c.itemIds.length)).toEqual([20, 20, 5]);
  });
  it('端数が5語未満なら前の章に寄せる', () => {
    const d = buildDeck([raw('kobun-word', Array.from({ length: 44 }, (_, i) => e(i + 1, `w${i}`)))]);
    expect(d.chapters.map((c: { itemIds: string[] }) => c.itemIds.length)).toEqual([20, 24]);
  });
  it('entry の section を pos に優先する（章分けには使わない）', () => {
    const d = buildDeck([raw('kobun-word', [{ ...e(1, 'a'), section: '補助動詞' }, e(2, 'b')])]);
    expect(d.items.map((i: { pos: string }) => i.pos)).toEqual(['補助動詞', '動詞']);
    expect(d.chapters).toHaveLength(1);
  });
});

describe('意味の近い語のグループで章を作る', () => {
  const raws = [raw('kobun-word', [e(1, 'a'), e(2, 'b'), e(3, 'c'), e(null, 'd')]), raw('kanbun-word', [e(null, '愛')], '漢文')];
  it('グループごとに章を作り、同じ語を複数のグループに入れられる', () => {
    const d = buildDeck(raws, 'dev', {
      kobun: [{ section: '気持ち', title: '嘆く', items: [1, 2] }, { section: '気持ち', title: '喜ぶ', items: [2, 3, 'w-d'] }],
      kanbun: [{ title: '好む', items: ['kanbun-w-愛'] }],
    });
    expect(d.chapters.map((c: { id: string; title: string; section: string | null; itemIds: string[] }) => [c.id, c.section, c.title, c.itemIds])).toEqual([
      ['kobun-ch1', '気持ち', '嘆く', ['kobun-1', 'kobun-2']],
      ['kobun-ch2', '気持ち', '喜ぶ', ['kobun-2', 'kobun-3', 'kobun-w-d']],
      ['kanbun-ch1', null, '好む', ['kanbun-w-愛']],
    ]);
    expect(d.items.map((i: { id: string; chapterId: string }) => [i.id, i.chapterId])).toEqual([
      ['kobun-1', 'kobun-ch1'], ['kobun-2', 'kobun-ch1'], ['kobun-3', 'kobun-ch2'], ['kobun-w-d', 'kobun-ch2'], ['kanbun-w-愛', 'kanbun-ch1'],
    ]);
  });
  it('どのグループにも入っていない語があればエラー（出題漏れを防ぐ）', () => {
    expect(() => buildDeck(raws, 'dev', { kobun: [{ title: 'x', items: [1, 2, 3] }], kanbun: [{ title: 'y', items: ['w-愛'] }] }))
      .toThrow(/kobun-w-d/);
  });
  it('存在しない ID があればエラー', () => {
    expect(() => buildDeck(raws, 'dev', { kobun: [{ title: 'x', items: [1, 2, 3, 'w-d', 99] }], kanbun: [{ title: 'y', items: ['w-愛'] }] }))
      .toThrow(/kobun-99/);
  });
  it('50 語までのグループは 1 章のまま、超えたら番号つきで均等に分ける', () => {
    const build = (n: number) => buildDeck([raw('kobun-word', Array.from({ length: n }, (_, i) => e(i + 1, `w${i}`)))], 'dev',
      { kobun: [{ title: '動く', items: Array.from({ length: n }, (_, i) => i + 1) }] })
      .chapters.map((c: { title: string; itemIds: string[] }) => [c.title, c.itemIds.length]);
    expect(build(48)).toEqual([['動く', 48]]);
    expect(build(61)).toEqual([['動く 1', 31], ['動く 2', 30]]);
  });
  it('「（　）」だけの訳は除き、全部消えた項目は捨てる', () => {
    const blank = { ...e(2, 'z'), senses: [{ label: null, meanings: ['（　）'] }] };
    const part = { ...e(3, 'y'), senses: [{ label: null, meanings: ['（　）', 'ok'] }] };
    const d = buildDeck([raw('kobun-word', [blank, part])]);
    expect(d.items.map((i: { word: string }) => i.word)).toEqual(['y']);
    expect(d.items[0].senses[0].meanings).toEqual(['ok']);
  });
  it('ページ冒頭の no:null 断片は同じ語なら前ページ末尾の項目に結合', () => {
    const tail = { ...e(5, 'とし'), senses: [{ label: null, meanings: ['早い'] }], notes: [] };
    const frag = { no: null, word: 'とし', kanji: null, reading: null, senses: [{ label: '②', meanings: ['速い'] }], notes: ['前ページからの続き', '※連用形で多い'] };
    const d = buildDeck([raw('kobun-word', [tail]), { ...raw('kobun-word', [frag, e(6, 'b')]), page: 2 }]);
    expect(d.items.map((i: { id: string }) => i.id)).toEqual(['kobun-5', 'kobun-6']);
    expect(d.items[0].senses.map((s: { meanings: string[] }) => s.meanings)).toEqual([['早い'], ['速い']]);
    expect(d.items[0].notes).toEqual(['※連用形で多い']);
  });
  it('word が空の断片も結合し、意味が空だった前ページの語義は断片で置き換わる', () => {
    const tail = { ...e(5, 'いかにも'), senses: [{ label: '打消', meanings: [] }] };
    const frag = { no: null, word: '', kanji: null, reading: null, senses: [{ label: '打消', meanings: ['決して'] }], notes: [] };
    const d = buildDeck([raw('kobun-word', [tail]), raw('kobun-word', [frag])]);
    expect(d.items).toHaveLength(1);
    expect(d.items[0].senses).toEqual([{ label: '打消', meanings: ['決して'] }]);
  });
  it('結合できない no:null（参考語）は独立項目、同じ語でページ冒頭でなければ結合しない', () => {
    const ref = e(null, 'いたはし');
    const d = buildDeck([raw('kobun-word', [e(9, 'いたはる'), ref, e(10, 'いらふ')])]);
    expect(d.items.map((i: { id: string }) => i.id)).toEqual(['kobun-9', 'kobun-10', 'kobun-w-いたはし']);
  });
  it('漢文は区分の切替注記で区分を分け、同じ語でも別項目にする', () => {
    const k = (word: string, notes: string[] = []) => ({ ...e(null, word), notes });
    const d = buildDeck([
      raw('kanbun-word', [k('愛', ['ここまで《主に動詞となるもの》。以下《形容詞・副詞・助動詞など》。']), k('相'), k('相')], '漢文 重要語彙《主に動詞となるもの》'),
    ]);
    expect(d.items.map((i: { id: string }) => i.id)).toEqual(['kanbun-w-愛', 'kanbun-w-相', 'kanbun-w-相-2']);
    expect(d.items.map((i: { pos: string }) => i.pos)).toEqual(['動詞', '形容詞・副詞・助動詞など', '形容詞・副詞・助動詞など']);
  });
  it('no が null は word で id、pos は section', () => {
    const d = buildDeck([raw('kobun-word', [e(null, 'こと')], '名詞')]);
    expect(d.items[0]).toMatchObject({ id: 'kobun-w-こと', pos: '名詞', no: null });
  });
});

describe('漢文の読み分け', () => {
  const kb = (no: number, word: string, senses: { label: string | null; meanings: string[] }[]) => ({ no, word, kanji: null, reading: null, senses, notes: [] });
  const build = (entries: unknown[]) => buildDeck([raw('kanbun-word', entries, '漢文')]).items as { id: string; word: string; reading: string | null; senses: { label: string | null; meanings: string[] }[] }[];
  it('読みごとに別の項目にする', () => {
    const items = build([kb(1, '愛', [{ label: '〔をシム〕', meanings: ['惜しむ'] }, { label: '〔めヅ〕', meanings: ['かわいがる'] }])]);
    expect(items.map((i) => [i.id, i.reading, i.senses.length])).toEqual([['kanbun-愛-1', 'をシム', 1], ['kanbun-愛-2', 'めヅ', 1]]);
  });
  it('複数の〔〕は「・」でつなぐ', () => {
    const items = build([kb(1, '予・余・某', [{ label: '〔よ〕・〔よ〕・〔それがし〕', meanings: ['私'] }])]);
    expect(items).toHaveLength(1);
    expect(items[0].reading).toBe('よ・それがし');
  });
  it('label が null の sense は直前の読みに含める', () => {
    const items = build([kb(1, '不肖', [{ label: '〔ふしよう〕', meanings: ['私'] }, { label: null, meanings: ['愚か者'] }])]);
    expect(items).toHaveLength(1);
    expect(items[0].senses.map((s) => s.meanings[0])).toEqual(['私', '愚か者']);
  });
  it('読みが無い項目は分けない', () => {
    const items = build([kb(1, '然', [{ label: null, meanings: ['そう'] }])]);
    expect(items.map((i) => [i.id, i.reading])).toEqual([['kanbun-1', null]]);
  });
  it('〔〃〕は直前の読みに置き換え、項目は分けたまま', () => {
    const items = build([kb(1, '辞', [{ label: '〔じス〕', meanings: ['ことわる'] }, { label: '〔〃〕', meanings: ['やめる'] }])]);
    expect(items.map((i) => [i.reading, i.senses[0].label])).toEqual([['じス', '〔じス〕'], ['じス', '〔じス〕']]);
    expect(items).toHaveLength(2);
  });
});
