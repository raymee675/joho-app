export type DeckName = 'joho';
export interface Item {
  id: string;
  deck: DeckName;
  chapterId: string;
  chapter: number;
  no: number;
  question: string;
  answer: string;
  explanation: string | null;
  prompt?: string;
  choices?: string[];
  correctIndex?: number;
}
export interface Chapter { id: string; deck: DeckName; title: string; itemIds: string[] }
export interface Deck { version: string; items: Item[]; chapters: Chapter[] }
