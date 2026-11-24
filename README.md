# 情報I 一問一答

共通テスト「情報I」の問題文から解答・解説を覚える、iPhone 向け PWA です。カードのタップ・スワイプ、定着度別の復習、章ごとのランク、目標・連続日数・学習記録グラフを備えています。学習履歴と設定は端末の IndexedDB（`joho-app`）に保存します。

## 開発

```sh
npm install
npm run dev
npm test
npm run build
npx playwright install chromium
npx playwright test
```

E2E は Chromium の iPhone 13 相当の画面で実行します。スクリーンショットは `e2e-results/` に出力します。一度オンラインで読み込むと、サービスワーカーがアプリを保存しオフラインでも学習できます。iPhone の Safari で「共有 → ホーム画面に追加」からインストールできます。

## コンテンツ

`content/` と `photos/` は著作物のため git 管理外です。入力画像や raw は生成スクリプトから変更しません。

```json
{
  "image": "IMG_7407",
  "chapter": 1,
  "chapterTitle": "コンピュータ",
  "entries": [
    { "no": 1, "question": "1 バイトは何ビット？", "answer": "8 ビット", "explanation": null }
  ]
}
```

`content/raw/*.json` を用意し `npm run content` を実行すると、`content/build/deck.json` と検証結果 `content/report.md` を生成します。画像番号順に読み、同じ章・問題番号は後のページの空でないフィールドで補完します。章番号・問題番号順に整列し、ID は `joho-1-1`、章 ID は `joho-ch1` の形式です。章内の番号の抜け・重複・空欄を報告し、空の問題文・解答や不正な番号があるとエラーで停止します。末尾に未収録の問題があるかどうかは、raw のみからは判定できません。

`content/build/deck.json` がなければ、2章・12問の `sample/deck.json` を利用します。サンプルは `node scripts/make-sample.mjs` で再生成できます。共同作業中に `content/` に書き込みたくない場合は別の出力先を指定できます。

```powershell
npm run content -- --output-dir node_modules/.cache/joho-content
$env:JOHO_DECK_PATH = 'node_modules/.cache/joho-content/build/deck.json'
npm run build
npx playwright test
Remove-Item Env:JOHO_DECK_PATH
```

必要な訂正は `scripts/content-corrections.json` に `[{ "id": "joho-1-1", "changes": { "answer": "8 ビット" } }]` のように指定します。変更できるのは `question`・`answer`・`explanation` です。存在しない ID や不正なフィールドはエラーになります。

選択肢つきの問題は、元の選択肢も問題文の一部としてカードの表に表示します。誤答選択肢は生成しません。

`2^8`・`2^{n−1}` は上付き、`X_n`・`X_{n+1}` は下付きで表示します。1文字形式は英数字のみです。改行は保持し、文字列を HTML として解釈しません。

## 学習とデザイン

定着度は未学習・苦手・うろ覚え・ほぼ覚えた・覚えたの5種類です。カードの解答・解説は既定で隠れ、タップで表示します。右スワイプは「わかった」、左スワイプは「わからなかった」で次のカードへ進みます。ボタンでも仕分けできます。ランクアップテストは章からランダムに最大10枚を出し、自己申告の「わかった」が8割以上で合格です。

`/study/:id?shuffle=1` でシャッフル、`n=20` でシャッフル後の先頭20枚に制限できます。全体のランダム出題は `?shuffle=1&n=20`。`?rankup=1` はランクアップテストです。旧 `/quiz/:id` はクエリを保持してカードへ転送します。

Leitner の復習間隔は段階0〜3で即時・1日・3日・7日。「わかった」で1段階進み、「わからなかった」で苦手に戻ります。コピー元の学習の仕組みを維持しています。

白と青のカード画面、赤い苦手表示、等幅の数値を使用します。設定で目標・カード解答の初期表示を変更できます。「アプリを再読み込み」は学習履歴を保持してキャッシュを更新します。

`public/icon.svg` と `scripts/make-icons.mjs` は青い回路チップのアイコンです。`npm run icons` で PNG を再生成します。

## tailnet 内への配信

```powershell
npm run build
node scripts/serve-dist.mjs 8095
tailscale serve --bg --https=8446 http://127.0.0.1:8095
```

ログオン時にタスク スケジューラの `joho-app-serve` が `serve-dist.mjs 8095` を起動します。配信先: `https://rumia675.taile72ab8.ts.net:8446/`（tailnet 内のみ）
