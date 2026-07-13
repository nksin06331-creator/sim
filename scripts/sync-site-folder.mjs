import { access, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = join(process.env.HOME, "Desktop", "サイト用フォルダ");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const publishNew = !args.includes("--draft-new");

function option(name, fallback) {
  const eq = args.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1];
  return fallback;
}

const sourceRoot = resolve(option("--source", defaultSource));
const skipFolders = new Set(["銘柄以外のデータ"]);

const folderRules = new Map([
  ["285A キオクシア", { target: "キオクシア", ticker: "285A", name: "キオクシアホールディングス" }],
  ["アスタリスク", { target: "アスタリスク", ticker: "6522", name: "株式会社アスタリスク" }],
]);

const sectors = {
  ABCL: "抗体創薬・バイオテクノロジー",
  IBM: "エンタープライズIT・ソフトウェア",
  IONQ: "量子コンピューター",
  IOT: "Connected Operations / IoTソフトウェア",
  MU: "半導体・メモリ",
  NVDA: "AI半導体・アクセラレーテッドコンピューティング",
  QNT: "量子コンピューター",
  RDW: "宇宙・防衛",
  RKLB: "宇宙・防衛",
  SPCX: "宇宙・衛星通信・AI",
  TSLA: "EV・エネルギー・AI/自動運転",
  "285A": "半導体・メモリ",
  "6522": "モバイルDX・業務端末",
};

