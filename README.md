# Stock Scenario Portal

GitHub Pages用のシナリオ試算ポータルです。現在は、銘柄ごとの既存HTMLを維持しながら `meta.json` で一覧を自動生成する新方式で運用します。

## 運用

- トップページ `index.html` は基本的に固定
- ChatGPTで作ったHTMLを追加する場合は `npm run add -- TICKER "会社名" 企業詳細.html シナリオ.html`
- 白紙の雛形から作る場合は `npm run new -- TICKER "会社名"`
- 一覧データは `scripts/build-pages.mjs` が `stocks/*/meta.json` から自動生成
- `data/scenarios.json` は旧方式の参照用。新規運用では基本的に編集しない

```text
stocks/TICKER/
├─ index.html
├─ scenario.html
└─ meta.json
```

## 作業手順

```bash
cd /Users/nakayamatoshinobu/Documents/GitHub/sim
npm run add -- NVDA "NVIDIA Corporation" ~/Downloads/nvda-detail.html ~/Downloads/nvda-scenario.html
npm run build
npm run serve
```

ブラウザでは `http://127.0.0.1:8000/` を確認します。

作成直後の新銘柄は `status: "draft"` なのでトップページには出ません。公開するときは `meta.json` の数値や説明を整えてから `status` を `"published"` に変更します。

詳しい手順は `ADDING_STOCKS.md` を確認します。

## 重要指標

このポータルはAI Scoreではなく、Bear/Base/Bullの現値ポジショニングを中心に表示します。
