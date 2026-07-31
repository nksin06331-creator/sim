# V6 無人自動公開

## 候補の受入

ChatGPTプロジェクトは、同一リポジトリの専用ブランチへ1銘柄ずつ次を保存し、`main`向けPRを作成します。

```text
report-system/reports/TICKER.report.json
report-system/reports/TICKER.catalyst.json  # 必要な場合だけ
```

新規・全面更新の候補statusは`draft`または`review`です。旧`TICKER.json`は読取り互換だけで、新規候補には使用しません。HTML、manifest、公開台帳、監査JSONは候補作成者が編集しません。

## 自動処理

`report-auto-publish.yml`が1PR・1銘柄で排他実行し、添付V6 Schema、決定的再計算、既存情報量、独立AI検証、HTML生成、既存テスト、Pagesビルドを確認します。FAIL・WARN・例外承認・重要未確認事項が1件でもあれば`AUTO_HOLD`です。

全条件がPASSの場合だけGitHub Actionsが候補を`published`へ昇格し、HTML・meta・manifest・カタリスト台帳・監査記録を同じPRへコミットしてマージします。`main`への候補JSON直書きは使用しません。

公開後は同じ`report-auto-publish.yml`内のヘルスチェックが、公開中の企業ガイド、シナリオ、revisionを確認します。失敗時は、mainが同じ公開コミットのままの場合だけそのコミットをrevertします。別の変更が進んでいる場合は無関係なコミットを戻さず停止します。

## 鍵なし構成

利用者が作成・保存するAPIキーやPersonal Access Tokenはありません。

- 独立AI検証: GitHub Models
- GitHub認証: Actionsが実行ごとに自動発行する`GITHUB_TOKEN`
- AI権限: `models: read`
- 生成・マージ権限: `contents: write`、`pull-requests: write`
- Pages公開: 同じWorkflowのPages deployment job
- 異常時: 同じ公開merge SHAだけをrevertし、`workflow_dispatch`で復旧デプロイ

Repository variable（任意）:

- `GITHUB_VALIDATION_MODEL`: 省略時は`openai/gpt-4.1`

GitHub Modelsが利用できない、外部fork PR、独立検証がWARN/FAILの場合は検証を省略せず`AUTO_HOLD`になります。`GITHUB_TOKEN`によるpushは別のpush WorkflowやPagesビルドを起動しないため、候補の生成・マージ・Pages公開・ヘルスチェックは同じWorkflow内で完結させています。
