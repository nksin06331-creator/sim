import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeAudit, revisionDigest, shouldRollback, validateCandidate, validateJsonSchema, validatePatch } from "../src/auto-publish.mjs";

const independent = (revision = "r1") => ({ status: "PASS", fail_count: 0, warn_count: 0, revision, summary: "independent PASS" });
function report(overrides = {}) {
  const long = "企業、事業、競争、財務、製品、運用、用語、カタリストを出典に基づいて説明します。".repeat(40);
  const sources = Array.from({ length: 6 }, (_, i) => ({ id: `S${i + 1}`, title: `Source ${i + 1}`, publisher: "Issuer", url: `https://example.com/${i + 1}`, primary: i < 3, accessedAt: "2026-07-31" }));
  const base = {
    schemaVersion: 1, reportId: "TEST", revision: "r1", status: "draft", renderMode: "structured",
    update: { mode: "initial", baseRevision: null, reason: "initial report", changedFields: ["meta"] },
    meta: { companyName: "Test Inc.", ticker: "TEST", market: "US", exchange: "NASDAQ", currency: "USD", valuationDate: "2026-07-31", lastUpdated: "2026-07-31", sector: "Tech", industry: "Software", fiscalYearLabel: "FY", marketDetails: { reportingStandard: "US-GAAP", secCik: "1" } },
    overview: { tagline: long, heroTags: ["Tech"], heroStats: [{ value: 100, label: "price" }, { value: "A", label: "quality" }, { value: "B", label: "risk" }], businessSummary: long },
    guide: { sections: [{ id: "company", topic: "company", title: "Company", summaryItems: [long], blocks: [{ type: "paragraphs", paragraphs: [long] }] }] },
    scenario: {
      decision: { status: "neutral", oneLine: long, score: 60, companyQuality: "A", valuationView: "fair" },
      valuation: { currentPrice: 100, currency: "USD", expectedValue: 124, expectedReturnPct: 24, method: "scenario" },
      scenarios: [
        { name: "Bear", price: 80, probability: 20, conditions: ["down"], details: [] },
        { name: "Base", price: 120, probability: 50, conditions: ["base"], details: [] },
        { name: "Bull", price: 160, probability: 30, conditions: ["up"], details: [] },
      ],
      positioning: {}, marketReverse: {}, entryContext: { recent20dChangePct: 0, moveTrigger: "none", catalysts: [{ title: "earnings", timing: "Q3", status: "window", importance: 3, successImpact: "up", failureImpact: "down", sourceRefs: ["S1"] }], pricedInNote: long },
      risk: { riskClass: "HIGH", items: [{ category: "finance", title: "risk", description: long, severity: 4, sourceRefs: ["S2"] }] }, positives: ["a", "b", "c"], concerns: ["a", "b", "c"], watchItems: [], calculation: {}, assumptions: [], deepDive: [], disclaimer: "not advice",
    },
    sources, coverageWaivers: [], validation: { status: "PASS", checks: [], humanReviewed: false },
  };
  return structuredClone(Object.assign(base, overrides));
}
function result(r, options = {}) { return validateCandidate(r, { independent: independent(r.revision), now: new Date("2026-07-31T12:00:00Z"), ...options }); }

