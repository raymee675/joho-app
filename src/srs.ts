export const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * 定着度（mikan 式の 4 段階）。box に保存する。
 * 0 = 苦手 / 1 = うろ覚え / 2 = ほぼ覚え / 3 = 覚えた。一度も解いていない語は「未学習」（lastSeen = 0）。
 * 旧データの box 4〜5 は「覚えた」として扱う。
 */
export const LEVEL_WEAK = 0;
export const MAX_BOX = 3;
/** 段階ごとの復習間隔（日） */
export const BOX_DAYS = [0, 1, 3, 7];

export const levelOf = (box: number): number => Math.max(0, Math.min(box, MAX_BOX));

/** 不正解 → 苦手。正解 → 1 段階上。まぐれ 1 回では「覚えた」にならない */
export function nextBox(box: number, correct: boolean): number {
  return correct ? Math.min(levelOf(box) + 1, MAX_BOX) : LEVEL_WEAK;
}

export function nextDue(box: number, now: number): number {
  return now + BOX_DAYS[levelOf(box)] * DAY_MS;
}

export function dateKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 配列のコピーをシャッフルする（rng は 0以上1未満） */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 苦手の語（一度は解いていて、定着度が「苦手」） */
export function isWeak(p: { lastSeen: number; box: number }): boolean {
  return p.lastSeen > 0 && levelOf(p.box) === LEVEL_WEAK;
}