const names = {
  ABCL: "AbCellera Biologics",
  IBM: "IBM",
  IONQ: "IonQ, Inc.",
  IOT: "Samsara",
  MU: "Micron Technology",
  NVDA: "NVIDIA",
  QNT: "Quantinuum",
  RDW: "Redwire Corporation",
  RKLB: "Rocket Lab",
  SPCX: "SpaceX",
  TSLA: "Tesla, Inc.",
  "285A": "キオクシアホールディングス",
  "6522": "株式会社アスタリスク",
};

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimTrailingWhitespace(content) {
  return content.replace(/[ \t]+$/gm, "");
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function textBetween(html, regex) {
  const match = html.match(regex);
  return match ? decodeEntities(stripTags(match[1])) : "";
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function parseMoney(value) {
  if (!value) return null;
  const normalized = value.replace(/,/g, "").replace(/[＋+−–—]/g, (char) => (char === "−" || char === "–" || char === "—" ? "-" : "+"));
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseDate(text) {
  const evalDate = text.match(/評価基準日[：:\s｜|]*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (evalDate) return `${evalDate[1]}-${evalDate[2].padStart(2, "0")}-${evalDate[3].padStart(2, "0")}`;
  const evalIso = text.match(/評価基準日[：:\s｜|]*(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (evalIso) return `${evalIso[1]}-${evalIso[2].padStart(2, "0")}-${evalIso[3].padStart(2, "0")}`;
  const iso = text.match(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/);
  if (iso) {
    const [y, m, d] = iso[0].split(/[-/]/).map((part) => part.padStart(2, "0"));
    return `${y}-${m}-${d}`;
  }
  const jp = text.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (jp) return `${jp[1]}-${jp[2].padStart(2, "0")}-${jp[3].padStart(2, "0")}`;
  return "";
}

function slugFor(ticker) {
  return ticker.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-|-$/g, "");
}

function marketFromText(text, ticker) {
  if (/東証|日本株/.test(text) || /^[0-9]{4}[A-Z]?$/.test(ticker)) return "日本株";
  return "米国株";
}

function currencyFor(market) {
  return market === "日本株" ? "JPY" : "USD";
}

function riskFromText(text) {
  const raw = firstMatch(text, [
    /リスク区分<\/span>\s*<b>([^<]+)/,
    /リスク区分[：:]\s*([^<\n。]+)/,
  ]);
  if (!raw) return "要確認";
  return raw.replace(/VERY HIGH/i, "非常に高い").replace(/MEDIUM/i, "中").replace(/HIGH/i, "高").trim();
}

function cleanShort(value, fallback, maxLength = 120) {
  const cleaned = (value || "").replace(/\s+/g, " ").trim();
  const fallbackCleaned = (fallback || "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > maxLength) {
    return fallbackCleaned && fallbackCleaned.length <= maxLength ? fallbackCleaned : "要確認";
  }
  return cleaned;
}

function scenarioValues(text) {
  const compact = text.replace(/\s+/g, " ");
  const values = {};
  for (const key of ["bear", "base", "bull"]) {
    const article = text.match(new RegExp(`<article[^>]*class=["'][^"']*scenario[^"']*${key}[^"']*["'][^>]*>([\\s\\S]*?)<\\/article>`, "i"));
    const div = text.match(new RegExp(`<div[^>]*class=["'][^"']*scenario[^"']*${key}[^"']*["'][^>]*>([\\s\\S]{0,500})`, "i"));
    const block = article?.[1] || div?.[1] || "";
    const price = firstMatch(block, [
      /class=["'][^"']*scenario-price[^"']*["'][^>]*>\s*([^<]+)/i,
      /class=["'][^"']*price[^"']*["'][^>]*>\s*([^<]+)/i,
      /class=["'][^"']*big[^"']*["'][^>]*>\s*([^<]+)/i,
      /<h3[^>]*>\s*([^<]+)/i,
    ]);
    if (price) values[key] = parseMoney(price);
  }
  if (values.bear && values.base && values.bull) {
    return { bear: values.bear, base: values.base, bull: values.bull };
  }
  const slash = compact.match(/Bear\s*[\/／]\s*Base\s*[\/／]\s*Bull[^$0-9円]*([$]?\d[\d,.]*円?)\s*[\/／]\s*([$]?\d[\d,.]*円?)\s*[\/／]\s*([$]?\d[\d,.]*円?)/i);
  if (slash) return { bear: parseMoney(slash[1]), base: parseMoney(slash[2]), bull: parseMoney(slash[3]) };
  if (!values.bear && !values.base && !values.bull) {
    for (const [key, label] of [["bear", "Bear"], ["base", "Base"], ["bull", "Bull"]]) {
      const re = new RegExp(`${label}[\\s\\S]{0,260}?(?:理論株価|表示株価|計算株価)[^$0-9円]*([$]?[0-9][\\d,.]*円?)`, "i");
      const match = text.match(re);
      if (match) values[key] = parseMoney(match[1]);
    }
  }
  return {
    bear: Number.isFinite(values.bear) ? values.bear : 0,
    base: Number.isFinite(values.base) ? values.base : 0,
    bull: Number.isFinite(values.bull) ? values.bull : 0,
  };
}

function extractMeta({ ticker, target, detailHtml, scenarioHtml, existing }) {
  const both = `${detailHtml}\n${scenarioHtml}`;
  const plain = stripTags(both);
  const title = textBetween(detailHtml, /<title[^>]*>([\s\S]*?)<\/title>/i) || textBetween(scenarioHtml, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const sub = textBetween(scenarioHtml, /<div class="sub"[^>]*>([\s\S]*?)<\/div>/i) || textBetween(scenarioHtml, /<p class="sub"[^>]*>([\s\S]*?)<\/p>/i) || plain;
  const market = marketFromText(sub, ticker);
  const method = firstMatch(sub, [/使用手法\s*([^｜|。]+)/, /主手法[：:]\s*([^｜|。]+)/]) || existing?.method || "要確認";
  const currentPrice = parseMoney(firstMatch(scenarioHtml, [
    /現在株価<\/span>\s*<b>([^<]+)/,
    /現在株価<\/small>\s*<b>([^<]+)/,
    /現在株価<\/div>\s*<div class="price">([^<]+)/,
    /現値\s*([$¥円0-9,.]+)/,
  ])) ?? existing?.price?.current ?? 0;
  const scenarios = scenarioValues(scenarioHtml);
  const updated = parseDate(scenarioHtml) || parseDate(sub) || parseDate(plain) || existing?.updated || new Date().toISOString().slice(0, 10);
  const positionPct = parseMoney(firstMatch(plain, [/帯内位置[：:]\s*([0-9.]+)%/, /Bear.?Bull帯の\s*([0-9.]+)%/])) ?? existing?.positionPct ?? 0;
  const zone = firstMatch(plain, [/判定は\s*([^。]+?)(?:。|$)/, /現在評価[：:]\s*([^。]+?)(?:。|$)/]) || existing?.zone || "要確認";
  const riskReward = firstMatch(plain, [/端点リスクリワード[：:]\s*([0-9.x倍]+)/, /上値下値比[：:]\s*([0-9.x倍]+)/]) || existing?.riskReward || "要確認";
  const catalystRaw = firstMatch(stripTags(scenarioHtml), [/次の主要カタリスト[：:]\s*([^。]+)/, /次に見るべき項目\s*([^。]+)/]);
  const catalyst = cleanShort(catalystRaw, existing?.catalyst || "要確認", 140);
  const summaryRaw = firstMatch(plain, [/5秒で結論\s*([^。]+。)/, /まず結論だけ\s*([^。]+。)/]);
  const summary = cleanShort(summaryRaw, existing?.summary || `${names[ticker] ?? title}のシナリオ評価。`, 90);

  const meta = {
    schemaVersion: 1,
    ticker,
    slug: existing?.slug || slugFor(ticker),
    name: existing?.name || names[ticker] || title.replace(/｜.*$/, "").replace(/完全入門ガイド.*$/, "").trim() || ticker,
    market,
    sector: existing?.sector || sectors[ticker] || "未分類",
    method: method.trim(),
    status: existing?.status || (publishNew ? "published" : "draft"),
    updated,
    price: { current: currentPrice, currency: existing?.price?.currency || currencyFor(market) },
    scenarios: {
      bear: Number.isFinite(scenarios.bear) && scenarios.bear ? scenarios.bear : existing?.scenarios?.bear ?? 0,
      base: Number.isFinite(scenarios.base) && scenarios.base ? scenarios.base : existing?.scenarios?.base ?? 0,
      bull: Number.isFinite(scenarios.bull) && scenarios.bull ? scenarios.bull : existing?.scenarios?.bull ?? 0,
    },
    positionPct,
    zone: zone.trim(),
    riskReward,
    catalyst,
    summary,
    tags: existing?.tags?.length ? existing.tags : [method.trim(), sectors[ticker]].filter(Boolean).slice(0, 4),
    risk: riskFromText(both) || existing?.risk || "要確認",
    detailPath: `stocks/${target}/index.html`,
    scenarioPath: `stocks/${target}/scenario.html`,
  };
  return meta;
}

async function readJson(path) {
  if (!(await exists(path))) return null;
  return JSON.parse(await readFile(path, "utf8"));
}

async function htmlFiles(dir) {
  const files = await readdir(dir, { withFileTypes: true });
  return files.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html")).map((entry) => entry.name);
}

async function main() {
  if (!(await exists(sourceRoot))) throw new Error(`サイト用フォルダが見つかりません: ${sourceRoot}`);
  const dirs = (await readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !skipFolders.has(entry.name.normalize("NFC")))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  const plans = [];
  for (const folder of dirs) {
    const rule = folderRules.get(folder) || {};
    const ticker = (rule.ticker || folder.split(/\s+/)[0]).toUpperCase();
    const target = rule.target || ticker;
    const sourceDir = join(sourceRoot, folder);
    const files = await htmlFiles(sourceDir);
    const detail = files.includes("index.html") ? "index.html" : "";
    const scenario = files.find((file) => file !== "index.html" && /^scenario\.html$/i.test(file))
      || files.find((file) => file !== "index.html" && file.toUpperCase() === `${ticker}.HTML`)
      || files.find((file) => file !== "index.html");
    const targetDir = join(root, "stocks", target);
    const metaPath = join(targetDir, "meta.json");
    const existing = await readJson(metaPath);
    const existingDetailPath = join(targetDir, "index.html");
    const canReuseExistingDetail = !detail && existing && await exists(existingDetailPath);
    if ((!detail && !canReuseExistingDetail) || !scenario) {
      plans.push({ folder, skipped: true, reason: "index.htmlまたはシナリオHTMLが見つかりません" });
      continue;
    }

    const detailHtml = detail ? await readFile(join(sourceDir, detail), "utf8") : await readFile(existingDetailPath, "utf8");
    const scenarioHtml = await readFile(join(sourceDir, scenario), "utf8");
    const meta = extractMeta({ ticker, target, detailHtml, scenarioHtml, existing });
    plans.push({ folder, target, ticker, detail, scenario, targetDir, metaPath, meta, detailHtml, scenarioHtml, exists: !!existing, reuseDetail: !detail });
  }

  for (const plan of plans) {
    if (plan.skipped) {
      console.log(`SKIP ${plan.folder}: ${plan.reason}`);
      continue;
    }
    const action = plan.exists ? "UPDATE" : "ADD";
    console.log(`${action} ${plan.folder} -> stocks/${plan.target} (${plan.reuseDetail ? "既存index.htmlを維持" : plan.detail} / ${plan.scenario})`);
    console.log(`  meta: ${plan.meta.ticker}, ${plan.meta.updated}, price=${plan.meta.price.current}, scenarios=${plan.meta.scenarios.bear}/${plan.meta.scenarios.base}/${plan.meta.scenarios.bull}`);
    if (!apply) continue;
    await mkdir(plan.targetDir, { recursive: true });
    if (!plan.reuseDetail) await writeFile(join(plan.targetDir, "index.html"), trimTrailingWhitespace(plan.detailHtml), "utf8");
    await writeFile(join(plan.targetDir, "scenario.html"), trimTrailingWhitespace(plan.scenarioHtml), "utf8");
    await writeFile(plan.metaPath, `${JSON.stringify(plan.meta, null, 2)}\n`, "utf8");
  }

  if (!apply) {
    console.log("\n確認のみです。実際に反映するには npm run sync:site-folder を実行してください。");
  } else {
    console.log("\nHTMLとmeta.jsonを反映しました。続けて npm run build でmanifestを再生成してください。");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
