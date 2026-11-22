import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSettings, recordAnswer, setKnown } from '../db';
import FormattedText from '../components/FormattedText';
import { loadSource } from '../source';
import { isTap, judgeSwipe, labelOpacity } from '../swipe';
import GoalBanner from '../components/GoalBanner';
import { chapterOf } from '../rank';
import type { Item } from '../types';

const FLY_MS = 220;

export default function Study() {
  const { chapterId = '' } = useParams();
  const [loaded, setLoaded] = useState<{ chapterId: string; title: string; items: Item[] } | null>(null);
  const [hideAnswer, setHideAnswer] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([loadSource(chapterId), getSettings()]).then(([source, settings]) => {
      if (!active) return;
      setHideAnswer(settings.hideCardAnswer);
      setLoaded({ ...source, chapterId });
    });
    return () => { active = false; };
  }, [chapterId]);
  if (!loaded || loaded.chapterId !== chapterId) return <div className="page" />;
  return <Cards key={chapterId} chapterId={chapterId} title={loaded.title} first={loaded.items} hideAnswer={hideAnswer} />;
}

function Cards({ chapterId, title, first, hideAnswer }: { chapterId: string; title: string; first: Item[]; hideAnswer: boolean }) {
  const [round, setRound] = useState({ items: first, n: 0 });
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
            <p className="big" data-testid="card-result">覚えた {known.length} / まだ {unknown.length}</p>
            <GoalBanner />
            {unknown.length > 0 && <button className="btn primary block" onClick={() => again(unknown)}>まだの問題だけもう一度</button>}
            {chapterOf(chapterId) && <Link className="btn block" to={`/quiz/${chapterOf(chapterId)}?rankup=1`}>ランクアップテストへ</Link>}
            <Link className="btn block" to={`/quiz/${chapterOf(chapterId) ?? chapterId}`}>この章を 4 択テスト</Link>
          </>
        )}
        <Link className="btn block" to="/">ホームへ</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="top"><Link to="/" aria-label="中断">‹ 戻る</Link><span data-testid="card-progress">{title}　{i + 1}/{items.length}</span></header>
      <SwipeCard key={`${round.n}-${it.id}`} item={it} hideAnswer={hideAnswer} onVerdict={(k) => commit(it, k)} />
    </div>
  );
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
        <span className="stamp stamp-ok" style={{ opacity: shownDx > 0 ? labelOpacity(shownDx, w) : 0 }}>覚えた</span>
        <span className="stamp stamp-ng" style={{ opacity: shownDx < 0 ? labelOpacity(shownDx, w) : 0 }}>まだ</span>
        <div className="word"><FormattedText text={item.question} /></div>
        {open ? (
          <div className="answer" data-testid="meaning">
            <p className="sense"><FormattedText text={item.answer} /></p>
            {item.explanation && <p className="note"><FormattedText text={item.explanation} /></p>}
          </div>
        ) : <div className="hint">タップして解答を見る　←まだ　覚えた→</div>}
      </div>
      <div className="row">
        <button className="btn" onClick={() => throwCard(false)}>まだ</button>
        <button className="btn primary" onClick={() => throwCard(true)}>覚えた</button>
      </div>
    </>
  );
}
