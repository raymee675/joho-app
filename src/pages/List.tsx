import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deck, meaningText } from '../deck';
import { getAllProgress, setLevel, type Progress } from '../db';
import { LEVEL_WEAK } from '../srs';
import { readingOf } from '../quiz';
import { STATUSES, STATUS_LABEL, wordStatus, type WordStatus } from '../status';
import type { DeckName } from '../types';

export default function List() {
  const [params, setParams] = useSearchParams();
  const chapter = deck.chapters.find((c) => c.id === params.get('chapter'));
  const [tab, setTab] = useState<DeckName>(chapter?.deck ?? 'kobun');
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<WordStatus | null>(null);
  const [prog, setProg] = useState<Map<string, Progress>>(new Map());
  const reload = () => getAllProgress().then((l) => setProg(new Map(l.map((p) => [p.itemId, p]))));
  useEffect(() => { void reload(); }, []);
  /** 苦手に入れる / 苦手から外す（外すと うろ覚え） */
  const toggleWeak = async (id: string, weak: boolean) => { await setLevel(id, weak ? 1 : LEVEL_WEAK); await reload(); };

  const inChapter = chapter ? new Set(chapter.itemIds) : null;
  const items = deck.items.filter((i) => {
    if (inChapter ? !inChapter.has(i.id) : i.deck !== tab) return false;
    if (only && wordStatus(prog.get(i.id)) !== only) return false;
    return !q || (i.word + (i.kanji ?? '') + (readingOf(i) ?? '') + meaningText(i)).includes(q);
  });
  return (
    <div className="page">
      <h1>{chapter ? chapter.title : '単語一覧'}</h1>
      {chapter ? (
        <button className="btn sm" onClick={() => setParams({})}>すべての語を表示</button>
      ) : (
        <div className="seg">
          <button className={tab === 'kobun' ? 'on' : ''} onClick={() => setTab('kobun')}>古文</button>
          <button className={tab === 'kanbun' ? 'on' : ''} onClick={() => setTab('kanbun')}>漢文</button>
        </div>
      )}
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
                <b>{i.word}</b>{i.kanji && <small>{i.kanji}</small>}{readingOf(i) && <small>〔{readingOf(i)}〕</small>}
                <span className={`badge ${st}`}>{STATUS_LABEL[st]}</span>
                <button className={`unsure${st === 'weak' ? ' on' : ''}`} aria-pressed={st === 'weak'} onClick={() => toggleWeak(i.id, st === 'weak')}>{st === 'weak' ? '苦手から外す' : '苦手に入れる'}</button>
              </div>
              <div>{meaningText(i)}</div>
            </li>
          );
        })}
        {items.length === 0 && <li className="center">見つかりません</li>}
      </ul>
    </div>
  );
}
