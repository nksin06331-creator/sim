# Catalyst source data

専用カタリストレポートを公開する銘柄は、更新用の正本JSONをこのディレクトリへ保存します。

```text
report-system/catalysts/TICKER.json
```

- HTMLを直接編集しない
- 更新はこのJSONへ戻す
- `catalyst:validate`、`catalyst:verify`を実行する
- 生成HTMLと正本JSONを同じPRで更新する
- 未公開プレビューだけなら、このディレクトリへ保存する必要はない

現在は専用カタリストレポートを公開していないため、銘柄JSONはありません。
