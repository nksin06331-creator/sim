import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`使い方:
  npm run new -- TICKER "会社名"

例:
  npm run new -- NVDA "NVIDIA Corporation"
  npm run new -- 7203 "トヨタ自動車" --market 日本株 --currency JPY

作成後:
  1. stocks/TICKER/meta.json の数値と説明を編集
  2. stocks/TICKER/index.html を編集
  3. stocks/TICKER/scenario.html を編集
  4. 公開するときは meta.json の status を "published" に変更
  5. npm run build
`);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}
if (args.length < 2) {
  usage();
  process.exit(1);
}

function option(name, fallback) {
  const eq = args.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1];
  return fallback;
}

const ticker = args[0].trim().toUpperCase();
const name = args[1].trim();
const folder = option("--folder", ticker);
const market = option("--market", "米国株");
const sector = option("--sector", "未分類");
const method = option("--method", "要設定");
const currency = option("--currency", market === "日本株" ? "JPY" : "USD");
const today = new Date().toISOString().slice(0, 10);
const slug = ticker.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-|-$/g, "");
const stockDir = join(root, "stocks", folder);

if (!ticker || !name) {
  usage();
  process.exit(1);
}

try {
  await access(stockDir);
  throw new Error(`stocks/${folder} はすでに存在します。別のティッカーか --folder を指定してください。`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

await mkdir(stockDir, { recursive: true });

const meta = {
  schemaVersion: 1,
  ticker,
  slug,
  name,
  market,
  sector,
  method,
  status: "draft",
  updated: today,
  price: { current: 0, currency },
  scenarios: { bear: 0, base: 0, bull: 0 },
  positionPct: 0,
  zone: "要設定",
  riskReward: "要設定",
  catalyst: "要設定",
  summary: "ここにトップページカード用の要約を1文で書きます。",
  tags: [method, sector],
  risk: "要設定",
  detailPath: `stocks/${folder}/index.html`,
  scenarioPath: `stocks/${folder}/scenario.html`
};

const detailHtml = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${ticker} 企業詳細</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;line-height:1.8;margin:0;color:#111827;background:#f9fafb}
    main{max-width:880px;margin:auto;padding:56px 20px}
    a{color:#2563eb}
    section{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin:18px 0}
  </style>
</head>
<body>
<main>
  <p><a href="../../index.html">ポータルへ戻る</a></p>
  <h1>${name}（${ticker}）企業詳細</h1>
  <section>
    <h2>会社概要</h2>
    <p>ここに事業内容、強み、競合、注目ポイントを書きます。</p>
  </section>
  <section>
    <h2>株価を見るポイント</h2>
    <p>ここに決算、カタリスト、リスク、見るべき指標を書きます。</p>
  </section>
</main>
</body>
</html>
`;

const scenarioHtml = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${ticker} 株価シナリオ試算</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;line-height:1.8;margin:0;color:#111827;background:#f9fafb}
    main{max-width:880px;margin:auto;padding:56px 20px}
    a{color:#2563eb}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}
  </style>
</head>
<body>
<main>
  <p><a href="../../index.html">ポータルへ戻る</a></p>
  <h1>${name}（${ticker}）株価シナリオ試算</h1>
  <div class="grid">
    <div class="card"><h2>Bear</h2><p>弱気シナリオを書きます。</p></div>
    <div class="card"><h2>Base</h2><p>標準シナリオを書きます。</p></div>
    <div class="card"><h2>Bull</h2><p>強気シナリオを書きます。</p></div>
  </div>
</main>
</body>
</html>
`;

await writeFile(join(stockDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
await writeFile(join(stockDir, "index.html"), detailHtml, "utf8");
await writeFile(join(stockDir, "scenario.html"), scenarioHtml, "utf8");

console.log(`stocks/${folder}/ を作成しました。meta.json を編集し、公開時は status を "published" にしてください。`);
