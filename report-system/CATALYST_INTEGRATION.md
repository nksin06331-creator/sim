# 専用カタリストレポート導入・運用

## 現行サイトへの適合内容

正しい添付資料を次のように現行SiM環境へ合わせました。

- ファイル名は既存銘柄フォルダ内の`catalysts.html`
- シナリオへの戻り先は`TICKER.html`ではなく`scenario.html`
- 企業ガイドへの戻り先は`index.html`
- ポータルへの戻り先は`../../index.html`
- 現在株価だけ`../../data/prices.json`からライブ更新
- 分析値は評価基準日時点で固定
- 第3ページは任意
- `data/catalyst-reports.json`で公開された銘柄だけ第3ボタンを表示

## なぜ公開台帳を分けるか

現在のトップページは、全銘柄を含む日付付きmanifestを使用しています。一方、`meta.json`があるのは一部銘柄だけです。

既存manifestを作り直すと銘柄が欠落する危険があるため、専用カタリストだけを管理する小さな台帳へ分離しました。台帳が読めない場合はボタンを出さず、既存の企業ガイド・株価シナリオを維持します。

## ChatGPTプロジェクトから受け取るもの

```text
TICKER.catalyst.json
```

HTMLはChatGPTで直接修正しません。JSONを正本にするため、日程、1件のカタリスト、出典、固有情報だけを更新できます。

## 非公開プレビュー

```bash
npm run catalyst:validate -- TICKER.catalyst.json
npm run catalyst:preview -- TICKER.catalyst.json
npm run catalyst:verify -- TICKER.catalyst.json
```

出力先：

```text
_report-preview/stocks/TICKER/catalysts.html
```

日本株など既存フォルダ名がティッカーと異なる銘柄は、ポータルの`detailPath`から正しいフォルダを自動判定します。例えばティッカー`5016`の既存フォルダが`stocks/JX金属/`なら、プレビューと公開候補も同じフォルダを使います。

公開中の`stocks/`は変更しません。

## 公開前ステージ

```bash
npm run catalyst:stage -- TICKER.catalyst.json
```

HTML、Validation、互換性検証、draft台帳エントリを`_report-preview/`へまとめます。

## PRで公開候補へ移す

人がプレビューを確認した後だけ、同じPRで次を追加します。

```text
report-system/catalysts/TICKER.json
stocks/既存銘柄フォルダ/catalysts.html
data/catalyst-reports.json
```

公開台帳の1件：

```json
{
  "ticker": "IONQ",
  "path": "stocks/IONQ/catalysts.html",
  "status": "published",
  "reviewedBy": "確認者名",
  "reviewedAt": "2026-07-31"
}
```

`reviewedBy`と`reviewedAt`はAIが代入しません。人が確認後に記録します。

## 公開ゲート

```bash
npm run catalyst:registry
npm run build
```

次のいずれかがあるとビルドを停止します。

- 台帳の重複ティッカー
- ポータルに存在しないティッカー
- 標準外URL
- `catalysts.html`の欠落
- 更新用の正本JSONの欠落またはValidation FAIL
- 正本JSONから再生成したHTMLとの不一致
- 未置換プレースホルダー
- ライブ株価マーカーの欠落
- 人の確認者・確認日の欠落

## 更新

1. 現在の`TICKER.catalyst.json`を正本にする
2. 日程と一次情報を再調査
3. JSONを全面再検証
4. 非公開プレビューを置き換える
5. PRで正本JSONと生成HTMLを同時に更新する
6. ボタンのURLは変えない

## 非表示・削除

緊急時は台帳の`status`を`draft`へ戻します。ポータルのボタンは消えますが、既存2ページと一覧カードは変わりません。

ページ自体の削除は別PRで行います。台帳とHTMLを同時に削除しない場合は、先にボタンを非表示にします。
