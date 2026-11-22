// content/raw/*.json から content/build/deck.json を生成する
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHUNK = 20;
const MIN_TAIL = 5;

const deckOf = (kind) => (kind === 'kobun-word' ? 'kobun' : kind === 'kanbun-word' || kind === 'kanbun-kuhou' ? 'kanbun' : null);
const clean = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);
// 「（　）」だけの空欄は訳ではない
const isBlankMeaning = (s) => /^[（(][\s　]*[）)]$/.test(s);

// 書き起こし作業の名残（ページまたぎ・推定・要確認の注記）は利用者に見せない
const META_PAREN = /[（(][^（）()]*(次ページ|前ページ|写真|p\.\d+|IMG_)[^（）()]*[）)]/g;
const META_NOTE = /前ページ|次ページ|要確認|IMG_|写真|判読不能|統合済み|続く可能性|^ここまで/;
const cleanNote = (n) => {
  const s = clean(n);
  if (!s) return null;
  const t = clean(s.replace(META_PAREN, '').replace(/…$/, ''));
  return t && !META_NOTE.test(t) ? t : null;
};

// 漢文は区分が《…》【…】で書かれ、ページ途中の注記「以下《…》」で切り替わる
const kanbunSection = (s) => {
  const cleaned = s.replace(/^漢文\s*重要語彙/, '');
  const groups = cleaned.match(/《[^》]*》/g) ?? [];
  const sub = cleaned.match(/【[^】]*】/);
  return { main: groups[0]?.slice(1, -1) ?? null, sub: sub ? sub[0] : '' };
};
const kanbunLabel = ({ main, sub }) => `${(main ?? '漢文').replace(/主に|となるもの/g, '')}${sub}`;

const normSense = (s) => ({ label: clean(s.label), meanings: (s.meanings ?? []).map(clean).filter((m) => m && !isBlankMeaning(m)) });

// 漢文の項目を読み（〔〕）ごとに分ける。label が〔〕を含まない sense は直前の読みに含める。読みが無ければ分けない
export function splitByReading(c) {
  const groups = [];
  for (const s of c.senses) {
    const rs = (s.label ?? '').match(/〔([^〕]*)〕/g)?.map((r) => r.slice(1, -1)) ?? [];
    // 〔〃〕（上と同じ読み）は直前の読みに置き換える。項目は分けたまま（ID と意味のグループを保つ）
    const prev = groups.findLast((g) => g.reading)?.reading;
    if (prev && rs.length && rs.every((r) => /^[〃″]$/.test(r.trim()))) {
      groups.push({ reading: prev, senses: [{ ...s, label: (s.label ?? '').replace(/〔[^〕]*〕/g, `〔${prev}〕`) }] });
    } else if (rs.length) groups.push({ reading: [...new Set(rs)].join('・'), senses: [s] });
    else if (groups.length) groups.at(-1).senses.push(s);
    else groups.push({ reading: null, senses: [s] });
  }
  const first = groups.findIndex((g) => g.reading);
  if (first < 0) return [{ reading: c.reading, senses: c.senses }];
  // 先頭の読みなし sense は最初の読みに寄せる
  const lead = groups.slice(0, first).flatMap((g) => g.senses);
  const out = groups.slice(first);
  out[0].senses = [...lead, ...out[0].senses];
  return out;
}

// 前ページ末尾の項目に、次ページ冒頭の断片 frag を結合する
function mergeFragment(target, frag) {
  const incoming = frag.senses.filter((s) => s.meanings.length > 0);
  const key = (s) => s.meanings.join('/');
  const kept = target.senses.filter((s) => s.meanings.length > 0)
    .filter((s) => !incoming.some((f) => s.meanings.every((m) => f.meanings.includes(m)) && key(s) !== key(f)));
  for (const f of incoming) if (!kept.some((s) => key(s) === key(f))) kept.push(f);
  target.senses = kept;
  for (const n of frag.notes) if (!target.notes.includes(n)) target.notes.push(n);
  if (!target.kanji) target.kanji = frag.kanji;
  if (!target.reading) target.reading = frag.reading;
}

// 1 章が長くなりすぎないよう CHUNK 語前後ずつ。端数が MIN_TAIL 語未満なら前の章へ寄せる
export function chunkSizes(n) {
  if (n <= 0) return [];
  const full = Math.floor(n / CHUNK);
  const rem = n % CHUNK;
  if (full === 0) return [rem];
  const sizes = Array(full).fill(CHUNK);
  if (rem >= MIN_TAIL) sizes.push(rem);
  else sizes[full - 1] += rem;
  return sizes;
}

