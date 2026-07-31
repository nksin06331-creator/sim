import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "../report-system/src/common.mjs";
import { renderGuide, renderScenario } from "../report-system/src/render.mjs";
import { validateReport } from "../report-system/src/validate.mjs";
import { renderCatalyst, validateCatalystReport } from "../report-system/src/catalyst.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = await readJson(join(root, "report-system/config.json"));
const reportPath = process.argv[2] ? resolve(process.argv[2]) : null;

if (!reportPath) {
  throw new Error("使い方: node scripts/publish-report-package.mjs report-system/reports/TICKER.report.json");
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

const report = await readJson(reportPath);
const ticker = report?.meta?.ticker;
if (!ticker || report.reportId !== ticker) throw new Error("reportIdとmeta.tickerが一致しません。");

const reportValidation = await validateReport(report, config);
if (reportValidation.status !== "PASS" || reportValidation.warnCount !== 0) {
  console.log(JSON.stringify(reportValidation, null, 2));
  throw new Error(`${ticker}: 通常レポートがPASS・WARN 0件ではありません。`);
}

const catalystCandidates = [
  join(root, "report-system", "catalysts", `${ticker}.catalyst.json`),
  join(root, "report-system", "catalysts", `${ticker}.json`),
];
const catalystPath = (await Promise.all(catalystCandidates.map(exists))).findIndex(Boolean);
if (catalystPath < 0) {
  throw new Error(`${ticker}: V6.2必須のreport-system/catalysts/${ticker}.catalyst.jsonがありません。`);
}
const catalyst = await readJson(catalystCandidates[catalystPath]);
if (catalyst?.meta?.ticker !== ticker) throw new Error(`${ticker}: カタリストJSONのティッカーが一致しません。`);
const catalystValidation = validateCatalystReport(catalyst);
if (catalystValidation.status !== "PASS" || catalystValidation.warnCount !== 0) {
  console.log(JSON.stringify(catalystValidation, null, 2));
  throw new Error(`${ticker}: カタリストレポートがPASS・WARN 0件ではありません。`);
}

const [guideCss, scenarioCss, catalystTemplate] = await Promise.all([
  readFile(join(root, config.assets.guideCss), "utf8"),
  readFile(join(root, config.assets.scenarioCss), "utf8"),
  readFile(join(root, "report-system/templates/catalyst-shell.html"), "utf8"),
]);
const [guideHtml, scenarioHtml] = await Promise.all([
  renderGuide(report, guideCss),
  renderScenario(report, scenarioCss),
]);
const catalystHtml = renderCatalyst(catalyst, catalystTemplate, catalystValidation);

const scenarioName = `${ticker}.html`;

for (const [name, html] of [["index.html", guideHtml], [scenarioName, scenarioHtml], ["catalysts.html", catalystHtml]]) {
  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) throw new Error(`${ticker}/${name}: 未置換プレースホルダーがあります。`);
  if (!html.includes('href="../../index.html"')) throw new Error(`${ticker}/${name}: 銘柄一覧への固定リンクがありません。`);
}

const scenarios = Object.fromEntries(report.scenario.scenarios.map((item) => [item.name.toLowerCase(), item.price]));
const market = report.meta.market === "JP" ? "日本株" : "米国株";
const outDir = join(root, "stocks", ticker);
await mkdir(outDir, { recursive: true });
await Promise.all([
  writeFile(join(outDir, "index.html"), guideHtml, "utf8"),
  writeFile(join(outDir, scenarioName), scenarioHtml, "utf8"),
  writeFile(join(outDir, "catalysts.html"), catalystHtml, "utf8"),
]);

const published = structuredClone(report);
published.status = "published";
published.validation = { ...published.validation, status: "PASS", machinePublished: true };
await mkdir(join(root, "report-system", "published"), { recursive: true });
await writeJson(join(root, "report-system", "published", `${ticker}.report.json`), published);

const meta = {
  schemaVersion: 1,
  ticker,
  slug: ticker.toLowerCase(),
  name: report.meta.companyName,
  market,
  sector: report.meta.sector,
  method: report.scenario.valuation.method,
  status: "published",
  updated: report.meta.lastUpdated,
  price: { current: report.scenario.valuation.currentPrice, currency: report.meta.currency },
  scenarios,
  positionPct: Number(report.scenario.positioning?.bandPositionPct ?? 0),
  zone: String(report.scenario.positioning?.zoneJudge ?? report.scenario.decision.valuationView),
  riskReward: String(report.scenario.positioning?.endpointRiskReward ?? "—"),
  catalyst: catalyst.summary.one_line,
  summary: report.scenario.decision.oneLine,
  tags: report.overview.heroTags,
  risk: report.scenario.risk.riskClass,
  detailPath: `stocks/${ticker}/index.html`,
  scenarioPath: `stocks/${ticker}/${scenarioName}`,
  catalystPath: `stocks/${ticker}/catalysts.html`,
  sourceRevision: report.revision,
};
await writeJson(join(outDir, "meta.json"), meta);
console.log(`${ticker}: 3種類のHTML、meta.json、公開用正本を生成しました。`);
