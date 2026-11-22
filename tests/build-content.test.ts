import { buildDeck, buildDeckDetailed, extractChoices } from '../scripts/build-content.mjs';
const raw = (entries: { no: number; question?: string | null; answer?: string | null; explanation?: string | null }[], chapter = 1, image = 'IMG_1') => ({ image, chapter, chapterTitle: 'コンピュータ', entries });
describe('情報I のコンテンツ生成', () => {
  it('章・番号順、安定したID、ページまたぎの非空フィールド補完', () => {
    const result = buildDeckDetailed([
      raw([{ no: 1, question: '', answer: '8 ビット', explanation: '補足' }], 1, 'IMG_10'),
      raw([{ no: 2, question: '次の問題', answer: '答え' }, { no: 1, question: '何ビット？', answer: '', explanation: null }], 1, 'IMG_2'),
      raw([{ no: 1, question: '章2', answer: '回答2' }], 2),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.deck.items.map(i => i.id)).toEqual(['joho-1-1', 'joho-1-2', 'joho-2-1']);
    expect(result.deck.items[0]).toMatchObject({ question: '何ビット？', answer: '8 ビット', explanation: '補足', chapterId: 'joho-ch1', deck: 'joho' });
    expect(result.duplicates).toHaveLength(1);
    expect(result.deck.chapters[0].title).toBe('第1章 コンピュータ');
  });
  it('抜け・重複・空の問題を報告し、空欄で生成を停止する', () => {
    const pages = [raw([{ no: 2, question: '問題', answer: '' }, { no: 2, question: '', answer: null }])];
    const result = buildDeckDetailed(pages);
    expect(result.gaps[0]).toContain('1');
    expect(result.duplicates).toHaveLength(1);
    expect(result.report).toContain('空の answer');
    expect(() => buildDeck(pages)).toThrow('空の answer');
  });
  it('改行・全角空白区切りの選択肢、単一正解だけを抽出する', () => {
    for (const separator of ['\n', '　']) {
      expect(extractChoices(`手法は？\n⓪ 線形${separator}① 二分${separator}② ハッシュ`, '① 二分')).toEqual({ prompt: '手法は？', choices: ['線形', '二分', 'ハッシュ'], correctIndex: 1 });
    }
    expect(extractChoices('選べ\n⓪ A　① B　② C', '⓪①③')).toEqual({});
    expect(extractChoices('選べ\n⓪ A　① B', '③ C')).toEqual({});
  });
  it('○×は2択にする', () => {
    expect(extractChoices('正しい？', '×')).toEqual({ choices: ['○', '×'], correctIndex: 1 });
  });
  it('IDで指定した訂正を選択肢抽出の前に反映', () => {
    const deck = buildDeck([raw([{ no: 1, question: '正しい？', answer: '未訂正' }])], 'v', [{ id: 'joho-1-1', changes: { answer: '○' } }]);
    expect(deck.items[0].choices).toEqual(['○', '×']);
    expect(() => buildDeck([], 'v', [{ id: 'absent', changes: {} }])).toThrow();
  });
});
