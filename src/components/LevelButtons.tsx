import { Link } from 'react-router-dom';
import { levelSource } from '../source';
import { REVIEW_STATUSES, STATUS_LABEL, type StatusCounts } from '../status';

/**
 * 苦手・うろ覚え・ほぼ覚え・覚えた のそれぞれの段階の問題だけを出題するボタン。
 * scope は章 ID / 'all-<deck>' / 'all'。query はテストに付ける追加条件。
 */
export default function LevelButtons({ counts, scope, query = '', title = '段階ごとに出題' }: {
  counts: StatusCounts;
  scope: string;
  query?: string;
  title?: string;
}) {
  return (
    <div className="level-buttons" role="group" aria-label={title} data-testid="level-buttons">
      <span className="level-title">{title}</span>
      <div className="level-grid">
        {REVIEW_STATUSES.map((s) => {
          const body = <><i className={`dot st-${s}`} />{STATUS_LABEL[s]}<b>{counts[s]}</b></>;
          return counts[s] > 0
            ? <Link key={s} className="btn sm" to={`/study/${levelSource(s, scope)}${query && `?${query}`}`} data-testid={`review-${s}`}>{body}</Link>
            : <button key={s} className="btn sm" disabled data-testid={`review-${s}`}>{body}</button>;
        })}
      </div>
    </div>
  );
}
