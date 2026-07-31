# V6.2レポート公開ルール

このサイトは、ChatGPT Workプロジェクトが作成した正本JSONをGitHubへ保存し、GitHub側の決定的な処理で3種類のHTMLとサイト一覧情報を生成して公開します。ユーザー管理のAPIキーは使用しません。

## ChatGPT Workプロジェクトが同じPRへ保存するもの

```text
report-system/reports/TICKER.report.json
report-system/catalysts/TICKER.catalyst.json
```

新規作成・全面更新では、確定した大型材料がなくてもカタリストJSONを省略しません。V6-2の`NO_CONFIRMED_CATALYST`、`TBD`、`UNKNOWN`、`定量不能`を使って、確認できた範囲を正直に記録します。

## GitHubが自動生成するもの

```text
stocks/TICKER/index.html       # 企業ガイド
stocks/TICKER/TICKER.html      # 結論・株価シナリオ
stocks/TICKER/catalysts.html   # 専用カタリスト
stocks/TICKER/meta.json        # サイト一覧への登録情報
```

旧銘柄の`scenario.html`は互換用に維持します。V6-2で新しく作る株価レポートの正式名は`TICKER.html`です。

## 公開の流れ

1. ChatGPT Workプロジェクトへ銘柄名またはティッカーを入力する
2. プロジェクトが通常レポートJSONと専用カタリストJSONを同じドラフトPRへ保存する
3. `Build report publication package`が2つのJSONを検証する
4. PASS・WARN 0件なら3つのHTML、`meta.json`、公開用正本を同じPRへ追加する
5. 全テストとサイト全体の生成が成功したことを確認する
6. PRをmainへマージする
7. `Publish SiM site`がGitHub Pagesへ公開する

JSONだけ、ドラフトのまま、カタリストJSONなし、生成HTMLなしの状態は公開完了ではありません。

## プロジェクトへ追加する指示

```text
V6-2に従い、通常レポートJSONと専用カタリストJSONを同じドラフトPRへ保存してください。
JSONだけで完了報告をせず、Build report publication packageが3つのHTML、meta.json、公開用正本を追加し、全チェックが成功したことまで確認してください。
確定カタリストがない場合もcatalyst JSONを省略しないでください。
mainへ直接書き込まないでください。
```
