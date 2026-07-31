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

公開後は`post-publish-health.yml`が公開中の企業ガイド、シナリオ、revisionを確認します。失敗時は、mainが同じ公開コミットのままの場合だけそのコミットをrevertします。別の変更が進んでいる場合は無関係なコミットを戻さず停止します。

## 一度だけ必要なGitHub設定

Repository Settings → Secrets and variables → Actions → New repository secret:

- `OPENAI_API_KEY`: 独立検証専用のOpenAI APIキー
- `SIM_AUTOMATION_TOKEN`: このリポジトリのContentsとPull requestsへ書込み可能なFine-grained PATまたはGitHub App token

Repository variable（任意）:

- `OPENAI_VALIDATION_MODEL`: 省略時は`gpt-5.6-terra`

Settings → Branches → Add branch protection rule（`main`）:

- Require a pull request before merging: ON
- Require status checks to pass before merging: ON
- 必須チェック: `gate`
- Do not allow bypassing the above settings: ON（運用可能な場合）

Secretが未設定、外部fork PR、独立検証がWARN/FAILの場合は検証を省略せず`AUTO_HOLD`になります。
