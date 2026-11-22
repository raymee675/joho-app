import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deck } from '../deck';
import { getAllProgress, setLevel, type Progress } from '../db';
import { LEVEL_WEAK } from '../srs';
import FormattedText from '../components/FormattedText';
import { STATUSES, STATUS_LABEL, wordStatus, type WordStatus } from '../status';

export default function List() {
  const [params, setParams] = useSearchParams();
  const chapter = deck.chapters.find((c) => c.id === params.get('chapter'));
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<WordStatus | null>(null);
  const [prog, setProg] = useState<Map<string, Progress>>(new Map());
  const reload = () => getAllProgress().then((l) => setProg(new Map(l.map((p) => [p.itemId, p]))));
  useEffect(() => { void reload(); }, []);
  /** 苦手に入れる / 苦手から外す（外すと うろ覚え） */
  const toggleWeak = async (id: string, weak: boolean) => { await setLevel(id, weak ? 1 : LEVEL_WEAK); await reload(); };

  const inChapter = chapter ? new Set(chapter.itemIds) : null;
  const items = deck.items.filter((i) => {
    if (inChapter && !inChapter.has(i.id)) return false;
    if (only && wordStatus(prog.get(i.id)) !== only) return false;
    return !q || (i.question + i.answer + (i.explanation ?? '')).includes(q);
  });
  return (
    <div className="page">
      <h1>{chapter ? chapter.title : '問題一覧'}</h1>
      {chapter && <button className="btn sm" onClick={() => setParams({})}>すべての問題を表示</button>}
      <input className="search" placeholder="検索" aria-label="検索" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="filters" role="group" aria-label="定着度で絞り込む">
        <button className={only === null ? 'on' : ''} onClick={() => setOnly(null)}>すべて</button>
        {STATUSES.map((s) => (
          <button key={s} className={only === s ? 'on' : ''} onClick={() => setOnly(only === s ? null : s)}><i className={`dot st-${s}`} />{STATUS_LABEL[s]}</button>
        ))}
      </div>
      <ul className="words">
        {items.map((i) => {
          const p = prog.get(i.id);
          const st = wordStatus(p);
          return (
            <li key={i.id} className="card" data-status={st}>
              <div className="word-head">
                <b><FormattedText text={i.question} /></b>
                <span className={`badge ${st}`}>{STATUS_LABEL[st]}</span>
                <button className={`unsure${st === 'weak' ? ' on' : ''}`} aria-pressed={st === 'weak'} onClick={() => toggleWeak(i.id, st === 'weak')}>{st === 'weak' ? '苦手から外す' : '苦手に入れる'}</button>
              </div>
              <div className="answer"><FormattedText text={i.answer} /></div>
              {i.explanation && <p className="note"><FormattedText text={i.explanation} /></p>}
            </li>
          );
        })}
        {items.length === 0 && <li className="center">見つかりません</li>}
      </ul>
    </div>
  );
}
