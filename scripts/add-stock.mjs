import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`使い方:
  npm run add -- TICKER "会社名" 企業詳細.html シナリオ.html

例:
  npm run add -- NVDA "NVIDIA Corporation" ~/Downloads/nvda-detail.html ~/Downloads/nvda-scenario.html
  npm run add -- 7203 "トヨタ自動車" ~/Downloads/toyota-detail.html ~/Downloads/toyota-scenario.html --market 日本株 --currency JPY

主なオプション:
  --folder FOLDER       保存先フォルダ名。省略時はTICKER
  --market 市場         省略時は米国株
  --sector セクター     省略時は未分類
  --method 評価手法     省略時は要設定
  --currency 通貨       省略時は米国株ならUSD、日本株ならJPY
  --publish             meta.jsonを最初からpublishedにする。省略時はdraft
`);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}
if (args.length < 4) {
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

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function expandHome(path) {
  if (path === "~") return process.env.HOME;
  if (path.startsWith("~/")) return join(process.env.HOME, path.slice(2));
  return path;
}

function stripOptionArgs(values) {
  const result = [];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value.startsWith("--")) {
      if (value.includes("=")) continue;
      if (values[i + 1] && !values[i + 1].startsWith("--")) i += 1;
      continue;
    }
    result.push(value);
  }
  return result;
}

const positional = stripOptionArgs(args);
const [tickerInput, name, detailInput, scenarioInput] = positional;
const ticker = tickerInput.trim().toUpperCase();
const market = option("--market", "米国株");
const currency = option("--currency", market === "日本株" ? "JPY" : "USD");
const sector = option("--sector", "未分類");
const method = option("--method", "要設定");
const folder = option("--folder", ticker);
const status = args.includes("--publish") ? "published" : "draft";
const today = new Date().toISOString().slice(0, 10);
const slug = ticker.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-|-$/g, "");
const detailSource = resolve(expandHome(detailInput));
const scenarioSource = resolve(expandHome(scenarioInput));
const stockDir = join(root, "stocks", folder);

if (!(await exists(detailSource))) throw new Error(`企業詳細HTMLが見つかりません: ${detailSource}`);
if (!(await exists(scenarioSource))) throw new Error(`シナリオHTMLが見つかりません: ${scenarioSource}`);
if ((await exists(stockDir))) throw new Error(`stocks/${folder} はすでに存在します。上書きしません。`);

const detailContent = await readFile(detailSource, "utf8");
const scenarioContent = await readFile(scenarioSource, "utf8");
if (!detailContent.includes("<html") && !detailContent.includes("<!doctype")) {
  throw new Error(`${basename(detailSource)} はHTMLファイルに見えません。`);
}
if (!scenarioContent.includes("<html") && !scenarioContent.includes("<!doctype")) {
  throw new Error(`${basename(scenarioSource)} はHTMLファイルに見えません。`);
}

await mkdir(stockDir, { recursive: true });
await copyFile(detailSource, join(stockDir, "index.html"));
await copyFile(scenarioSource, join(stockDir, "scenario.html"));

const meta = {
  schemaVersion: 1,
  ticker,
  slug,
  name,
  market,
  sector,
  method,
  status,
  updated: today,
  price: { current: 0, currency },
  scenarios: { bear: 0, base: 0, bull: 0 },
  positionPct: 0,
  zone: "要設定",
  riskReward: "要設定",
  catalyst: "要設定",
  summary: "ここにトップページカード用の要約を1文で書きます。",
  tags: [method, sector].filter((value) => value && value !== "要設定" && value !== "未分類"),
  risk: "要設定",
  detailPath: `stocks/${folder}/index.html`,
  scenarioPath: `stocks/${folder}/scenario.html`
};

await writeFile(join(stockDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");

console.log(`stocks/${folder}/ にHTML 2枚とmeta.jsonを追加しました。`);
console.log(`次に stocks/${folder}/meta.json を編集し、公開時は status を "published" にしてください。`);
