import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "../report-system/src/common.mjs";
import { validateReport } from "../report-system/src/validate.mjs";
import { validateCatalystReport } from "../report-system/src/catalyst.mjs";
import { renderUnifiedReport } from "../report-system/src/unified-render.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = await readJson(join(root, "report-system/config.json"));
const reportPath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!reportPath) throw new Error("使い方: node scripts/publish-report-package-unified-v5.mjs report-system/reports/TICKER.report.json");

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function isBlocking(validation) {
  return ["FAIL", "BLOCKING_WARN"].includes(validation?.status)
    || Number(validation?.fail_count ?? validation?.failCount ?? 0) > 0
    || Number(validation?.blocking_warn_count ?? validation?.blockingWarnCount ?? 0) > 0;
}

function applyRedirectTemplate(template, ticker) {
  const html = template.replaceAll("{{TICKER}}", ticker);
  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) throw new Error(`${ticker}: リダイレクトに未置換プレースホルダーがあります。`);
  return html;
}

const report = await readJson(reportPath);
const ticker = report?.meta?.ticker;
if (!ticker || report.reportId !== ticker) throw new Error("reportIdとmeta.tickerが一致しません。");

const reportValidation = await validateReport(report, config);
if (isBlocking(reportValidation)) {
  console.log(JSON.stringify(reportValidation, null, 2));
  throw new Error(`${ticker}: 通常レポートにFAILまたはBLOCKING_WARNがあります。`);
}

const catalystCandidates = [
  join(root, "report-system", "catalysts", `${ticker}.catalyst.json`),
  join(root, "report-system", "catalysts", `${ticker}.json`),
  join(root, "report-system", "reports", `${ticker}.catalyst.json`),
];
const catalystIndex = (await Promise.all(catalystCandidates.map(exists))).findIndex(Boolean);
let catalystReport = null;
let catalystValidation = null;
if (catalystIndex >= 0) {
  catalystReport = await readJson(catalystCandidates[catalystIndex]);
  if (catalystReport?.meta?.ticker !== ticker) throw new Error(`${ticker}: カタリストJSONのティッカーが一致しません。`);
  catalystValidation = validateCatalystReport(catalystReport);
}

const [template, bindings, tickerRedirectTemplate, catalystRedirectTemplate] = await Promise.all([
  readFile(join(root, "report-system", "templates", "template_report_unified_v5.html"), "utf8"),
  readJson(join(root, "report-system", "template-bindings.json")),
  readFile(join(root, "report-system", "templates", "redirect_TICKER.html"), "utf8"),
  readFile(join(root, "report-system", "templates", "redirect_catalysts.html"), "utf8"),
]);

const { html, catalystState } = renderUnifiedReport({
  report,
  catalystReport,
  reportValidation,
  catalystValidation,
  template,
  bindings,
});
const outDir = join(root, "stocks", ticker);
await mkdir(outDir, { recursive: true });
await Promise.all([
  writeFile(join(outDir, "index.html"), html, "utf8"),
  writeFile(join(outDir, `${ticker}.html`), applyRedirectTemplate(tickerRedirectTemplate, ticker), "utf8"),
  writeFile(join(outDir, "catalysts.html"), applyRedirectTemplate(catalystRedirectTemplate, ticker), "utf8"),
]);

const published = structuredClone(report);
published.status = "published";
published.templateVersion = "sim-report-v5";
published.validation = {
  ...published.validation,
  status: reportValidation.info_warn_count > 0 ? "INFO_WARN" : "PASS",
  fail_count: 0,
  blocking_warn_count: 0,
  info_warn_count: reportValidation.info_warn_count,
  infoWarnMessages: reportValidation.infoWarnMessages,
  checks: reportValidation.checks,
  machinePublished: true,
  revision: report.revision,
};
await mkdir(join(root, "report-system", "published"), { recursive: true });
await writeJson(join(root, "report-system", "published", `${ticker}.report.json`), published);

const scenarios = Object.fromEntries(report.scenario.scenarios.map((item) => [item.name.toLowerCase(), item.price]));
const market = report.meta.market === "JP" ? "日本株" : "米国株";
const catalystPublished = catalystState === "available";
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
  catalyst: catalystPublished ? catalystReport.summary.one_line : "カタリストレポートは準備中です",
  summary: report.scenario.decision.oneLine,
  tags: report.overview.heroTags,
  risk: report.scenario.risk.riskClass,
  detailPath: `stocks/${ticker}/index.html`,
  scenarioPath: `stocks/${ticker}/index.html`,
  catalystPath: `stocks/${ticker}/index.html?view=catalyst`,
  sourceRevision: report.revision,
};
await writeJson(join(outDir, "meta.json"), meta);
console.log(`${ticker}: v1.1 Schema・Validator・bindings・統合テンプレートから公開パッケージを生成しました（catalyst=${catalystState}）。`);
