import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { clearChapter, getSettings, recordAnswer, setKnown } from '../db';
import FormattedText from '../components/FormattedText';
import { loadSource } from '../source';
import { isTap, judgeSwipe, labelOpacity } from '../swipe';
import GoalBanner from '../components/GoalBanner';
import { chapterOf, isPassed, nextRank, passMark, rankNo } from '../rank';
import { selectCards } from '../cards';
import type { Item } from '../types';

const FLY_MS = 220;

export default function Study() {
  const { chapterId = '' } = useParams();
  const [params] = useSearchParams();
  const query = params.toString();
  const session = `${chapterId}?${query}`;
  const rankChapter = params.get('rankup') === '1' ? chapterOf(chapterId) : null;
  const [loaded, setLoaded] = useState<{ session: string; title: string; items: Item[] } | null>(null);
  const [hideAnswer, setHideAnswer] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([loadSource(rankChapter ?? chapterId), getSettings()]).then(([source, settings]) => {
      if (!active) return;
      setHideAnswer(settings.hideCardAnswer);
      setLoaded({ ...source, session });
    });
    return () => { active = false; };
  }, [chapterId, query, session, rankChapter]);
  if (!loaded || loaded.session !== session) return <div className="page" />;
  return <Cards key={session} chapterId={chapterId} title={loaded.title} source={loaded.items} query={query} hideAnswer={hideAnswer} rankChapter={rankChapter} />;
}

function Cards({ chapterId, title, source, query, hideAnswer, rankChapter }: { chapterId: string; title: string; source: Item[]; query: string; hideAnswer: boolean; rankChapter: string | null }) {
  const [round, setRound] = useState(() => ({ items: selectCards(source, new URLSearchParams(query), !!rankChapter), n: 0 }));
  const [i, setI] = useState(0);
  const [known, setKnownList] = useState<Item[]>([]);
  const [unknown, setUnknownList] = useState<Item[]>([]);
  const { items } = round;
  const it = items[i];

  const commit = async (item: Item, isKnown: boolean) => {
    await setKnown(item.id, isKnown);
    await recordAnswer(item.id, isKnown);
    (isKnown ? setKnownList : setUnknownList)((l) => [...l, item]);
    setI((k) => k + 1);
  };
  const again = (next: Item[]) => {
    setRound((r) => ({ items: next, n: r.n + 1 }));
    setI(0);
    setKnownList([]);
    setUnknownList([]);
  };

  if (!it) {
    return (
      <div className="page">
        <h1>{title || '問題カード'}</h1>
        {items.length === 0 ? (
          <p>問題がありません。</p>
        ) : (
          <>
            <p className="card-result" data-testid="card-result">わかった {known.length} / わからなかった {unknown.length}</p>
            {rankChapter && <RankResult chapterId={rankChapter} score={known.length} total={items.length} />}
            <GoalBanner />
            {!rankChapter && unknown.length > 0 && <button className="btn primary block" onClick={() => again(unknown)}>わからなかった問題だけもう一度</button>}
            {!rankChapter && chapterOf(chapterId) && <Link className="btn block" to={`/study/${chapterOf(chapterId)}?rankup=1`}>ランクアップテストへ</Link>}
            <button className="btn block" onClick={() => again(selectCards(source, new URLSearchParams(query), !!rankChapter))}>もう一度</button>
          </>
        )}
        <Link className="btn block" to="/">ホームへ</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="top"><Link to="/" aria-label="中断">‹ 戻る</Link><span data-testid="card-progress">{rankChapter ? `ランク ${rankNo(rankChapter)} アップテスト` : title}　{i + 1}/{items.length}</span></header>
      <SwipeCard key={`${round.n}-${it.id}`} item={it} hideAnswer={hideAnswer} onVerdict={(k) => commit(it, k)} />
    </div>
  );
}

function RankResult({ chapterId, score, total }: { chapterId: string; score: number; total: number }) {
  const passed = isPassed(score, total);
  const next = nextRank(chapterId);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (passed) void clearChapter(chapterId, score).then(() => setSaved(true));
  }, [passed, chapterId, score]);
  return <>
    <p className="big" data-testid="score">{score} / {total}</p>
    <p className={`rank-result ${passed ? 'ok' : 'ng'}`} data-testid="rank-result">{passed
      ? `合格！ランク ${rankNo(chapterId)} クリア${next ? `。次は ランク ${rankNo(next.id)}「${next.title}」` : '。すべてのランクをクリアしました'}`
      : `不合格… 合格は「わかった」が ${passMark(total)} 問以上。苦手を復習してもう一度`}</p>
    <small className="center note">この結果は「わかった／わからなかった」の自己申告によるものです。</small>
    {saved && next && <Link className="btn primary block" to={`/chapter/${next.id}`} data-testid="next-rank">次のランクへ</Link>}
    {!passed && <Link className="btn primary block" to={`/study/weak-${chapterId}`}>この章の苦手を復習</Link>}
  </>;
}

