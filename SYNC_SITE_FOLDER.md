# デスクトップの「サイト用フォルダ」から公開サイトへ反映する運用

このリポジトリは GitHub Pages の公開元です。

公開サイト:

```text
https://nksin06331-creator.github.io/sim/
```

## 基本ルール

デスクトップの入力元:

```text
/Users/nakayamatoshinobu/Desktop/サイト用フォルダ
```

公開サイト側の配置先:

```text
stocks/銘柄/index.html
stocks/銘柄/scenario.html
stocks/銘柄/meta.json
```

トップページの銘柄一覧は、各 `meta.json` から `npm run build` で自動生成します。
トップページや `data/manifest.json` は手で編集しません。

## 対応ルール

通常の銘柄フォルダ:

```text
サイト用フォルダ/IONQ/index.html  -> stocks/IONQ/index.html
サイト用フォルダ/IONQ/IONQ.html   -> stocks/IONQ/scenario.html
```

例外:

```text
サイト用フォルダ/285A キオクシア/ -> stocks/キオクシア/
サイト用フォルダ/アスタリスク/    -> stocks/アスタリスク/
```

`scenario.html` がある場合はそれを優先します。
なければ `IONQ.html` のようなティッカー名HTMLを `scenario.html` として取り込みます。

## 確認だけ行う

```bash
npm run sync:check
```

この段階ではファイルを書き換えません。
どの銘柄が追加・更新されるかだけ確認します。

## 実際に反映する

```bash
npm run sync:site-folder
npm run build
```

`sync:site-folder` は `stocks/` 配下のHTMLと `meta.json` を更新します。
`build` は `data/manifest.json` と `lab/data/manifest.json` を再生成します。

## 公開する

内容を確認してから、通常のGit操作で反映します。

```bash
git status
git add stocks data lab/data
git commit -m "Update stock pages from site folder"
git push
```

数分後に GitHub Pages へ反映されます。

## Codexに頼む時の文例

```text
デスクトップの「サイト用フォルダ」の内容を sim に反映してください。
まず npm run sync:check で確認し、問題なければ npm run sync:site-folder と npm run build を実行してください。
最後に差分を確認してください。GitHubへpushする前に私に確認してください。
```
