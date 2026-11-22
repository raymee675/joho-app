import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { meaningText, deck } from '../deck';
import { clearChapter, getProgress, getSettings, recordAnswer, setLevel } from '../db';
import { RANK_TEST_SIZE, isPassed, nextRank, passMark, rankNo } from '../rank';
import { LEVEL_WEAK } from '../srs';
import { loadSource } from '../source';
import GoalBanner from '../components/GoalBanner';
import { SET_SIZE, accuracy, grade, makeQuestion, hintText, optionText, pickItems, readingOf, wrongItems, type QuizMode, type Result, type Verdict } from '../quiz';
import type { Item } from '../types';

const AUTO_NEXT_MS = 800;

export default function Quiz() {
  const { chapterId = '' } = useParams();
  const [params] = useSearchParams();
  const rankup = params.get('rankup') === '1';
  const all = params.get('n') === 'all' && !rankup;
  const limit = rankup ? RANK_TEST_SIZE : all ? null : SET_SIZE;
  const mode: QuizMode = params.get('mode') === 'reading' ? 'reading' : 'meaning';
  const [source, setSource] = useState<Item[] | null>(null);
  const [seconds, setSeconds] = useState(10);
  const [hideChoices, setHideChoices] = useState(false);
  const [round, setRound] = useState<Item[] | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSeconds(s.quizSeconds);
      setHideChoices(s.hideQuizChoices);
      const loaded = await loadSource(chapterId);
      const items = mode === 'reading' ? loaded.items.filter((i) => readingOf(i)) : loaded.items;
      setSource(items);
      setRound(pickItems(items, limit));
      setResults(null);
    })();
  }, [chapterId, all, mode, limit]);

  const start = (items: Item[]) => {
    setRound(pickItems(items, null));
    setResults(null);
    setRunKey((k) => k + 1);
  };

  if (!round || !source) return <div className="page" />;
  if (results) {
    const wrong = wrongItems(results);
    return (
      <ResultView
        results={results}
        mode={mode}
        rankChapter={rankup ? chapterId : null}
        onRetryWrong={wrong.length && !rankup ? () => start(wrong) : null}
        onAgain={() => { setRound(pickItems(source, limit)); setResults(null); setRunKey((k) => k + 1); }}
      />
    );
  }
  if (!round.length) {
    return (
      <div className="page">
        <p>出題できる単語がありません。</p>
        <Link className="btn block" to="/">章へ戻る</Link>
      </div>
    );
  }
  return <Run key={runKey} items={round} seconds={seconds} hideChoices={hideChoices} mode={mode} title={rankup ? `ランク ${rankNo(chapterId)} アップテスト` : null} onDone={setResults} />;
}