function SwipeCard({ item, hideAnswer, onVerdict }: { item: Item; hideAnswer: boolean; onVerdict: (known: boolean) => void }) {
  const [open, setOpen] = useState(!hideAnswer);
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const [dragging, setDragging] = useState(false);
  const [fly, setFly] = useState<'known' | 'unknown' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const busy = useRef(false);
  const width = () => ref.current?.offsetWidth ?? 320;

  const throwCard = (known: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setDragging(false);
    setFly(known ? 'known' : 'unknown');
    setTimeout(() => onVerdict(known), FLY_MS);
  };

  const onDown = (e: React.PointerEvent) => {
    if (busy.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y });
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    start.current = null;
    const m = { dx: e.clientX - s.x, dy: e.clientY - s.y, dt: performance.now() - s.t };
    setDragging(false);
    setDrag({ dx: 0, dy: 0 });
    if (isTap(m)) { setOpen((o) => !o); return; }
    const v = judgeSwipe(m, width());
    if (v !== 'back') throwCard(v === 'known');
  };
  const onCancel = () => { start.current = null; setDragging(false); setDrag({ dx: 0, dy: 0 }); };

  const w = width();
  const dx = fly ? (fly === 'known' ? 1 : -1) * w * 1.6 : drag.dx;
  const shownDx = fly ? (fly === 'known' ? 1 : -1) * w : drag.dx;
  const style: React.CSSProperties = {
    transform: `translate(${dx}px, ${fly ? 0 : drag.dy * 0.3}px) rotate(${dx / 20}deg)`,
    transition: dragging ? 'none' : `transform ${FLY_MS}ms ease-out`,
  };

  return (
    <>
      <div
        ref={ref}
        className="flash card swipe"
        data-item-id={item.id}
        role="button"
        aria-label="カードをめくる"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !busy.current) {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        style={style}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
      >
        <span className="stamp stamp-ok" style={{ opacity: shownDx > 0 ? labelOpacity(shownDx, w) : 0 }}>わかった</span>
        <span className="stamp stamp-ng" style={{ opacity: shownDx < 0 ? labelOpacity(shownDx, w) : 0 }}>わからなかった</span>
        <div className="word"><FormattedText text={item.question} /></div>
        {open ? (
          <div className="answer" data-testid="meaning">
            <p className="sense"><FormattedText text={item.answer} /></p>
            {item.explanation && <p className="note"><FormattedText text={item.explanation} /></p>}
          </div>
        ) : <div className="hint">タップして解答・解説を見る<br />←わからなかった　わかった→</div>}
      </div>
      <div className="row">
        <button className="btn" onClick={() => throwCard(false)}>わからなかった</button>
        <button className="btn primary" onClick={() => throwCard(true)}>わかった</button>
      </div>
    </>
  );
}
