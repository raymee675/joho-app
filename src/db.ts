import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { dateKey, isWeak, levelOf, nextBox, nextDue } from './srs';

export interface Progress {
  itemId: string;
  correct: number;
  wrong: number;
  lastSeen: number;
  box: number;
  due: number;
  known: boolean | null;
}
/** 解いたことのある語の、段階ごとの語数（0 = 苦手 … 3 = 覚えた） */
export type LevelCounts = [number, number, number, number];
/** 1 日の記録。levels はその日の最後の時点の段階ごとの語数 */
export interface Day { date: string; answered: number; correct?: number; levels?: LevelCounts }
/** ランク（章）のクリア記録 */
export interface ChapterRecord { chapterId: string; clearedAt: number; best: number }
export interface Settings { dailyGoal: number; quizSeconds: number; hideQuizChoices: boolean; hideCardAnswer: boolean }

const DEFAULT_SETTINGS: Settings = { dailyGoal: 30, quizSeconds: 10, hideQuizChoices: false, hideCardAnswer: true };

interface Schema extends DBSchema {
  progress: { key: string; value: Progress };
  days: { key: string; value: Day };
  settings: { key: string; value: unknown };
  chapters: { key: string; value: ChapterRecord };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
function db() {
  dbp ??= openDB<Schema>('joho-app', 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('progress', { keyPath: 'itemId' });
        d.createObjectStore('days', { keyPath: 'date' });
        d.createObjectStore('settings');
      }
      if (oldVersion < 2) d.createObjectStore('chapters', { keyPath: 'chapterId' });
    },
  });
  return dbp;
}

/** テスト用: 接続を閉じて作り直せるようにする */
export async function resetDbConnection() {
  if (dbp) (await dbp).close();
  dbp = null;
}

const blank = (itemId: string): Progress => ({ itemId, correct: 0, wrong: 0, lastSeen: 0, box: 0, due: 0, known: null });

export async function getProgress(itemId: string): Promise<Progress | undefined> {
  return (await db()).get('progress', itemId);
}
export async function getAllProgress(): Promise<Progress[]> {
  return (await db()).getAll('progress');
}

export async function recordAnswer(itemId: string, correct: boolean, now = Date.now()): Promise<Progress> {
  return update(itemId, now, (p) => {
    if (correct) p.correct++; else p.wrong++;
    p.box = nextBox(p.box, correct);
    p.lastSeen = now;
  }, correct);
}

/** 自分で段階を決める（「自信がない → 苦手に入れる」など）。回答数には数えない */
export async function setLevel(itemId: string, box: number, now = Date.now()): Promise<Progress> {
  return update(itemId, now, (p) => {
    p.box = levelOf(box);
    if (p.lastSeen === 0) p.lastSeen = now;
  }, null);
}

/** 進み具合を書き換え、その日の記録（回答数・段階ごとの語数）も更新する。answered = null なら回答数は増やさない */
async function update(itemId: string, now: number, change: (p: Progress) => void, answered: boolean | null): Promise<Progress> {
  const d = await db();
  const tx = d.transaction(['progress', 'days'], 'readwrite');
  const store = tx.objectStore('progress');
  const p = (await store.get(itemId)) ?? blank(itemId);
  change(p);
  p.due = nextDue(p.box, now);
  await store.put(p);
  const levels: LevelCounts = [0, 0, 0, 0];
  for (const x of await store.getAll()) if (x.lastSeen > 0) levels[levelOf(x.box)]++;
  const key = dateKey(now);
  const day = (await tx.objectStore('days').get(key)) ?? { date: key, answered: 0 };
  if (answered !== null) {
    day.answered++;
    if (answered) day.correct = (day.correct ?? 0) + 1;
  }
  day.levels = levels;
  await tx.objectStore('days').put(day);
  await tx.done;
  return p;
}

/** 日付順の全記録 */
export async function getDays(): Promise<Day[]> {
  return (await db()).getAll('days');
}

export async function getChapterRecords(): Promise<Map<string, ChapterRecord>> {
  return new Map((await (await db()).getAll('chapters')).map((c) => [c.chapterId, c]));
}

/** ランクアップテストの結果を残す。合格したときだけ呼ぶ */
export async function clearChapter(chapterId: string, score: number, now = Date.now()): Promise<void> {
  const d = await db();
  const old = await d.get('chapters', chapterId);
  await d.put('chapters', { chapterId, clearedAt: old?.clearedAt ?? now, best: Math.max(score, old?.best ?? 0) });
}

export async function setKnown(itemId: string, known: boolean): Promise<void> {
  const d = await db();
  const p = (await d.get('progress', itemId)) ?? blank(itemId);
  p.known = known;
  await d.put('progress', p);
}

export async function getToday(now = Date.now()): Promise<number> {
  return (await (await db()).get('days', dateKey(now)))?.answered ?? 0;
}

/** 今日から遡って、answered>0 の日が連続している日数。今日まだ未回答なら昨日から数える */
export async function getStreak(now = Date.now()): Promise<number> {
  const d = await db();
  const answered = async (t: number) => ((await d.get('days', dateKey(t)))?.answered ?? 0) > 0;
  const x = new Date(now);
  if (!(await answered(x.getTime()))) x.setDate(x.getDate() - 1);
  let streak = 0;
  while (await answered(x.getTime())) {
    streak++;
    x.setDate(x.getDate() - 1);
  }
  return streak;
}

export async function getSettings(): Promise<Settings> {
  const d = await db();
  const out = { ...DEFAULT_SETTINGS };
  for (const k of ['dailyGoal', 'quizSeconds'] as const) {
    const v = await d.get('settings', k);
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = k === 'quizSeconds' ? Math.min(3600, Math.max(0, Math.round(v))) : Math.max(1, Math.round(v));
  }
  for (const k of ['hideQuizChoices', 'hideCardAnswer'] as const) {
    const v = await d.get('settings', k);
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}
export async function setSettings(s: Partial<Settings>): Promise<void> {
  const d = await db();
  for (const [k, v] of Object.entries(s)) await d.put('settings', v, k);
}

/** 復習期限が来ている（一度でも回答済みで due <= now の）項目 */
export async function dueItems(now = Date.now()): Promise<Progress[]> {
  return (await getAllProgress()).filter((p) => p.lastSeen > 0 && p.due <= now);
}

/** 定着度が「苦手」の語 */
export async function weakItems(): Promise<Progress[]> {
  return (await getAllProgress()).filter((p) => isWeak(p));
}
