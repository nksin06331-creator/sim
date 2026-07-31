# 出力・更新ルール

## 新規・全面更新

`report.schema.json`形式のJSONを1つ出力します。

```text
TICKER.report.json
```

必須設定：

```json
{
  "schemaVersion": 1,
  "status": "draft",
  "renderMode": "structured",
  "templateVersion": "sim-report-v1"
}
```

## 部分更新

既存の正本JSON全体を再出力しません。変更内容だけをpatchとして出力します。

```json
{
  "schemaVersion": 1,
  "reportId": "BE",
  "baseRevision": "既存JSONのrevision",
  "reason": "Q3決算日程の正式発表",
  "changedFields": [
    "scenario.entryContext.catalysts"
  ],
  "changes": {
    "scenario": {
      "entryContext": {
        "catalysts": []
      }
    }
  }
}
```

`changedFields`にない項目を変更しません。

## 専用カタリストレポート

第3ページを作る銘柄だけ、`catalyst-report.schema.json`形式で次を出力します。

```text
TICKER.catalyst.json
```

- HTMLは出力しない
- 既存の`report.json`を上書きしない
- 既存2ページのURLや内容を変更しない
- 更新時は古い`catalyst.json`を正本として全面再検証する
- 過去になった日程は今後一覧から外す
- 固定項目に入らない重要情報は`extra_sections`へ残す
- 出力だけで一覧ボタンを公開しない

## 全面更新が必要なケース

- 決算発表
- 会社予想変更
- 評価手法変更
- 大型M&A
- 増資、転換社債、株式分割
- 主要カタリストの成功・失敗
- 事業前提が変わるニュース
- 分析基準株価から大幅変動

## price-only

現在株価だけを変更します。

- Bear／Base／Bullは変更しない
- 期待値は変更しない
- 市場逆算は変更しない
- 分析基準日は変更しない
- ライブ株価日時だけを更新

## correction

誤字・誤った出典・転記ミスを修正します。

- 修正理由を残す
- 変更前と変更後を記録
- 計算に影響する場合はfull-refreshへ切り替える

## corporate-action

株式分割、併合、増資、M&Aなどでは、株価だけを機械的に直しません。

必ず次を再確認します。

- 株数
- 1株価値
- EPS
- 転換条件
- 現値ポジショニング
- Bear／Base／Bull
- 過去比較の連続性

## 情報量

- 既存レポートより本文量が20%以上減る場合はFAIL候補
- 出典リンクが25%以上減る場合はFAIL候補
- セクション減少はWARN
- 短くできる場合でも、削除した情報と理由を更新履歴へ記載
- 重要情報が既存の型に入らない場合は`extraSections`へ追加

## 禁止

- HTMLを出力する
- `catalyst.json`なしで専用カタリストだけを部分更新する
- 既存JSONなしで部分更新を推測する
- patchで指定外の項目を変更する
- 一次情報を確認せず決算数値を更新する
- `published`を設定する
- 出典のない重要数値を追加する
