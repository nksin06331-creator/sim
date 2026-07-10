# Stock Scenario Lab

現在のStock Scenario Portalを残したまま、ASPIを「1銘柄1JSON」方式へ移した試験エリアです。

## 新しい銘柄の追加

1. `data/stocks/` に `{slug}.json` を追加します。
2. GitHub DesktopでCommit・Pushします。
3. GitHub ActionsがJSONを検証し、`data/manifest.json`を生成して公開します。

`index.html`と`report.html`は銘柄追加時に編集しません。

## ローカル確認

ブラウザで直接HTMLを開くのではなく、リポジトリのルートで簡易サーバーを起動します。

```powershell
py -m http.server 8000
```

その後、`http://localhost:8000/` を開きます。

## 注意

初回のみ、GitHubの `Settings > Pages > Build and deployment > Source` を `GitHub Actions` に設定してください。

現在入っている `ASPI` は既存ページから構成確認用に移植した値です。最新情報へ再調査したデータではありません。
