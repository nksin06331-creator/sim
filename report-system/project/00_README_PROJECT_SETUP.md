# 新しいChatGPTプロジェクトの作成手順

## プロジェクト名

`SiM 銘柄レポート安全運用`

## 推奨する最小構成

新しいChatGPTプロジェクトへ添付するのは次の4ファイルです。

1. `SIM_REPORT_PROJECT_MASTER_V5.md`
2. `report.schema.json`
3. `report-patch.schema.json`
4. `catalyst-report.schema.json`

`01`〜`07`の分割版は、統合ファイルを編集するときの管理用です。統合版と分割版を同時に添付しません。

HTMLテンプレートはChatGPTプロジェクトへ添付しません。HTMLの見た目はGitHub側で一元管理します。

## プロジェクト情報欄へ設定する短い指示

```text
添付されたSIM_REPORT_PROJECT_MASTER_V5.mdを最上位指示として実行してください。
企業ガイドと株価シナリオの正本はreport.jsonです。
専用カタリストレポートの正本は、必要な銘柄だけcatalyst.jsonを作成します。
HTMLは作成しません。
既存レポートの部分更新では、必ずreport-patch.schema.json形式を使用し、
指定されていない項目を削除・変更しないでください。
出力前に統合資料のValidation・安全装置を実行してください。
```

## 通常の使い方

新規作成：

```text
BEのレポートを新規作成してください。
更新モードはfull-refreshです。
```

決算後の全面更新：

```text
添付したBE.report.jsonを基準に、最新決算を反映して全面更新してください。
```

カタリストだけの更新：

```text
添付したBE.catalyst.jsonを基準に、専用カタリストレポートだけ全面更新してください。
過去日程の除外、日程確度、3結果、織り込み度、依存関係、出典を再検証してください。
```

## 重要

- ChatGPTから出力されたJSONは必ずdraft扱いです。
- GitHubへ置くだけでは公開しません。
- プレビュー、Validation、人による確認の後に公開します。
- 現在公開中のHTMLを直接編集しません。
- `catalyst.json`を作っただけでは、一覧ボタンも公開ページも増えません。
