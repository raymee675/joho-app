import { Link } from 'react-router-dom';
import { STATUSES, STATUS_LABEL, type StatusCounts } from '../status';

/**
 * 学習状況の円グラフ（ドーナツ）。中央に「覚えた」の割合。
 * legend を付けると、段階ごとの語数を凡例として並べる。reviewHref があれば段階をタップして復習できる。
 */
export default function StatusPie({ counts, size = 140, legend = false, reviewHref }: {
  counts: StatusCounts;
  size?: number;
  legend?: boolean;
  reviewHref?: (status: keyof StatusCounts) => string | null;
}) {
  const total = STATUSES.reduce((n, s) => n + counts[s], 0);
  const stroke = Math.max(6, Math.round(size * 0.16));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? Math.round((counts.mastered / total) * 100) : 0;
  // 2 つ以上の段階があるときは、境目に 2px のすき間を空ける
  const gap = STATUSES.filter((s) => counts[s] > 0).length > 1 ? 2 : 0;
  let offset = 0;
  const desc = STATUSES.map((s) => `${STATUS_LABEL[s]} ${counts[s]}`).join('、');

  return (
    <div className={`pie${legend ? ' with-legend' : ''}`} data-testid="status-pie">
      <div className="pie-chart" style={{ width: size, height: size }} role="img" aria-label={`学習状況: ${desc}`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle className="pie-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
          {total > 0 && STATUSES.map((s) => {
            const len = (c * counts[s]) / total;
            if (!len) return null;
            const seg = <circle key={s} className={`pie-seg st-${s}`} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
              strokeDasharray={`${Math.max(0.5, len - gap)} ${c - Math.max(0.5, len - gap)}`} strokeDashoffset={-offset} />;
            offset += len;
            return seg;
          })}
        </svg>
        <div className="pie-text" style={{ fontSize: Math.max(11, size * 0.17) }}>
          <b>{pct}%</b>
          {size >= 100 && <span>覚えた</span>}
        </div>
      </div>
      {legend && (
        <ul className="legend">
          {STATUSES.map((s) => {
            const href = counts[s] > 0 ? reviewHref?.(s) : null;
            const body = <><i className={`dot st-${s}`} />{STATUS_LABEL[s]}<b>{counts[s]}</b></>;
            return <li key={s} data-status={s}>{href ? <Link to={href}>{body}</Link> : <span>{body}</span>}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
