import { useEffect, useState } from 'react';
import { getSettings, getToday } from '../db';

/** 今日の回答数が目標に届いていれば、軽いお祝いを出す */
export default function GoalBanner() {
  const [hit, setHit] = useState(false);
  useEffect(() => {
    (async () => setHit((await getToday()) >= (await getSettings()).dailyGoal))();
  }, []);
  if (!hit) return null;
  return <p className="goal-banner" data-testid="goal-banner">🎉 今日の目標を達成しました！</p>;
}
