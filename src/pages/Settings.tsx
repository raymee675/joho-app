import { useEffect, useRef, useState } from 'react';
import { getSettings, setSettings, type Settings as S } from '../db';
import { reloadApp } from '../reload';

export default function Settings() {
  const [s, setS] = useState<S | null>(null);
  const [secondsDraft, setSecondsDraft] = useState('10');
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');
  const pendingSave = useRef(Promise.resolve());
  const reloadLock = useRef(false);
  useEffect(() => {
    getSettings().then((settings) => {
      setS(settings);
      setSecondsDraft(String(settings.quizSeconds || 10));
    }).catch(() => setError('設定を読み込めませんでした。もう一度開いてください。'));
  }, []);
  if (!s) return <div className="page">{error && <p role="alert">{error}</p>}</div>;
  const update = (patch: Partial<S>) => {
    setS((old) => old ? { ...old, ...patch } : old);
    pendingSave.current = pendingSave.current.catch(() => {}).then(() => setSettings(patch));
    void pendingSave.current.catch(() => setError('設定を保存できませんでした。もう一度設定してください。'));
  };
  const commitSeconds = () => {
    const value = Number(secondsDraft);
    const seconds = Number.isFinite(value) && secondsDraft.trim() ? Math.min(3600, Math.max(1, Math.round(value))) : s.quizSeconds || 10;
    setSecondsDraft(String(seconds));
    if (s.quizSeconds !== 0) update({ quizSeconds: seconds });
  };
  const refresh = async () => {
    if (reloadLock.current) return;
    reloadLock.current = true;
    setReloading(true);
    setError('');
    try {
      await pendingSave.current;
      await reloadApp();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新できませんでした。通信環境を確認して再度お試しください。');
      reloadLock.current = false;
      setReloading(false);
    }
  };
  return (
    <div className="page">
      <h1>設定</h1>
      <fieldset className="settings-fields" disabled={reloading}>
      <label className="card field">1日の目標（問）
        <input type="number" min={1} value={s.dailyGoal} onChange={(e) => update({ dailyGoal: Math.max(1, +e.target.value || 1) })} />
      </label>
      <label className="card field">クイズの制限時間（秒）
        <input type="number" min={1} max={3600} step={1} disabled={s.quizSeconds === 0} value={secondsDraft}
          onChange={(e) => {
            setSecondsDraft(e.target.value);
            const value = Number(e.target.value);
            if (Number.isInteger(value) && value >= 1 && value <= 3600) update({ quizSeconds: value });
          }}
          onBlur={commitSeconds}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <small>1〜3600秒。問題が表示された時点から計測します。</small>
      </label>
      <label className="card toggle-field">
        <input type="checkbox" checked={s.quizSeconds === 0} onChange={(e) => {
          const seconds = Math.min(3600, Math.max(1, Math.round(Number(secondsDraft)) || 10));
          setSecondsDraft(String(seconds));
          update({ quizSeconds: e.target.checked ? 0 : seconds });
        }} />
        制限時間なし
      </label>
      <label className="card toggle-field">
        <input type="checkbox" checked={s.hideQuizChoices} onChange={(e) => update({ hideQuizChoices: e.target.checked })} />
        四択の選択肢を最初は隠す
      </label>
      <p className="setting-note">画面をタップすると選択肢を表示します。隠している間も制限時間は進みます。</p>
      <label className="card toggle-field">
        <input type="checkbox" checked={s.hideCardAnswer} onChange={(e) => update({ hideCardAnswer: e.target.checked })} />
        カードの正答を最初は隠す
      </label>
      <p className="setting-note">カードをタップすると正答を表示します。設定は次の学習から反映されます。</p>
      </fieldset>
      <section className="card field">
        <button className="btn block" disabled={reloading} onClick={refresh}>{reloading ? '更新中…' : 'アプリを再読み込み'}</button>
        <small>通信できる状態で押してください。アプリのキャッシュをクリアして最新情報を取得します。学習履歴・設定は保持します。</small>
      </section>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
