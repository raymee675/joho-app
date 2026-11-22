# 古文・漢文 単語帳

iPhone のホーム画面に追加して使う PWA（Vite + React + TypeScript）。進捗は端末の IndexedDB に保存されます。

## 開発

```
npm install
npm run dev        # 開発サーバー
npm test           # vitest
npm run build      # 型チェック + 本番ビルド
npx playwright install chromium
npx playwright test   # iPhone 13 エミュレーションの E2E（スクリーンショットは e2e-results/）
```

## コンテンツ

- `content/` と `photos/` は git 管理外（著作物のため）。
- `content/raw/*.json` に OCR 済みデータを置き、`npm run content` で `content/build/deck.json` を生成します。
- 教材の訂正は追跡対象の `scripts/content-corrections.json` に記録し、生成時に適用します。ID と元の見出し語が一致しない場合は生成を停止します。監査結果は `docs/kobun-content-audit-2026-11-11.md` を参照してください。
- `content/build/deck.json` があればそれを、なければ `sample/deck.json`（サンプル）をアプリに取り込みます（`@deck` エイリアス）。
- raw の形式: `{ image, page, kind, section, entries: [{ no, word, kanji, reading, senses:[{label, meanings[]}], notes[] }] }`
  - `kind`: `kobun-word` → 古文 / `kanbun-word`, `kanbun-kuhou` → 漢文 / `other` → 除外
  - 章は `content/groups.json` の「意味の近い語のグループ」ごと（品詞では分けない）。形式: `{ kobun: [{ section, title, items: [no | 'w-語' | '字-1'] }], kanbun: [...] }`
    - 同じ語を複数のグループに入れてよい。どのグループにも入らない語や存在しない ID があると `npm run content` がエラーで止まる（出題漏れ防止）
    - 1 グループが 50 語を超えたときだけ番号つきで均等に分ける。`groups.json` が無ければ並び順に 20 語ずつ
  - ID は `deck-no`（`no` が無ければ `deck-w-語`）。重複は先勝ち。

## 復習間隔（Leitner）

箱 0〜5 = 即時, 1, 2, 4, 7, 15 日。正解で +1、不正解で 0 に戻ります。

## アイコン

`npm run icons` で `public/` の PNG を再生成します。

## tailnet 内への配信

```powershell
npm run build
node scripts/serve-dist.mjs 8094   # 127.0.0.1 だけで待ち受け
tailscale serve --bg --https=8445 http://127.0.0.1:8094
```
