import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { deck, itemById } from '../deck';
import { getAllProgress, getChapterRecords, type ChapterRecord, type Progress } from '../db';
import { RANK_TEST_SIZE, passMark, rankNo } from '../rank';
import { levelSource } from '../source';
import { REVIEW_STATUSES, countStatuses } from '../status';
import StatusPie from '../components/StatusPie';
import LevelButtons from '../components/LevelButtons';

export default function Chapter() {
  const { chapterId = '' } = useParams();
  const ch = deck.chapters.find((c) => c.id === chapterId);
  const [prog, setProg] = useState<Map<string, Progress>>(new Map());
  const [rec, setRec] = useState<ChapterRecord | null>(null);
  useEffect(() => {
    getAllProgress().then((l) => setProg(new Map(l.map((p) => [p.itemId, p]))));
    getChapterRecords().then((m) => setRec(m.get(chapterId) ?? null));
  }, [chapterId]);
  if (!ch) return <div className="page"><p>章が見つかりません。</p><Link className="btn block" to="/">ホームへ</Link></div>;

  const items = ch.itemIds.map((id) => itemById.get(id)!).filter(Boolean);
  const counts = countStatuses(ch.itemIds, prog);
  const quizOf = (src: string) => `/quiz/${src}`;

  return (
    <div className="page">
      <header className="top"><Link to="/">‹ 戻る</Link></header>
      <h1><small className="rank-label">ランク {rankNo(ch.id)}{rec && <span className="clear-badge">クリア</span>}</small>{ch.title}</h1>
      <section className="card overview">
        <h2>学習状況（{items.length} 問）</h2>
        <StatusPie counts={counts} legend reviewHref={(s) => (REVIEW_STATUSES.includes(s) ? quizOf(levelSource(s, ch.id)) : null)} />
        <LevelButtons counts={counts} scope={ch.id} title="この章の段階ごとに出題" />
      </section>
      <Link className="btn primary block" to={`/study/${ch.id}`}>カード学習</Link>
      <Link className="btn block" to={`/quiz/${ch.id}?rankup=1`} data-testid="chapter-rank-test">
        ランクアップテスト（{passMark(Math.min(RANK_TEST_SIZE, items.length))}/{Math.min(RANK_TEST_SIZE, items.length)} で合格{rec ? `・最高 ${rec.best}` : ''}）
      </Link>
      <Link className="btn block" to={quizOf(ch.id)}>4 択テスト</Link>
      {items.length > 10 && <Link className="btn block" to={`/quiz/${ch.id}?n=all`}>4 択テスト（全問）</Link>}
      {counts.new > 0 && <Link className="btn block" to={quizOf(levelSource('new', ch.id))}>未学習 {counts.new} 問題をテスト</Link>}
      <Link className="btn block" to={`/list?chapter=${ch.id}`}>問題の一覧</Link>
    </div>
  );
}