// 詳細つき: { deck, merged, dropped }。groups があれば章は意味の近い語のグループ、無ければ並び順で区切る
export function buildDeckDetailed(raws, version = 'dev', groups = null, corrections = []) {
  const merged = [];
  const dropped = [];
  const cands = [];
  const prevLast = {};
  const kanbunState = { cur: null };

  for (const raw of raws) {
    const deck = deckOf(raw.kind);
    if (!deck) continue;
    if (deck === 'kanbun') kanbunState.cur = kanbunSection((raw.section ?? '').split('→')[0]);
    let lastOfPage = null;
    (raw.entries ?? []).forEach((e, idx) => {
      const word = clean(e.word);
      const no = Number.isInteger(e.no) ? e.no : null;
      const entry = {
        deck, no, word,
        kanji: clean(e.kanji), reading: clean(e.reading),
        pos: null,
        senses: (e.senses ?? []).map(normSense),
        notes: (e.notes ?? []).map(cleanNote).filter(Boolean),
        _page: raw.page,
      };
      if (deck === 'kanbun') {
        entry.pos = kanbunLabel(kanbunState.cur);
        const sw = (e.notes ?? []).map((n) => String(n).match(/以下(《[^》]*》)?(【[^】]*】)?/)).find((m) => m && (m[1] || m[2]));
        if (sw) kanbunState.cur = { main: sw[1] ? sw[1].slice(1, -1) : kanbunState.cur.main, sub: sw[2] ?? '' };
      } else {
        entry.pos = clean(e.section) ?? clean(raw.section);
      }
      const prev = prevLast[deck];
      if (idx === 0 && no === null && prev && (!word || word === prev.word)) {
        mergeFragment(prev, entry);
        merged.push({ page: raw.page, word: prev.word, no: prev.no });
        lastOfPage = prev;
        return;
      }
      if (!word) return;
      cands.push(entry);
      lastOfPage = entry;
    });
    prevLast[deck] = lastOfPage ?? prevLast[deck];
  }

  const byId = new Map();
  const byNo = new Set();
  for (const c of cands) {
    if (c.senses.every((s) => s.meanings.length === 0)) {
      dropped.push({ page: c._page, no: c.no, word: c.word });
      continue;
    }
    c.senses = c.senses.filter((s) => s.meanings.length > 0);
    if (c.no !== null && byNo.has(`${c.deck}-${c.no}`)) continue;
    if (c.no !== null) byNo.add(`${c.deck}-${c.no}`);
    const parts = c.deck === 'kanbun' ? splitByReading(c) : null;
    if (parts && parts.some((p) => p.reading)) {
      let n = 0;
      for (const p of parts) {
        let id;
        do id = `${c.deck}-${c.word}-${++n}`; while (byId.has(id));
        byId.set(id, { id, deck: c.deck, chapterId: '', no: c.no, word: c.word, kanji: c.kanji, reading: p.reading, pos: c.pos, senses: p.senses, notes: c.notes, _order: byId.size });
      }
      continue;
    }
    let id;
    if (c.no !== null) {
      id = `${c.deck}-${c.no}`;
    } else {
      id = `${c.deck}-w-${c.word}`;
      for (let k = 2; byId.has(id); k++) id = `${c.deck}-w-${c.word}-${k}`;
    }
    byId.set(id, { id, deck: c.deck, chapterId: '', no: c.no, word: c.word, kanji: c.kanji, reading: c.reading, pos: c.pos, senses: c.senses, notes: c.notes, _order: byId.size });
  }

  const items = [];
  for (const deck of ['kobun', 'kanbun']) {
    const list = [...byId.values()].filter((i) => i.deck === deck);
    list.sort((a, b) => (a.no ?? Infinity) - (b.no ?? Infinity) || a._order - b._order);
    for (const m of list) { delete m._order; items.push(m); }
  }
  applyCorrections(items, corrections);
  const chapters = groups ? chaptersFromGroups(items, groups) : chaptersInOrder(items);
  // 複数の章に入る語は、最初に現れた章を chapterId にする
  const firstChapter = new Map();
  for (const c of chapters) for (const id of c.itemIds) if (!firstChapter.has(id)) firstChapter.set(id, c.id);
  for (const it of items) it.chapterId = firstChapter.get(it.id);
  return { deck: { version, items, chapters }, merged, dropped };
}

