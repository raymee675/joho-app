import { writeFileSync } from 'node:fs';
import { buildDeck } from './build-content.mjs';
const chapters = [
  { chapter: 1, chapterTitle: 'コンピュータ', entries: [
    ['1 バイトは何ビット？', '8 ビット', '1 ビットは 0 と 1 の 2 通りの状態を表す。'],
    ['8 ビットで表せる状態は何通り？', '256 通り', '2^8 = 256 通り。'],
    ['演算と制御を担当する装置は？', 'CPU', '中央処理装置。'],
    ['実行中のプログラムを一時的に置く記憶装置は？', '主記憶装置', null],
    ['電源を切ってもデータを保持する装置は？\n⓪ RAM\n① SSD\n② レジスタ\n③ キャッシュ', '① SSD', 'SSD は不揮発性の補助記憶装置。'],
    ['1 バイトは 8 ビットである。○か×か？', '○', 'バイトは情報量の単位。'],
  ] },
  { chapter: 2, chapterTitle: 'アルゴリズムとプログラミング', entries: [
    ['問題を解くための手順を何という？', 'アルゴリズム', null],
    ['先頭から順番に調べる探索法は？', '線形探索法', '最大でデータ数と同じ回数の比較が必要。'],
    ['整列したデータを半分ずつ絞り込む探索法は？\n⓪ 線形探索法　① 二分探索法　② バブルソート　③ 選択ソート', '① 二分探索法', '探索範囲を比較のたびに半分にする。'],
    ['条件が成立する間、処理を繰り返す構造は？', '反復構造', null],
    ['条件によって実行する処理を分ける構造は？', '選択構造', '順次・選択・反復が基本構造。'],
    ['二分探索では事前の整列が不要である。○か×か？', '×', '二分探索にはデータの整列が必要。\n数列は X_n、次の項は X_{n+1} と表せる。'],
  ] },
];
const raws = chapters.map((ch, i) => ({ ...ch, image: `sample-${i}`, entries: ch.entries.map(([question, answer, explanation], n) => ({ no: n + 1, question, answer, explanation })) }));
const deck = buildDeck(raws, 'sample');
writeFileSync(new URL('../sample/deck.json', import.meta.url), JSON.stringify(deck, null, 2));
console.log(`${deck.items.length} items, ${deck.chapters.length} chapters`);
