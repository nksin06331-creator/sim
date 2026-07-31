# GitHub導入手順

## 現在の状態

この導入キットは、公開中のHTMLを自動変更しません。新方式の出力先は`_report-preview/`だけです。

## 導入順序

1. 作業ブランチを作成
2. 導入パッチを適用
3. 共通CSSを現行BEページから抽出
4. 現行62銘柄の情報量基準を保存
5. テスト実行
6. BE・HOOD・6857の非破壊検証
7. ドラフトPR
8. 内容確認後も、まだ公開ページは切り替えない

```bash
git switch -c agent/safe-report-operations
git apply sim-report-operations.patch
npm run report:assets
npm run report:baseline
npm run report:test
npm run report:verify -- report-system/reports/BE.json
npm run report:verify -- report-system/reports/HOOD.json
npm run report:verify -- report-system/reports/6857.json
npm run catalyst:registry
```

専用カタリストの導入確認は`CATALYST_INTEGRATION.md`に従います。公開台帳は初期状態で空のため、導入だけでは第3ボタンも公開ページも増えません。

## 初回PRの範囲

初回PRでは次だけを入れます。

- スキーマ
- Validation
- 部分更新
- 非公開プレビュー
- 現行情報量の基準
- 運用資料
- 専用カタリストの非公開生成・検証
- 空の公開台帳と条件付きボタン

既存の`stocks/*`と主要manifestは変更しません。トップページの変更は、空の専用台帳を安全に読む条件付き機能だけです。

## 既存銘柄の移行

既存62銘柄は一括変換しません。

1. 次回更新する銘柄を選ぶ
2. 現行HTMLを基準にstructured JSONを作成
3. `_report-preview/`へ生成
4. 本文量、出典、セクション、計算を比較
5. 人が見た目を確認
6. 当該銘柄だけ公開HTMLを切り替える

## 公開用コマンドについて

このキットには公開ディレクトリへ直接書くコマンドを用意していません。移行手順が安定し、人による承認フローが確定してから別PRで追加します。

## 元に戻す

初回PRは公開ページへ触れないため、PRを閉じるか変更を戻すだけで現行サイトへ影響しません。