function Run({ items, seconds, hideChoices, mode, title, onDone }: { items: Item[]; seconds: number; hideChoices: boolean; mode: QuizMode; title: string | null; onDone: (r: Result[]) => void }) {
  const [i, setI] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [remain, setRemain] = useState(1);
  const [revealed, setRevealed] = useState(!hideChoices);
  const choicesVisible = revealed || !!verdict;
  const lockRef = useRef(false);
  const cur = items[i];

  const q = useMemo(() => {
    const pool = deck.items.filter((x) => x.deck === cur.deck);
    // sample の章は意味グループでなく番号順なので、意味の近い語として扱わない。
    const meaningGroups = cur.deck !== 'kobun' || deck.version === 'sample' ? [] : deck.chapters.filter((chapter) => chapter.deck === cur.deck);
    return makeQuestion(cur, pool, Math.random, 4, mode, meaningGroups);
  }, [cur, mode]);

  const finish = (v: Verdict, picked: string | null) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setVerdict(v);
    setPickedId(picked);
    setResults((r) => [...r, { item: cur, verdict: v }]);
    void recordAnswer(cur.id, v === 'correct');
  };
  const answer = (id: string | null) => finish(grade(cur, id), id);

  const next = () => {
    if (!lockRef.current) return;
    if (i + 1 >= items.length) { onDone(results); return; }
    lockRef.current = false;
    setVerdict(null);
    setPickedId(null);
    setRemain(1);
    setRevealed(!hideChoices);
    setI(i + 1);
  };

  // 時間ゲージ
  useEffect(() => {
    if (verdict || seconds === 0) return;
    const t0 = performance.now();
    const id = setInterval(() => {
      const r = 1 - (performance.now() - t0) / (seconds * 1000);
      if (r <= 0) { setRemain(0); clearInterval(id); answer(null); } else setRemain(r);
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, verdict, seconds]);

  // 正解時は自動で次へ
  useEffect(() => {
    if (verdict !== 'correct') return;
    const t = setTimeout(next, AUTO_NEXT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict]);

  const label = verdict === 'correct' ? '正解！' : verdict === 'timeout' ? '時間切れ' : verdict === 'unknown' ? 'わからない' : '残念';

  return (
    <div className="page" onClickCapture={(e) => {
      if (choicesVisible || (e.target instanceof Element && e.target.closest('a'))) return;
      e.preventDefault();
      e.stopPropagation();
      setRevealed(true);
    }}>
      {seconds > 0 && <div className="gauge" role="progressbar" aria-label="残り時間"><i data-testid="gauge" style={{ width: `${remain * 100}%` }} /></div>}
      <header className="top">
        <Link to="/" aria-label="中断">×</Link>
        {title && <b className="run-title">{title}</b>}
        <span data-testid="progress">{i + 1} / {items.length}</span>
      </header>
      <div className="card quizq">
        <div className="word">{cur.word}</div>
        {cur.kanji && <div className="sub">{cur.kanji}</div>}
        {mode === 'meaning' && readingOf(cur) && <div className="sub">〔{readingOf(cur)}〕</div>}
        {mode === 'meaning' && cur.quizContext && <div className="sub">{cur.quizContext}</div>}
        {mode === 'reading' && <div className="sub">読みを選ぼう</div>}
        {mode === 'reading' && <div className="sub hint-meaning" data-testid="hint">{hintText(cur)}</div>}
        {verdict && <div className={`mark ${verdict === 'correct' ? 'ok' : 'ng'}`} data-testid="mark">{verdict === 'correct' ? '○' : '×'}</div>}
      </div>
      {!choicesVisible && <button className="btn block reveal" onClick={() => setRevealed(true)}>画面をタップして選択肢を表示</button>}
      <div className="choices">
        {q.choices.map((c, index) => {
          const state = verdict ? (c.id === cur.id ? 'right' : c.id === pickedId ? 'wrong' : '') : '';
          return <button key={c.id} className={`btn choice ${state}`} disabled={!!verdict} onClick={() => { if (choicesVisible) answer(c.id); else setRevealed(true); }}>{choicesVisible ? c.text : `選択肢 ${index + 1}（タップで表示）`}</button>;
        })}
      </div>
      {!verdict && <button className="btn block" onClick={() => finish('unknown', null)}>わからない</button>}
      {verdict && (
        <>
          <div className="card explain">
            <b>{cur.word}</b>{readingOf(cur) && `〔${readingOf(cur)}〕`}：{meaningText(cur)}
            {cur.notes.map((n, k) => <p key={k} className="note">{n}</p>)}
          </div>
          <button className="btn primary block" onClick={next}>{label} → 次へ</button>
        </>
      )}
    </div>
  );
}

function ResultView({ results, mode, rankChapter, onRetryWrong, onAgain }: { results: Result[]; mode: QuizMode; rankChapter: string | null; onRetryWrong: (() => void) | null; onAgain: () => void }) {
  const score = results.filter((r) => r.verdict === 'correct').length;
  const passed = rankChapter !== null && isPassed(score, results.length);
  const next = rankChapter ? nextRank(rankChapter) : null;
  useEffect(() => { if (passed && rankChapter) void clearChapter(rankChapter, score); }, [passed, rankChapter, score]);
  // 正解したけれど自信がない語を、自分で苦手に入れる。もう一度押すと元の段階に戻す
  const [unsure, setUnsure] = useState<Map<string, number>>(new Map());
  const toggleUnsure = async (item: Item) => {
    const m = new Map(unsure);
    const prev = m.get(item.id);
    if (prev === undefined) {
      m.set(item.id, (await getProgress(item.id))?.box ?? 1);
      await setLevel(item.id, LEVEL_WEAK);
    } else {
      m.delete(item.id);
      await setLevel(item.id, prev);
    }
    setUnsure(m);
  };
  return (
    <div className="page">
      <h1>{rankChapter ? `ランク ${rankNo(rankChapter)} アップテスト` : '結果'}</h1>
      <p className="big" data-testid="score">{score} / {results.length}</p>
      <p className="center" data-testid="accuracy">正答率 {accuracy(results)}%</p>
      {rankChapter && (passed
        ? <p className="rank-result ok" data-testid="rank-result">合格！ランク {rankNo(rankChapter)} クリア{next ? `。次は ランク ${rankNo(next.id)}「${next.title}」` : '。すべてのランクをクリアしました'}</p>
        : <p className="rank-result ng" data-testid="rank-result">不合格… 合格は {passMark(results.length)} 問以上。苦手を復習してもう一度</p>)}
      <GoalBanner />
      <p className="center note">正解したけれど自信がない語は「自信なし」で苦手に入れられます</p>
      <ul className="words result-list" data-testid="result-list">
        {results.map((r, k) => (
          <li key={k} className="card result-row">
            <span className={r.verdict === 'correct' ? 'ok' : 'ng'}>{r.verdict === 'correct' ? '○' : '×'}</span>
            <b>{r.item.word}</b>{readingOf(r.item) && <small>〔{readingOf(r.item)}〕</small>}
            <span>{optionText(r.item, mode)}</span>
            {r.verdict === 'correct' && (
              <button className={`unsure${unsure.has(r.item.id) ? ' on' : ''}`} aria-pressed={unsure.has(r.item.id)} onClick={() => toggleUnsure(r.item)}>自信なし</button>
            )}
          </li>
        ))}
      </ul>
      {passed && next && <Link className="btn primary block" to={`/chapter/${next.id}`} data-testid="next-rank">次のランクへ</Link>}
      {rankChapter && !passed && <Link className="btn primary block" to={`/quiz/weak-${rankChapter}`}>この章の苦手を復習</Link>}
      {onRetryWrong && <button className="btn primary block" onClick={onRetryWrong}>間違えた語だけ解き直す</button>}
      <button className="btn block" onClick={onAgain}>もう一度</button>
      <Link className="btn block" to="/">章へ戻る</Link>
    </div>
  );
}
