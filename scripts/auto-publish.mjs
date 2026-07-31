import { access, cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { repoRoot, readJson, writeJson } from "../report-system/src/common.mjs";
import { makeAudit, validateCandidate, validateJsonSchema } from "../report-system/src/auto-publish.mjs";
import { renderGuide, renderScenario } from "../report-system/src/render.mjs";
import { renderCatalyst, validateCatalystReport } from "../report-system/src/catalyst.mjs";

const [command, reportArg, independentArg] = process.argv.slice(2);
if (!command || !reportArg) throw new Error("usage: auto-publish validate|promote REPORT_JSON [INDEPENDENT_JSON]");
const reportPath = resolve(reportArg);
const report = await readJson(reportPath);
if (!/^[A-Z0-9.-]+\.report\.json$/.test(basename(reportPath))) throw new Error("正本名はTICKER.report.jsonにしてください");
if (basename(reportPath) !== `${report.reportId}.report.json`) throw new Error("ファイル名とreportIdが一致しません");
async function exists(path) { try { await access(path); return true; } catch { return false; } }
const publishedSnapshot = join(repoRoot, "report-system", "published", `${report.reportId}.report.json`);
const baseline = await exists(publishedSnapshot) ? await readJson(publishedSnapshot) : null;
const independent = independentArg && await exists(resolve(independentArg)) ? await readJson(resolve(independentArg)) : null;
const reportSchema = await readJson(join(repoRoot, "report-system", "schemas", "report.schema.json"));
const schemaErrors = validateJsonSchema(report, reportSchema);
const catalystPath = join(dirname(reportPath), `${report.reportId}.catalyst.json`);
let catalyst = null;
if (await exists(catalystPath)) {
  catalyst = await readJson(catalystPath);
  const catalystSchema = await readJson(join(repoRoot, "report-system", "schemas", "catalyst-report.schema.json"));
  schemaErrors.push(...validateJsonSchema(catalyst, catalystSchema).map((error) => `catalyst${error.slice(1)}`));
  const catalystValidation = validateCatalystReport(catalyst);
  if (catalystValidation.status !== "PASS" || catalystValidation.failCount || catalystValidation.warnCount) schemaErrors.push("catalyst validation must be PASS with zero warnings");
  if (catalyst.meta?.ticker !== report.reportId || catalyst.meta?.currency !== report.meta.currency || catalyst.meta?.company_name !== report.meta.companyName) schemaErrors.push("catalyst identity/currency mismatch");
}
const result = validateCandidate(report, { baseline, independent, schemaErrors });
const auditPath = join(repoRoot, "report-system", "audit", report.reportId, `${report.revision}.json`);
await mkdir(dirname(auditPath), { recursive: true });
const previousAudit = await exists(auditPath) ? await readJson(auditPath) : null;
if (previousAudit?.decision === "AUTO_PUBLISH" && command === "promote") throw new Error("同一revisionは公開済みです");
if (command === "validate") {
  await writeJson(auditPath, makeAudit({ report, result, commitSha: process.env.GITHUB_SHA ?? "local", rollbackRevision: baseline?.revision ?? null }));
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `decision=${result.decision}\nticker=${report.reportId}\nrevision=${report.revision}\n`, { flag: "a" });
  if (result.decision !== "AUTO_PUBLISH") process.exitCode = 2;
} else if (command === "promote") {
  if (result.decision !== "AUTO_PUBLISH") throw new Error(`AUTO_HOLD: fail=${result.fail_count} warn=${result.warn_count}`);
  const folder = report.reportId;
  const stockDir = join(repoRoot, "stocks", folder);
  const guideCss = await readFile(join(repoRoot, "report-system/assets/guide-v4.css"), "utf8");
  const scenarioCss = await readFile(join(repoRoot, "report-system/assets/scenario-v4.css"), "utf8");
  const promoted = structuredClone(report);
  promoted.status = "published";
  promoted.validation = { status: "PASS", humanReviewed: false, machinePublished: true, revision: report.revision };
  const previewDir = join(repoRoot, "_report-preview", "auto-publish", report.reportId, report.revision);
  await mkdir(previewDir, { recursive: true });
  const guide = await renderGuide(promoted, guideCss);
  const scenario = await renderScenario(promoted, scenarioCss);
  if (/\{\{[A-Z0-9_]+\}\}/.test(guide + scenario)) throw new Error("未置換プレースホルダー");
  await writeFile(join(previewDir, "index.html"), guide);
  await writeFile(join(previewDir, "scenario.html"), scenario);
  await mkdir(stockDir, { recursive: true });
  await cp(join(previewDir, "index.html"), join(stockDir, "index.html"));
  await cp(join(previewDir, "scenario.html"), join(stockDir, "scenario.html"));
  const byName = Object.fromEntries(promoted.scenario.scenarios.map((item) => [item.name.toLowerCase(), item]));
  const meta = {
    schemaVersion: 1, ticker: promoted.reportId, slug: promoted.reportId.toLowerCase(), name: promoted.meta.companyName,
    market: promoted.meta.market === "JP" ? "日本株" : "米国株", sector: promoted.meta.sector,
    method: promoted.scenario.valuation.method, status: "published", updated: promoted.meta.lastUpdated,
    price: { current: promoted.scenario.valuation.currentPrice, currency: promoted.meta.currency },
    scenarios: { bear: byName.bear.price, base: byName.base.price, bull: byName.bull.price },
    positionPct: promoted.scenario.positioning.bandPositionPct ?? 0, zone: promoted.scenario.decision.valuationView,
    riskReward: promoted.scenario.decision.status, catalyst: promoted.scenario.entryContext.catalysts?.[0]?.title ?? "確認中",
    summary: promoted.overview.businessSummary, tags: promoted.overview.heroTags, risk: promoted.scenario.risk.riskClass,
    detailPath: `stocks/${folder}/index.html`, scenarioPath: `stocks/${folder}/scenario.html`, sourceRevision: report.revision,
  };
  await writeJson(join(stockDir, "meta.json"), meta);
  if (catalyst) {
    const catalystValidation = validateCatalystReport(catalyst);
    const catalystTemplate = await readFile(join(repoRoot, "report-system/templates/catalyst-shell.html"), "utf8");
    const catalystHtml = renderCatalyst(catalyst, catalystTemplate, catalystValidation);
    if (/\{\{[A-Z0-9_]+\}\}/.test(catalystHtml)) throw new Error("カタリスト未置換プレースホルダー");
    await writeFile(join(stockDir, "catalysts.html"), catalystHtml);
    await mkdir(join(repoRoot, "report-system", "catalysts"), { recursive: true });
    await writeJson(join(repoRoot, "report-system", "catalysts", `${report.reportId}.json`), catalyst);
    const registryPath = join(repoRoot, "data", "catalyst-reports.json");
    const registry = await readJson(registryPath);
    registry.reports = (registry.reports ?? []).filter((entry) => entry.ticker !== report.reportId);
    registry.reports.push({ ticker: report.reportId, path: `stocks/${folder}/catalysts.html`, status: "published", reviewedBy: "github-actions[bot]", reviewedAt: new Date().toISOString().slice(0, 10) });
    registry.reports.sort((a, b) => a.ticker.localeCompare(b.ticker));
    await writeJson(registryPath, registry);
  }
  await mkdir(dirname(publishedSnapshot), { recursive: true });
  if (baseline) {
    const historyPath = join(repoRoot, "report-system", "history", report.reportId, `${baseline.revision}.report.json`);
    await mkdir(dirname(historyPath), { recursive: true });
    if (!(await exists(historyPath))) await writeJson(historyPath, baseline);
  }
  const tempSnapshot = `${publishedSnapshot}.tmp`;
  await writeJson(tempSnapshot, promoted); await rename(tempSnapshot, publishedSnapshot);
  await writeJson(reportPath, promoted);
  await writeJson(auditPath, makeAudit({ report: promoted, result, commitSha: process.env.GITHUB_SHA ?? "local", publishedRevision: report.revision, rollbackRevision: baseline?.revision ?? null }));
  console.log(`AUTO_PUBLISH ${report.reportId} ${report.revision}`);
} else throw new Error(`unknown command: ${command}`);