// 教材の訂正は追跡対象のファイルに保存する。番号の再利用による誤適用も検出する。
export function applyCorrections(items, corrections) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const applied = new Set();
  const fields = new Set(['word', 'kanji', 'reading', 'pos', 'senses', 'notes', 'quizContext']);
  for (const correction of corrections) {
    const item = byId.get(correction.id);
    if (!item || item.word !== correction.word || applied.has(correction.id)) {
      throw new Error(`教材訂正の対象が不一致または重複: ${correction.id}（${correction.word}）`);
    }
    for (const key of Object.keys(correction.changes)) {
      if (!fields.has(key)) throw new Error(`教材訂正で変更できないフィールド: ${key}`);
    }
    Object.assign(item, correction.changes);
    applied.add(correction.id);
  }
}

// 意味のグループは大まかなまとまりのまま 1 章にする。GROUP_MAX 語を超えるときだけ均等に分ける
const GROUP_MAX = 50;
export function groupSizes(n) {
  if (n <= 0) return [];
  const parts = Math.ceil(n / GROUP_MAX);
  return Array.from({ length: parts }, (_, i) => Math.floor(n / parts) + (i < n % parts ? 1 : 0));
}

const deckTitle = (deck) => (deck === 'kobun' ? '古文単語' : '漢文');
const toId = (deck, x) => (String(x).startsWith(`${deck}-`) ? String(x) : `${deck}-${x}`);

// 意味の近い語のグループ（content/groups.json）から章を作る。同じ語が複数のグループに入ってよい。
// groups: { kobun: [{ section, title, items: [no | 'w-語' | '字-1' | 完全な ID] }], kanbun: [...] }
// どのグループにも入らない語や、存在しない ID があればエラーにする（出題漏れを防ぐ）
export function chaptersFromGroups(items, groups) {
  const ids = new Set(items.map((i) => i.id));
  const covered = new Set();
  const errors = [];
  const chapters = [];
  for (const deck of ['kobun', 'kanbun']) {
    let chNo = 0;
    for (const g of groups[deck] ?? []) {
      const members = [...new Set((g.items ?? []).map((x) => toId(deck, x)))];
      for (const id of members) if (!ids.has(id)) errors.push(`存在しない ID: ${id}（${g.title}）`);
      const valid = members.filter((id) => ids.has(id));
      valid.forEach((id) => covered.add(id));
      const sizes = groupSizes(valid.length);
      let at = 0;
      sizes.forEach((size, i) => {
        const part = valid.slice(at, at + size);
        at += size;
        chapters.push({ id: `${deck}-ch${++chNo}`, deck, section: g.section ?? null, title: sizes.length === 1 ? g.title : `${g.title} ${i + 1}`, itemIds: part });
      });
    }
  }
  for (const it of items) if (!covered.has(it.id)) errors.push(`どのグループにも入っていない語: ${it.id}（${it.word}）`);
  if (errors.length) throw new Error(`groups.json の不備 ${errors.length} 件\n${errors.join('\n')}`);
  return chapters;
}

// グループ定義が無いとき（サンプルなど）は、並び順に CHUNK 語前後ずつ
function chaptersInOrder(items) {
  const chapters = [];
  for (const deck of ['kobun', 'kanbun']) {
    const list = items.filter((i) => i.deck === deck);
    const sizes = chunkSizes(list.length);
    let at = 0;
    sizes.forEach((size, i) => {
      const part = list.slice(at, at + size);
      at += size;
      chapters.push({ id: `${deck}-ch${i + 1}`, deck, section: null, title: sizes.length === 1 ? deckTitle(deck) : `${deckTitle(deck)} ${i + 1}`, itemIds: part.map((m) => m.id) });
    });
  }
  return chapters;
}

export function buildDeck(raws, version = 'dev', groups = null, corrections = []) {
  return buildDeckDetailed(raws, version, groups, corrections).deck;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(root, 'content/raw');
  const raws = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
  const groupsPath = join(root, 'content/groups.json');
  const groups = existsSync(groupsPath) ? JSON.parse(readFileSync(groupsPath, 'utf8')) : null;
  if (!groups) console.warn('content/groups.json が無いため、並び順で章を区切ります');
  const corrections = JSON.parse(readFileSync(join(root, 'scripts/content-corrections.json'), 'utf8'));
  const { deck, merged, dropped } = buildDeckDetailed(raws, new Date().toISOString().slice(0, 10), groups, corrections);
  mkdirSync(join(root, 'content/build'), { recursive: true });
  writeFileSync(join(root, 'content/build/deck.json'), JSON.stringify(deck));
  writeFileSync(join(root, 'content/build/stats.json'), JSON.stringify({ merged, dropped }, null, 2));
  console.log(`items: ${deck.items.length}, chapters: ${deck.chapters.length}, merged: ${merged.length}, dropped: ${dropped.length}`);
}
