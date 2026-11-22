import type { Deck, Item } from '../src/types';
interface RawEntry { no: number; question?: string | null; answer?: string | null; explanation?: string | null }
interface RawPage { image: string; chapter: number; chapterTitle?: string; entries: RawEntry[] }
interface Correction { id: string; changes: Partial<Pick<Item, 'question' | 'answer' | 'explanation'>> }
export function extractChoices(question: string, answer: string): Partial<Pick<Item, 'prompt' | 'choices' | 'correctIndex'>>;
export function buildDeckDetailed(raws: RawPage[], version?: string, corrections?: Correction[]): { deck: Deck; report: string; errors: string[]; duplicates: string[]; gaps: string[] };
export function buildDeck(raws: RawPage[], version?: string, corrections?: Correction[]): Deck;
