import { judgeSwipe, isTap, labelOpacity } from '../src/swipe';

const W = 300;

describe('swipe', () => {
  it('しきい値を超えて右 = 覚えた、左 = まだ', () => {
    expect(judgeSwipe({ dx: 120, dy: 5, dt: 600 }, W)).toBe('known');
    expect(judgeSwipe({ dx: -120, dy: 5, dt: 600 }, W)).toBe('unknown');
  });
  it('しきい値未満で遅ければ戻す', () => {
    expect(judgeSwipe({ dx: 60, dy: 0, dt: 800 }, W)).toBe('back');
    expect(judgeSwipe({ dx: -89, dy: 0, dt: 800 }, W)).toBe('back');
  });
  it('速いフリックは移動量が小さくても確定', () => {
    expect(judgeSwipe({ dx: 50, dy: 0, dt: 60 }, W)).toBe('known');
    expect(judgeSwipe({ dx: -50, dy: 0, dt: 60 }, W)).toBe('unknown');
  });
  it('速くても移動が小さすぎれば戻す', () => {
    expect(judgeSwipe({ dx: 20, dy: 0, dt: 10 }, W)).toBe('back');
  });
  it('縦方向が主なら戻す', () => {
    expect(judgeSwipe({ dx: 150, dy: 200, dt: 300 }, W)).toBe('back');
  });
  it('タップ判定', () => {
    expect(isTap({ dx: 2, dy: -3, dt: 80 })).toBe(true);
    expect(isTap({ dx: 20, dy: 0, dt: 80 })).toBe(false);
  });
  it('ラベルの濃さは 0〜1', () => {
    expect(labelOpacity(0, W)).toBe(0);
    expect(labelOpacity(45, W)).toBeCloseTo(0.5);
    expect(labelOpacity(-500, W)).toBe(1);
  });
});
