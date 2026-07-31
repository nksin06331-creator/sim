# 銘柄追加のいちばん簡単な流れ

ChatGPT内の2つのプロジェクトでHTMLを作成したら、このサイト側では完成HTMLを取り込むだけです。

## 1. ChatGPT側で作るもの

- 企業詳細HTML
- 強気・中立・弱気のシナリオ分析HTML
- 専用カタリストHTML（作る銘柄だけ）

ファイル名は自由です。例:

```text
nvda-detail.html
nvda-scenario.html
```

## 2. このサイトに取り込む

```bash
cd /Users/nakayamatoshinobu/Documents/GitHub/sim
npm run add -- NVDA "NVIDIA Corporation" ~/Downloads/nvda-detail.html ~/Downloads/nvda-scenario.html
```

日本株の場合:

```bash
npm run add -- 7203 "トヨタ自動車" ~/Downloads/toyota-detail.html ~/Downloads/toyota-scenario.html --market 日本株 --currency JPY
```

このコマンドで次の形に自動配置されます。

```text
stocks/NVDA/
├─ index.html
├─ scenario.html
├─ catalysts.html  # 任意
└─ meta.json
```

## 3. meta.jsonだけ整える

作成直後は `status` が `draft` なので、トップページには出ません。

公開前に次を埋めます。

- `price.current`
- `scenarios.bear`
- `scenarios.base`
- `scenarios.bull`
- `positionPct`
- `zone`
- `riskReward`
- `catalyst`
- `summary`
- `tags`
- `risk`

公開するときだけ、最後にこうします。

```json
"status": "published"
```

## 4. 確認する

```bash
npm run build
npm run serve
```

ブラウザで確認します。

```text
http://127.0.0.1:8000/
```

## 覚えること

トップページは直接編集しません。

銘柄追加で触るのは、基本的に `stocks/銘柄/meta.json` だけです。

専用カタリストを追加するときは、先に`npm run catalyst:verify -- TICKER.catalyst.json`を実行します。人の確認後、`report-system/catalysts/TICKER.json`、既存銘柄フォルダの`catalysts.html`、`data/catalyst-reports.json`を同じPRで更新します。日本株などフォルダ名とティッカーが異なる場合は、既存の`detailPath`を基準にします。台帳だけ、HTMLだけ、正本JSONだけを先に公開しません。
