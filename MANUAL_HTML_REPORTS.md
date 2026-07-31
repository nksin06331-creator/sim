# HTMLレポート公開ルール

このサイトでは、ChatGPT Workの各プロジェクトが作成したHTMLをそのまま公開します。APIキー、GitHub Models、自動レポート生成は使用しません。

## 1銘柄のファイル構成

```text
stocks/銘柄フォルダー/
  index.html       # 銘柄・企業レポート
  scenario.html    # 株価レポート
  catalysts.html   # カタリストレポート
  meta.json        # サイト一覧への登録情報
```

既存銘柄を更新するときは、同じフォルダーの該当HTMLだけを置き換えます。他の2レポートを作り直す必要はありません。

## ChatGPT Workプロジェクトへの依頼文

各プロジェクトをGitHubリポジトリ `nksin06331-creator/sim` に接続し、次のように依頼します。

```text
作成したHTMLを、対象銘柄のフォルダーへ追加または更新してください。
銘柄レポートは index.html、株価レポートは scenario.html、
カタリストレポートは catalysts.html というファイル名にしてください。
既存の別レポートは変更しないでください。
変更はmainへ直接書かず、PRを作成してください。
```

## meta.json

新しい銘柄では`meta.json`も作成します。既存銘柄では必要な項目だけ更新します。カタリストHTMLを掲載するときは次を追加します。

```json
{
  "detailPath": "stocks/NVDA/index.html",
  "scenarioPath": "stocks/NVDA/scenario.html",
  "catalystPath": "stocks/NVDA/catalysts.html"
}
```

実際の`meta.json`には、既存と同じくticker、銘柄名、市場、株価、Bear/Base/Bullなどの項目も必要です。

## 公開の流れ

1. ChatGPT WorkのプロジェクトがHTMLを作成する
2. GitHub連携で対象フォルダーへ追加し、PRを作成する
3. 内容を確認してPRをmainへマージする
4. GitHub Pagesが自動更新される

サイトは`meta.json`から一覧を作り、存在するレポートへのボタンを表示します。3つのHTMLが揃えば3つのボタンが表示されます。
