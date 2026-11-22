import { useEffect, useState } from 'react';
import { deck } from '../deck';
import { getAllProgress, getChapterRecords, getDays, getSettings, getStreak, type ChapterRecord, type Day, type LevelCounts, type Progress } from '../db';
import { ranksOf } from '../rank';
import { DAY_MS, dateKey } from '../srs';
import { STATUS_LABEL, countStatuses } from '../status';
import StatusPie from '../components/StatusPie';
import LevelButtons from '../components/LevelButtons';

const SPAN = 14;
/** 段階 0〜3 の CSS クラス（円グラフと同じ色） */
const LEVEL_CLASS = ['st-weak', 'st-vague', 'st-almost', 'st-mastered'] as const;
const LEVEL_NAME = [STATUS_LABEL.weak, STATUS_LABEL.vague, STATUS_LABEL.almost, STATUS_LABEL.mastered];
/** 積み上げ・凡例の順（下から 覚えた → 苦手） */
const ORDER = [3, 2, 1, 0] as const;

export interface DayRow { key: string; label: string; answered: number; correct: number; levels: LevelCounts }

/** 直近 span 日の行。段階の語数は、記録の無い日は前の日の値を引き継ぐ */
export function lastDays(days: Day[], now: number, span = SPAN): DayRow[] {
  const byKey = new Map(days.map((d) => [d.date, d]));
  const withLevels = days.filter((d) => d.levels).sort((a, b) => a.date.localeCompare(b.date));
  const rows: DayRow[] = [];
  for (let k = span - 1; k >= 0; k--) {
    const t = now - k * DAY_MS;
    const key = dateKey(t);
    const d = byKey.get(key);
    let levels: LevelCounts = [0, 0, 0, 0];
    for (const x of withLevels) if (x.date <= key) levels = x.levels!;
    const date = new Date(t);
    rows.push({ key, label: `${date.getMonth() + 1}/${date.getDate()}`, answered: d?.answered ?? 0, correct: d?.correct ?? 0, levels });
  }
  return rows;
}

export default function Stats() {
  const [rows, setRows] = useState<DayRow[] | null>(null);
  const [goal, setGoal] = useState(30);
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [prog, setProg] = useState<Map<string, Progress>>(new Map());
  const [records, setRecords] = useState<Map<string, ChapterRecord>>(new Map());
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const days = await getDays();
      setTotal(days.reduce((n, d) => n + d.answered, 0));
      setGoal((await getSettings()).dailyGoal);
      setStreak(await getStreak());
      setProg(new Map((await getAllProgress()).map((p) => [p.itemId, p])));
      setRecords(await getChapterRecords());
      setRows(lastDays(days, Date.now()));
    })();
  }, []);
  if (!rows) return <div className="page" />;

  const today = rows[rows.length - 1];
  const hit = rows.filter((r) => r.answered >= goal).length;
  const counts = countStatuses(deck.items.map((i) => i.id), prog);

  return (
    <div className="page">
      <h1>学習記録</h1>
      <section className="card tiles">
        <div><b data-testid="stats-today">{today.answered}<small>/{goal}</small></b><span>今日の回答</span></div>
        <div><b>{streak}</b><span>日連続</span></div>
        <div><b data-testid="stats-total">{total}</b><span>これまでの回答</span></div>
        <div><b>{counts.mastered}</b><span>覚えた語</span></div>
      </section>

      <section className="card chart-card">
        <h2>毎日の回答数と目標</h2>
        <p className="chart-sub">直近 {SPAN} 日で目標達成 {hit} 日・点線は 1 日の目標（{goal} 問）・濃い棒は達成日</p>
        <AnswerChart rows={rows} goal={goal} hover={hover} setHover={setHover} />
      </section>

      <section className="card chart-card">
        <h2>定着度の推移</h2>
        <p className="chart-sub">解いたことのある語の、段階ごとの語数（その日の終わり時点）</p>
        <LevelChart rows={rows} hover={hover} setHover={setHover} />
        <ul className="legend inline">
          {ORDER.map((l) => <li key={l}><span><i className={`dot ${LEVEL_CLASS[l]}`} />{LEVEL_NAME[l]}</span></li>)}
        </ul>
      </section>

      <section className="card overview">
        <h2>全体の学習状況（古文・漢文 {deck.items.length} 語）</h2>
        <StatusPie counts={counts} legend />
        <LevelButtons counts={counts} scope="all" title="古文・漢文すべてから段階ごとに出題" />
      </section>

      <section className="card">
        <h2 className="card-title">ランクの進み具合</h2>
        {(['kobun', 'kanbun'] as const).map((d) => {
          const list = ranksOf(d);
          const cleared = list.filter((c) => records.has(c.id)).length;
          return (
            <div key={d} className="rank-progress">
              <span>{d === 'kobun' ? '古文' : '漢文'}</span>
              <div className="rank-steps">{list.map((c) => <i key={c.id} className={records.has(c.id) ? 'done' : ''} title={c.title} />)}</div>
              <b data-testid={`rank-progress-${d}`}>{cleared}/{list.length}</b>
            </div>
          );
        })}
      </section>

      <details className="card">
        <summary>表で見る</summary>
        <table className="day-table">
          <thead><tr><th>日付</th><th>回答</th><th>正解</th>{ORDER.map((l) => <th key={l}>{LEVEL_NAME[l]}</th>)}</tr></thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.key}><td>{r.label}</td><td>{r.answered}</td><td>{r.correct}</td>{ORDER.map((l) => <td key={l}>{r.levels[l]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const W = 340;
const H = 150;
const PAD = { l: 28, r: 6, t: 10, b: 20 };
const IW = W - PAD.l - PAD.r;

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const step = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / step) * step;
}
const yOf = (max: number) => (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);

function Frame({ rows, max, hover, setHover, children, tip, label }: {
  rows: DayRow[]; max: number; hover: number | null; setHover: (i: number | null) => void; children: React.ReactNode; tip: (r: DayRow) => string; label: string;
}) {
  const bw = IW / rows.length;
  const y = yOf(max);
  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text className="axis" x={PAD.l - 4} y={y(v) + 3} textAnchor="end">{Math.round(v)}</text>
          </g>
        ))}
        {hover !== null && <rect className="hover-band" x={PAD.l + bw * hover} y={PAD.t} width={bw} height={H - PAD.t - PAD.b} />}
        {children}
        {rows.map((r, i) => (i % 2 === (rows.length - 1) % 2) && (
          <text key={r.key} className="axis" x={PAD.l + bw * i + bw / 2} y={H - 6} textAnchor="middle">{r.label}</text>
        ))}
        {rows.map((r, i) => (
          <rect key={r.key} className="hit" x={PAD.l + bw * i} y={0} width={bw} height={H}
            onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)} />
        ))}
      </svg>
      {hover !== null && (() => {
        // 右半分では右端に、左半分では左端に寄せて、カードからはみ出さないようにする
        const at = ((PAD.l + bw * hover + bw / 2) / W) * 100;
        const style: React.CSSProperties = at > 50 ? { right: `${100 - at}%`, transform: 'translate(12px,-100%)' } : { left: `${at}%`, transform: 'translate(-12px,-100%)' };
        return <div className="tip" style={style}>{tip(rows[hover])}</div>;
      })()}
    </div>
  );
}

