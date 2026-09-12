import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "../src/common.mjs";
import { validateReport } from "../src/validate.mjs";
import { validateCatalystReport } from "../src/catalyst.mjs";
import { renderUnifiedReport } from "../src/unified-render.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const config = await readJson(join(repoRoot, "report-system/config.json"));
const report = await readJson(join(repoRoot, "report-system/reports/CYAB.report.json"));
const catalyst = await readJson(join(repoRoot, "report-system/reports/CYAB.catalyst.json"));
const template = await readFile(join(repoRoot, "report-system/templates/template_report_unified_v5.html"), "utf8");
const bindings = await readJson(join(repoRoot, "report-system/template-bindings.json"));

test("v1.1 report and catalyst render through bindings into one safe HTML", async () => {
  const reportValidation = await validateReport(report, config);
  const catalystValidation = validateCatalystReport(catalyst);
  assert.equal(reportValidation.fail_count, 0);
  assert.equal(reportValidation.blocking_warn_count, 0);
  assert.equal(catalystValidation.fail_count, 0);
  assert.equal(catalystValidation.blocking_warn_count, 0);

  const { html, catalystState } = renderUnifiedReport({ report, catalystReport: catalyst, reportValidation, catalystValidation, template, bindings });
  assert.equal(catalystState, "available");
  assert.match(html, /data-view-btn="guide"/);
  assert.match(html, /data-view-btn="scenario"/);
  assert.match(html, /data-view-btn="catalyst"/);
  assert.match(html, /data-scroll-target="sec1"/);
  assert.match(html, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(html, /Cyabra, Inc\./);
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.doesNotMatch(html, /\{\{[A-Z0-9_]+\}\}/);
  assert.doesNotMatch(html, /href="\.\.\/\.\.\/index\.html"/);
  assert.doesNotMatch(html, /<a\b[^>]*href="#/i);
  assert.doesNotMatch(html, /history\.(?:pushState|replaceState)\s*\(/);
});

test("missing catalyst keeps the report public and shows a placeholder", async () => {
  const reportValidation = await validateReport(report, config);
  const { html, catalystState } = renderUnifiedReport({ report, catalystReport: null, reportValidation, catalystValidation: null, template, bindings });
  assert.equal(catalystState, "missing");
  assert.match(html, /カタリストレポートは準備中です/);
  assert.doesNotMatch(html, /CATALYST_CONTENT_START/);
  assert.doesNotMatch(html, /<article class="catalyst-card">/);
});

test("blocking catalyst hides only the catalyst tab", async () => {
  const reportValidation = await validateReport(report, config);
  const catalystValidation = { status: "BLOCKING_WARN", fail_count: 0, blocking_warn_count: 1, info_warn_count: 0, infoWarnMessages: [], checks: [] };
  const { html, catalystState } = renderUnifiedReport({ report, catalystReport: catalyst, reportValidation, catalystValidation, template, bindings });
  assert.equal(catalystState, "blocking");
  assert.match(html, /<button type="button" class="tab-btn" hidden disabled>カタリスト（準備中）<\/button>/);
  assert.match(html, /data-view-btn="guide"/);
  assert.match(html, /data-view-btn="scenario"/);
});

test("legacy catalyst redirect opens the catalyst view without adding history", async () => {
  const redirect = await readFile(join(repoRoot, "report-system/templates/redirect_catalysts.html"), "utf8");
  assert.match(redirect, /location\.replace\('index\.html\?view=catalyst'\)/);
  assert.doesNotMatch(redirect, /location\.(?:assign|href)\s*=/);
});
