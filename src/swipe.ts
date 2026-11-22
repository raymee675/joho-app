export type SwipeVerdict = 'known' | 'unknown' | 'back';

export interface SwipeMove { dx: number; dy: number; dt: number }

/** 指の移動量がこれ未満ならタップ（裏返し）として扱う */
export const TAP_SLOP = 8;
/** 幅に対する移動量の割合。これを超えたら確定 */
export const DISTANCE_RATIO = 0.3;
/** px/ms。これより速い横フリックは移動量が小さくても確定 */
export const FLICK_SPEED = 0.5;
export const FLICK_MIN_DISTANCE = 40;

export const isTap = ({ dx, dy }: SwipeMove): boolean => Math.hypot(dx, dy) < TAP_SLOP;

/** 離した時点の移動量・速度から、覚えた(右) / まだ(左) / 戻す を決める */
export function judgeSwipe(m: SwipeMove, width: number): SwipeVerdict {
  const ax = Math.abs(m.dx);
  if (ax <= Math.abs(m.dy)) return 'back';
  const speed = m.dt > 0 ? ax / m.dt : 0;
  const far = ax >= width * DISTANCE_RATIO;
  const flick = ax >= FLICK_MIN_DISTANCE && speed >= FLICK_SPEED;
  if (!far && !flick) return 'back';
  return m.dx > 0 ? 'known' : 'unknown';
}

/** 判定ラベルの濃さ 0〜1（しきい値で 1） */
export const labelOpacity = (dx: number, width: number): number => Math.min(1, Math.abs(dx) / (width * DISTANCE_RATIO));
