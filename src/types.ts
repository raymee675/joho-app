export type DeckName = 'kobun' | 'kanbun';

export interface Sense { label: string | null; meanings: string[] }

export interface Item {
  id: string;
  deck: DeckName;
  chapterId: string;
  no: number | null;
  word: string;
  kanji: string | null;
  reading: string | null;
  pos: string | null;
  senses: Sense[];
  notes: string[];
  /** 意味問題で、どの語義・用法を問うかを補足する */
  quizContext?: string;
}

/** 章 = 意味の近い語のグループ。section はホームでまとめて見せる大きな区分 */
export interface Chapter { id: string; deck: DeckName; title: string; section?: string | null; itemIds: string[] }

export interface Deck { version: string; items: Item[]; chapters: Chapter[] }
