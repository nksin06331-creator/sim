# SiM Report Operations

このディレクトリは、銘柄レポートの内容と表示を分離し、安全に追加・更新するための非破壊運用キットです。

## 基本方針

- 現在公開中の `stocks/*/index.html` と `stocks/*/scenario.html` は自動的に変更しません。
- JSONを唯一の編集対象にし、HTML・一覧manifestは生成物として扱います。
- 既存URL、ライブ株価、現在の見た目、情報量を維持します。
- 既存銘柄は一括変換せず、更新時に1銘柄ずつ移行します。
- 新方式の出力先は既定で `_report-preview/` です。公開ディレクトリへ直接書きません。

## 2つのモード

### legacy-preserve

現在のHTMLをそのままプレビューへコピーします。バイト単位の一致を検証できるため、移行前の安全な基準として使用します。

### structured

`report.json`の構造化データから企業ガイドと株価シナリオを生成します。新規銘柄と移行済み銘柄で使用します。

### optional catalyst

専用カタリストは`TICKER.catalyst.json`から`catalysts.html`を非公開生成します。第3ページは任意で、公開台帳へ人の確認済みエントリがある銘柄だけ一覧ボタンを表示します。

## コマンド

```bash
npm run report:assets
npm run report:baseline
npm run report:validate -- report-system/reports/BE.json
npm run report:preview -- report-system/reports/BE.json
npm run report:verify -- report-system/reports/BE.json
npm run catalyst:validate -- TICKER.catalyst.json
npm run catalyst:preview -- TICKER.catalyst.json
npm run catalyst:verify -- TICKER.catalyst.json
npm run catalyst:stage -- TICKER.catalyst.json
npm run catalyst:registry
```

部分更新は、正本JSONとpatchファイルを指定します。

```bash
npm run report:patch -- \
  report-system/reports/BE.json \
  report-system/examples/patch.example.json \
  --output /tmp/BE.updated.json
```

## 公開条件

次をすべて満たすまで `status: "published"` にできません。

1. JSON構造検証がPASS
2. 計算検証がPASS
3. 市場別必須情報がPASS
4. 出典・基準日検証がPASS
5. 既存レポートとの情報量比較がPASS
6. HTML安全性検証がPASS
7. 人によるプレビュー確認が完了
8. 専用カタリストは公開台帳に確認者と確認日がある

## 直接編集禁止

生成済みHTMLは修正しません。修正は必ず正本JSONへ戻します。既存のlegacyページは移行完了まで従来どおり残します。