function AnswerChart({ rows, goal, hover, setHover }: { rows: DayRow[]; goal: number; hover: number | null; setHover: (i: number | null) => void }) {
  const max = niceMax(Math.max(goal, ...rows.map((r) => r.answered)) * 1.1);
  const bw = IW / rows.length;
  const y = yOf(max);
  return (
    <Frame rows={rows} max={max} hover={hover} setHover={setHover} label="毎日の回答数"
      tip={(r) => `${r.label}　回答 ${r.answered}・正解 ${r.correct}${r.answered >= goal ? '・目標達成' : ''}`}>
      {rows.map((r, i) => r.answered > 0 && (
        <path key={r.key} className={`bar${r.answered >= goal ? ' hit-goal' : ''}`} d={barPath(PAD.l + bw * i + bw * 0.2, y(r.answered), bw * 0.6, y(0) - y(r.answered))} />
      ))}
      <line className="goal-line" x1={PAD.l} x2={W - PAD.r} y1={y(goal)} y2={y(goal)} />
    </Frame>
  );
}

function LevelChart({ rows, hover, setHover }: { rows: DayRow[]; hover: number | null; setHover: (i: number | null) => void }) {
  const max = niceMax(Math.max(1, ...rows.map((r) => r.levels.reduce((a, b) => a + b, 0))) * 1.1);
  const bw = IW / rows.length;
  const y = yOf(max);
  return (
    <Frame rows={rows} max={max} hover={hover} setHover={setHover} label="定着度の推移"
      tip={(r) => `${r.label}　${ORDER.map((l) => `${LEVEL_NAME[l]} ${r.levels[l]}`).join('・')}`}>
      {rows.map((r, i) => {
        let acc = 0;
        return ORDER.map((l) => {
          const v = r.levels[l];
          if (!v) return null;
          const bottom = y(acc);
          acc += v;
          return <rect key={`${r.key}-${l}`} className={`seg ${LEVEL_CLASS[l]}`} x={PAD.l + bw * i + bw * 0.2} y={y(acc)} width={bw * 0.6} height={Math.max(0, bottom - y(acc) - 1)} />;
        });
      })}
    </Frame>
  );
}

/** 上の角だけ丸めた棒 */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
