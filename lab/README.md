# Stock Scenario Lab — ハイブリッド方式

既存の銘柄別HTMLを維持したまま、各銘柄の`meta.json`からポータル一覧を自動生成する試験エリアです。

## 新しい銘柄の追加

次の3ファイルを同じ銘柄フォルダへ入れてPushします。

```text
stocks/TICKER/
├─ index.html
├─ scenario.html
└─ meta.json
```

GitHub Actionsがすべての`meta.json`を検証し、`lab/data/manifest.json`を生成してサイト全体を公開します。ルートの`index.html`や`lab/index.html`を銘柄追加のたびに編集する必要はありません。

## 重要

`meta.json`の`detailPath`と`scenarioPath`は、実際のHTMLの場所と一致させてください。不正なJSON、重複ticker、存在しないHTMLがある場合は公開処理を停止します。