test("正常な米国株は全ゲートPASS", () => { const actual = result(report()); assert.equal(actual.decision, "AUTO_PUBLISH", JSON.stringify(actual, null, 2)); });
test("正常な日本株", () => { const r = report(); Object.assign(r.meta, { market: "JP", currency: "JPY", exchange: "TSE" }); r.scenario.valuation.currency = "JPY"; assert.equal(result(r).decision, "AUTO_PUBLISH"); });
test("新規report.json", () => assert.equal(result(report()).gates.gate2.status, "PASS"));
test("全面更新は正しいbaseRevisionを要求", () => { const old = report({ revision: "old", status: "published" }); old.validation.machinePublished = true; const r = report({ revision: "new", update: { mode: "full-refresh", baseRevision: "old", reason: "full refresh", changedFields: ["meta"] } }); assert.equal(result(r, { baseline: old, independent: independent("new") }).decision, "AUTO_PUBLISH"); });
test("正常なpatch", () => assert.equal(validatePatch({ baseRevision: "r1", changedFields: ["meta.lastUpdated"], changes: { meta: { lastUpdated: "2026-08-01" } } }, report()).status, "PASS"));
test("changedFieldsにない変更を拒否", () => assert.equal(validatePatch({ baseRevision: "r1", changedFields: ["meta.ticker"], changes: { meta: { lastUpdated: "2026-08-01" } } }, report()).status, "FAIL"));
test("古いbaseRevisionを拒否", () => assert.equal(validatePatch({ baseRevision: "old", changedFields: ["meta.lastUpdated"], changes: { meta: { lastUpdated: "2026-08-01" } } }, report()).status, "FAIL"));
test("catalystなしでも通常レポートは有効", () => assert.equal(result(report()).decision, "AUTO_PUBLISH"));
test("catalystありでも通常レポートの判定は独立", () => { const r = report({ catalystAvailable: true }); assert.equal(result(r).decision, "AUTO_PUBLISH"); });
test("確率合計不一致", () => { const r = report(); r.scenario.scenarios[0].probability = 10; assert.equal(result(r).decision, "AUTO_HOLD"); });
test("Bear Base Bull順序不一致", () => { const r = report(); r.scenario.scenarios[0].price = 130; assert.equal(result(r).decision, "AUTO_HOLD"); });
test("期待値計算不一致", () => { const r = report(); r.scenario.valuation.expectedValue = 999; assert.equal(result(r).decision, "AUTO_HOLD"); });
test("存在しないsourceRefs", () => { const r = report(); r.scenario.entryContext.catalysts[0].sourceRefs = ["MISSING"]; assert.equal(result(r).decision, "AUTO_HOLD"); });
test("市場と通貨の不一致", () => { const r = report(); r.meta.currency = "JPY"; assert.equal(result(r).decision, "AUTO_HOLD"); });
test("危険なHTMLとURL", () => { const r = report(); r.overview.tagline = "<script>alert(1)</script>"; assert.equal(result(r).decision, "AUTO_HOLD"); });
test("WARNが残るデータ", () => { const r = report(); r.sources.length = 5; assert.ok(result(r).warn_count > 0); });
test("coverageWaiversあり", () => { const r = report(); r.coverageWaivers = [{ checkId: "x" }]; assert.equal(result(r).decision, "AUTO_HOLD"); });
test("既存情報20%以上減少", () => { const old = report({ revision: "old", status: "published" }); old.validation.machinePublished = true; const r = report({ revision: "new", update: { mode: "full-refresh", baseRevision: "old", reason: "refresh", changedFields: ["overview"] } }); r.overview.tagline = "short"; r.overview.businessSummary = "short"; r.guide.sections[0].summaryItems = ["short"]; r.guide.sections[0].blocks = [{ type: "paragraphs", paragraphs: ["short"] }]; assert.equal(result(r, { baseline: old, independent: independent("new") }).decision, "AUTO_HOLD"); });
test("同一revisionのdigestは冪等", () => { const r = report(); assert.equal(revisionDigest(r), revisionDigest(structuredClone(r))); });
test("独立検証なしはAUTO_HOLD", () => assert.equal(validateCandidate(report(), { now: new Date("2026-07-31") }).decision, "AUTO_HOLD"));
test("公開後ヘルス失敗時だけ同一SHAをロールバック", () => { assert.equal(shouldRollback({ healthPassed: false, deployedSha: "a", currentSha: "a" }), true); assert.equal(shouldRollback({ healthPassed: false, deployedSha: "a", currentSha: "b" }), false); });
test("監査に直前正常revisionを保持", () => { const r = report(); const v = result(r); assert.equal(makeAudit({ report: r, result: v, rollbackRevision: "old" }).rollback_revision, "old"); });
test("report-patch schemaでchangedFields必須", async () => { const schema = JSON.parse(await readFile(new URL("../schemas/report-patch.schema.json", import.meta.url))); assert.ok(schema.required.includes("changedFields")); });
test("添付Schemaが必須項目欠落を拒否", async () => { const schema = JSON.parse(await readFile(new URL("../schemas/report.schema.json", import.meta.url))); assert.ok(validateJsonSchema({}, schema).some((item) => item.includes("required"))); });
