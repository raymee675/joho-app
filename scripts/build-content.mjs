import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clean = value => typeof value === 'string' ? value.trim() : '';
export function extractChoices(question, answer) {
  if (/^[○×]$/.test(answer)) return { choices: ['○', '×'], correctIndex: answer === '○' ? 0 : 1 };
  if ((answer.match(/[⓪①②③④⑤⑥⑦⑧⑨]/g) ?? []).length !== 1) return {};
  const match = answer.match(/^([⓪①②③④⑤⑥⑦⑧⑨])\s*([^⓪①②③④⑤⑥⑦⑧⑨].*)$/s);
  if (!match) return {};
  const start = question.search(/(?:^|\n)\s*[⓪①②③④⑤⑥⑦⑧⑨]/);
  if (start < 0) return {};
  const parts = [...question.slice(start).matchAll(/([⓪①②③④⑤⑥⑦⑧⑨])\s*([^⓪①②③④⑤⑥⑦⑧⑨]*)/g)];
  const choices = parts.map(p => p[2].trim());
  const correctIndex = parts.findIndex(p => p[1] === match[1]);
  if (parts.length < 2 || correctIndex < 0 || choices.some(c => !c) || new Set(parts.map(p => p[1])).size !== parts.length) return {};
  return { prompt: question.slice(0, start).trim(), choices, correctIndex };
}

export function buildDeckDetailed(raws, version = 'dev', corrections = []) {
  const byId = new Map(), titles = new Map(), duplicates = [], errors = [];
  for (const raw of [...raws].sort((a, b) => String(a.image).localeCompare(String(b.image), 'en', { numeric: true }))) {
    if (!Number.isInteger(raw.chapter) || raw.chapter < 1) { errors.push(`章番号不正: ${raw.image}`); continue; }
    if (clean(raw.chapterTitle)) titles.set(raw.chapter, clean(raw.chapterTitle));
    for (const entry of raw.entries ?? []) {
      if (!Number.isInteger(entry.no) || entry.no < 1) { errors.push(`問題番号不正: ${raw.image}/${entry.no}`); continue; }
      const id = `joho-${raw.chapter}-${entry.no}`;
      if (byId.has(id)) duplicates.push(`${id} (${raw.image})`);
      const item = byId.get(id) ?? { id, deck: 'joho', chapterId: `joho-ch${raw.chapter}`, chapter: raw.chapter, no: entry.no, question: '', answer: '', explanation: null };
      for (const key of ['question', 'answer', 'explanation']) if (clean(entry[key])) item[key] = clean(entry[key]);
      byId.set(id, item);
    }
  }
  for (const correction of corrections) {
    const item = byId.get(correction.id);
    if (!item) throw new Error(`訂正対象がありません: ${correction.id}`);
    for (const [key, value] of Object.entries(correction.changes)) {
      if (!['question', 'answer', 'explanation'].includes(key)) throw new Error(`訂正フィールド不正: ${key}`);
      item[key] = clean(value) || (key === 'explanation' ? null : '');
    }
  }
  const items = [...byId.values()].sort((a, b) => a.chapter - b.chapter || a.no - b.no);
  const chapters = [...new Set(items.map(i => i.chapter))].map(chapter => ({ id: `joho-ch${chapter}`, deck: 'joho', title: `第${chapter}章 ${titles.get(chapter) ?? ''}`.trim(), itemIds: items.filter(i => i.chapter === chapter).map(i => i.id) }));
  const gaps = [];
  for (const ch of chapters) {
    const members = items.filter(i => i.chapterId === ch.id), numbers = new Set(members.map(i => i.no));
    const missing = Array.from({ length: Math.max(...numbers) }, (_, i) => i + 1).filter(n => !numbers.has(n));
    if (missing.length) gaps.push(`${ch.title}: ${missing.join(', ')}`);
  }
  for (const item of items) {
    if (!item.question || !item.answer) errors.push(`${item.id}: 空の ${!item.question ? 'question' : 'answer'}`);
    Object.assign(item, extractChoices(item.question, item.answer));
  }
  if (!items.length) errors.push('問題がありません');
  const section = (title, list) => `## ${title}\n${list.length ? list.map(x => `- ${x}`).join('\n') : 'なし'}\n`;
  const report = `# 情報I コンテンツ検証\n\n${items.length} 問 / ${chapters.length} 章\n\n${section('番号の抜け', gaps)}\n${section('重複（後のページの空でないフィールドで補完）', duplicates)}\n${section('エラー', errors)}`;
  return { deck: { version, items, chapters }, report, errors, duplicates, gaps };
}
export function buildDeck(raws, version = 'dev', corrections = []) {
  const result = buildDeckDetailed(raws, version, corrections);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  return result.deck;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const outputArg = process.argv.indexOf('--output-dir');
  const output = outputArg >= 0 ? resolve(process.argv[outputArg + 1]) : join(root, 'content');
  const raws = readdirSync(join(root, 'content/raw')).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(join(root, 'content/raw', f), 'utf8')));
  const corrections = JSON.parse(readFileSync(join(root, 'scripts/content-corrections.json'), 'utf8'));
  const result = buildDeckDetailed(raws, new Date().toISOString().slice(0, 10), corrections);
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'report.md'), result.report);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  mkdirSync(join(output, 'build'), { recursive: true });
  writeFileSync(join(output, 'build/deck.json'), JSON.stringify(result.deck, null, 2));
  console.log(`${raws.length} files, ${result.deck.items.length} items, ${result.deck.chapters.length} chapters, ${result.duplicates.length} merged`);
}
