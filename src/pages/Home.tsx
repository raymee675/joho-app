import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deck } from '../deck';
import { getAllProgress, getChapterRecords, getSettings, getStreak, getToday, weakItems, type ChapterRecord, type Progress } from '../db';
import { RANK_TEST_SIZE, currentRank, passMark, ranksOf } from '../rank';
import GoalBanner from '../components/GoalBanner';
import StatusPie from '../components/StatusPie';
import LevelButtons from '../components/LevelButtons';
import { levelSource } from '../source';
import { REVIEW_STATUSES, countStatuses } from '../status';
import type { DeckName } from '../types';

const R = 48;
const C = 2 * Math.PI * R;

export default function Home() {
  const tab: DeckName = 'joho';
  const [today, setToday] = useState(0);
  const [goal, setGoal] = useState(30);
  const [streak, setStreak] = useState(0);
  const [weak, setWeak] = useState<string[]>([]);
  const [prog, setProg] = useState<Map<string, Progress>>(new Map());
  const [records, setRecords] = useState<Map<string, ChapterRecord>>(new Map());

  useEffect(() => {
    (async () => {
      setToday(await getToday());
      setGoal((await getSettings()).dailyGoal);
      setStreak(await getStreak());
      setWeak((await weakItems()).map((p) => p.itemId));
      setProg(new Map((await getAllProgress()).map((p) => [p.itemId, p])));
      setRecords(await getChapterRecords());
    })();
  }, []);

  const chapters = deck.chapters.filter((c) => c.deck === tab);
  const pct = Math.min(100, Math.round((today / goal) * 100));
  const tabIds = deck.items.filter((i) => i.deck === tab).map((i) => i.id);
  const tabCounts = countStatuses(tabIds, prog);
  const ranks = ranksOf(tab);
  const cur = currentRank(tab, records);
  const curCounts = cur && countStatuses(cur.itemIds, prog);

  return (
    <div className="page">
      <h1>情報I 一問一答</h1>
      <section className="card stats">
        <div className={`ring${pct >= 100 ? ' done' : ''}`} data-testid="goal-ring" aria-label={`今日の目標 ${pct}%`}>
          <svg width="112" height="112" viewBox="0 0 112 112">
            <circle className="track" cx="56" cy="56" r={R} />
            <circle className="fill" cx="56" cy="56" r={R} strokeDasharray={`${(C * pct) / 100} ${C}`} />
          </svg>
          <div className="ring-text"><b>{today}/{goal}</b><span>今日の回答</span></div>
        </div>
        <div style={{ gridColumn: '1/3' }}><b data-testid="streak">{streak}</b><span>日連続</span></div>
      </section>
      <GoalBanner />
      {weak.length > 0
        ? <Link className="btn primary block" to="/study/review" data-testid="weak-count">苦手の復習（{weak.length} 問）</Link>
        : <button className="btn block" disabled data-testid="weak-count">苦手な問題はありません</button>}
      <section className="card rank-card" data-testid="rank">
        <div className="rank-top"><span>情報Iのランク</span><span>クリア {ranks.filter((c) => records.has(c.id)).length} / {ranks.length}</span></div>
        <div className="rank-steps" aria-hidden>{ranks.map((c) => <i key={c.id} className={records.has(c.id) ? 'done' : c === cur ? 'cur' : ''} />)}</div>
        {cur && curCounts ? (
          <>
            <h2><small>ランク {ranks.indexOf(cur) + 1}</small>{cur.title}</h2>
            <p className="rank-note">
              {curCounts.new > 0
                ? `① 未学習 ${curCounts.new} 問題をカードで仕分け → ② ランクアップテスト`
                : `ランクアップテスト（${Math.min(RANK_TEST_SIZE, cur.itemIds.length)} 問中 ${passMark(Math.min(RANK_TEST_SIZE, cur.itemIds.length))} 問「わかった」で次のランクへ）`}
            </p>
            {curCounts.new > 0 && <Link className="btn primary block" to={`/study/lv-new-${cur.id}`} data-testid="rank-study">未学習 {curCounts.new} 問題をカードで仕分け</Link>}
            <Link className={`btn block${curCounts.new > 0 ? '' : ' primary'}`} to={`/study/${cur.id}?rankup=1`} data-testid="rank-test">ランクアップテスト</Link>
          </>
        ) : <h2 data-testid="rank-all-clear">すべてのランクをクリアしました 🎉</h2>}
      </section>
      <section className="card overview" data-testid="overview">
        <h2>情報I 全体の学習状況</h2>
        <StatusPie counts={tabCounts} legend reviewHref={(s) => (REVIEW_STATUSES.includes(s) ? `/study/${levelSource(s, `all-${tab}`)}` : null)} />
        <LevelButtons counts={tabCounts} scope={`all-${tab}`} title={`情報I全体から段階ごとに出題`} />
      </section>
      <Link className="btn block" to={`/study/all-${tab}?shuffle=1&n=20`}>ランダム出題（全体から最大20枚）</Link>
      <ul className="chapters">
        {chapters.map((c, i) => {
          const counts = countStatuses(c.itemIds, prog);
          return (
            <Fragment key={c.id}>
              <li className={`card${c === cur ? ' current' : ''}`} data-testid="chapter-card">
                <div className="ch-main">
                  <StatusPie counts={counts} size={52} />
                  <div className="ch-text">
                    <small className="rank-label">ランク {i + 1}{records.has(c.id) && <span className="clear-badge">クリア</span>}{c === cur && <span className="cur-badge">いまここ</span>}</small>
                    <Link to={`/chapter/${c.id}`}>{c.title}</Link>
                    <span data-testid="ch-summary">覚えた {counts.mastered} / {c.itemIds.length} 問{counts.weak > 0 && `・苦手 ${counts.weak}`}{counts.new > 0 && `・未学習 ${counts.new}`}</span>
                  </div>
                </div>
                <div className="row">
                  <Link className="btn primary" to={`/study/${c.id}`}>カードで学習</Link>
                  <Link className="btn" to={`/study/${c.id}?shuffle=1`}>シャッフル</Link>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
