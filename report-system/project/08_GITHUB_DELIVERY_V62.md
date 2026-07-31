# GitHub公開引き渡し仕様 v6.2

ChatGPTプロジェクトは、JSONだけを追加して作業完了と報告してはいけません。新規作成または全面更新では、同じPRに次の正本を保存します。

```text
report-system/reports/TICKER.report.json
report-system/catalysts/TICKER.catalyst.json
```

通常レポートは`status: review`、カタリストはValidationが`PASS`かつWARN 0件で保存します。確定した大型イベントがない場合もカタリストJSONを省略せず、V6-2の`NO_CONFIRMED_CATALYST`規則を使用します。

GitHubの`Build report publication package`ワークフローが、正本JSONから次を同じPRへ機械生成します。

```text
stocks/TICKER/index.html
stocks/TICKER/TICKER.html
stocks/TICKER/catalysts.html
stocks/TICKER/meta.json
report-system/published/TICKER.report.json
```

3ページのファイル名は変更しません。特に株価シナリオのV6-2正式名は`TICKER.html`です。旧銘柄の`scenario.html`は互換維持のため残しますが、新規銘柄には使用しません。

ワークフローが生成物をPRへ追加し、全テストとサイト全体のビルドが成功した後にだけPRをマージします。ドラフトのまま、または生成物がない状態ではサイトへ公開されません。

## プロジェクトへ設定する短い指示

```text
V6-2に従い、通常レポートJSONと専用カタリストJSONを同じPRへ保存してください。
JSONだけで完了報告をせず、GitHubのBuild report publication packageが3つのHTML、meta.json、公開用正本を追加し、全チェックが成功したことまで確認してください。
確定カタリストがない場合もcatalyst JSONを省略しないでください。
PRはmainへ直接書き込まず、ドラフトで作成してください。
```
