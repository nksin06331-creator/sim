import { createHash } from "node:crypto";

const unsafeText = /<\s*(script|iframe|object|embed|form)\b|on[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html/i;
const advice = /絶対|必ず上がる|買うべき|売るべき|爆上げ確定|テンバガー確定/;

function check(id, status, message) { return { id, status, message }; }
function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => strings(item, out));
  return out;
}
function refs(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => refs(item, out));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (["sourceRefs", "source_ids"].includes(key) && Array.isArray(child)) child.forEach((id) => out.add(id));
      else refs(child, out);
    }
  }
  return out;
}
function leafPaths(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key));
}
export function contentMetrics(report) {
  const text = strings({ overview: report.overview, guide: report.guide, scenario: report.scenario }).join(" ");
  return { textCharacters: text.replace(/\s+/g, "").length, sources: report.sources?.length ?? 0 };
}
export function revisionDigest(report) { return createHash("sha256").update(JSON.stringify(report)).digest("hex"); }
export function validateJsonSchema(value, schema, root = schema, path = "$") {
  const errors = [];
  if (!schema || typeof schema !== "object") return errors;
  if (schema.$ref?.startsWith("#/$defs/")) return validateJsonSchema(value, root.$defs?.[schema.$ref.slice(8)], root, path);
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path}: const`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: enum`);
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : [];
  if (types.length) {
    const actual = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
    if (!types.includes(actual) && !(actual === "integer" && types.includes("number"))) return [`${path}: type`];
  }
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) errors.push(`${path}: minLength`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: pattern`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: maximum`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(`${path}: exclusiveMinimum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${path}: minItems`);
    if (schema.maxItems && value.length > schema.maxItems) errors.push(`${path}: maxItems`);
    if (schema.prefixItems) value.forEach((item, index) => errors.push(...validateJsonSchema(item, schema.prefixItems[index] ?? schema.items, root, `${path}[${index}]`)));
    else if (schema.items && schema.items !== false) value.forEach((item, index) => errors.push(...validateJsonSchema(item, schema.items, root, `${path}[${index}]`)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key}: required`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...validateJsonSchema(child, schema.properties[key], root, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: additionalProperty`);
    }
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) => validateJsonSchema(value, candidate, root, path).length === 0).length;
    if (matches !== 1) errors.push(`${path}: oneOf`);
  }
  for (const rule of schema.allOf ?? []) {
    let applies = true;
    for (const [key, condition] of Object.entries(rule.if?.properties ?? {})) if (condition.const !== undefined && value?.[key] !== condition.const) applies = false;
    if (applies && rule.then) errors.push(...validateJsonSchema(value, rule.then, root, path));
  }
  return errors;
}
export function validatePatch(patch, current) {
  const checks = [];
  checks.push(check("P01_CHANGED_FIELDS", Array.isArray(patch.changedFields) && patch.changedFields.length ? "PASS" : "FAIL", "changedFieldsは必須"));
  checks.push(check("P02_BASE_REVISION", patch.baseRevision === current?.revision ? "PASS" : "FAIL", "baseRevisionは公開中revisionと一致"));
  const declared = new Set(patch.changedFields ?? []);
  const actual = leafPaths(patch.changes ?? {});
  const undeclared = actual.filter((path) => !declared.has(path));
  checks.push(check("P03_SCOPE", undeclared.length ? "FAIL" : "PASS", undeclared.length ? `未宣言変更: ${undeclared.join(", ")}` : "変更範囲は宣言済み"));
  return summarize(checks);
}
function summarize(checks) {
  const fail_count = checks.filter((item) => item.status === "FAIL").length;
  const warn_count = checks.filter((item) => item.status === "WARN").length;
  return { status: fail_count ? "FAIL" : warn_count ? "WARN" : "PASS", fail_count, warn_count, checks };
}
export function validateCandidate(report, { baseline = null, independent = null, expectedCommitSha = null, schemaErrors = [], now = new Date() } = {}) {
  const gate1 = [], gate2 = [], gate3 = [], gate4 = [];
  const meta = report.meta ?? {};
  const scenarios = report.scenario?.scenarios ?? [];
  const byName = Object.fromEntries(scenarios.map((item) => [item.name, item]));
  const sourceIds = new Set((report.sources ?? []).map((source) => source.id));
  const allText = strings(report);
  gate1.push(check("G1_STATUS", ["draft", "review"].includes(report.status) ? "PASS" : "FAIL", "候補はdraft/review、published昇格は機械処理だけ"));
  gate1.push(check("G1_IDENTITY", report.reportId === meta.ticker && /^[A-Z0-9.-]+$/.test(report.reportId ?? "") ? "PASS" : "FAIL", "銘柄を一意に特定"));
  gate1.push(check("G1_MARKET", (meta.market === "US" && meta.currency === "USD") || (meta.market === "JP" && meta.currency === "JPY") ? "PASS" : "FAIL", "市場と通貨が一致"));
  gate1.push(check("G1_FRESHNESS", /^\d{4}-\d{2}-\d{2}$/.test(meta.lastUpdated ?? "") && (now - new Date(`${meta.lastUpdated}T00:00:00Z`)) / 86400000 <= 120 ? "PASS" : "FAIL", "重要情報は120日以内"));
  gate1.push(check("G1_SOURCES", (report.sources?.length ?? 0) >= 6 && (report.sources ?? []).filter((s) => s.primary).length >= 3 ? "PASS" : "WARN", "出典6件以上・一次情報3件以上"));
  gate1.push(check("G1_INFORMATION", contentMetrics(report).textCharacters >= 1000 ? "PASS" : "WARN", "新規レポートの情報量"));
  gate1.push(check("G1_WAIVERS", (report.coverageWaivers?.length ?? 0) === 0 ? "PASS" : "WARN", "自動公開はcoverageWaivers 0件"));
  gate1.push(check("G1_UNCONFIRMED", allText.some((text) => /重要.{0,6}(未確認|UNKNOWN)/i.test(text)) ? "WARN" : "PASS", "重要な未確認事項なし"));
  gate2.push(check("G2_SCHEMA", schemaErrors.length === 0 ? "PASS" : "FAIL", schemaErrors.length ? `Schema: ${schemaErrors.slice(0, 8).join(", ")}` : "添付V6 JSON Schema PASS"));
  gate2.push(check("G2_SCHEMA_CORE", report.schemaVersion === 1 && report.update?.changedFields?.length && report.meta && report.revision ? "PASS" : "FAIL", "V6必須コア項目"));
  gate2.push(check("G2_SCENARIOS", scenarios.length === 3 && byName.Bear && byName.Base && byName.Bull ? "PASS" : "FAIL", "Bear/Base/Bullの3ケース"));
  const probability = scenarios.reduce((sum, item) => sum + Number(item.probability || 0), 0);
  gate2.push(check("G2_PROBABILITY", Math.abs(probability - 100) < 0.001 ? "PASS" : "FAIL", `確率合計 ${probability}%`));
  gate2.push(check("G2_ORDER", byName.Bear?.price < byName.Base?.price && byName.Base?.price < byName.Bull?.price ? "PASS" : "FAIL", "Bear < Base < Bull"));
  const expected = scenarios.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.probability || 0) / 100, 0);
  const shown = Number(report.scenario?.valuation?.expectedValue);
  gate2.push(check("G2_EXPECTED", Number.isFinite(shown) && Math.abs(expected - shown) <= Math.max(0.11, expected * 0.002) ? "PASS" : "FAIL", `期待値再計算 ${expected.toFixed(2)}`));
  const current = Number(report.scenario?.valuation?.currentPrice);
  const expectedReturn = current > 0 ? (shown / current - 1) * 100 : NaN;
  gate2.push(check("G2_RETURN", Number.isFinite(expectedReturn) && Math.abs(expectedReturn - Number(report.scenario?.valuation?.expectedReturnPct)) <= 0.2 ? "PASS" : "FAIL", "期待リターン再計算"));
  gate2.push(check("G2_SOURCE_REFS", [...refs(report)].every((id) => sourceIds.has(id)) ? "PASS" : "FAIL", "sourceRefs参照整合"));
  gate2.push(check("G2_URLS", (report.sources ?? []).every((source) => /^https:\/\//.test(source.url ?? "")) ? "PASS" : "FAIL", "出典URLはHTTPS"));
  gate2.push(check("G2_SECURITY", allText.some((text) => unsafeText.test(text) || advice.test(text)) ? "FAIL" : "PASS", "危険HTML・URL・売買断定なし"));
  gate2.push(check("G2_REVISION", report.revision && (report.update?.mode === "initial" ? report.update?.baseRevision == null : Boolean(report.update?.baseRevision)) ? "PASS" : "FAIL", "revisionとbaseRevision整合"));
  if (baseline) {
    const before = contentMetrics(baseline), after = contentMetrics(report);
    gate2.push(check("G2_TEXT_REGRESSION", before.textCharacters === 0 || after.textCharacters >= before.textCharacters * 0.8 ? "PASS" : "FAIL", "本文量を20%以上説明なく削減しない"));
    gate2.push(check("G2_SOURCE_REGRESSION", before.sources === 0 || after.sources >= before.sources * 0.75 ? "PASS" : "FAIL", "出典を25%以上説明なく削減しない"));
    gate2.push(check("G2_BASE_REVISION", report.update?.baseRevision === baseline.revision ? "PASS" : "FAIL", "古いbaseRevisionを拒否"));
  }
  if (!independent) gate3.push(check("G3_INDEPENDENT", "FAIL", "独立検証証明がないためAUTO_HOLD"));
  else {
    gate3.push(check("G3_INDEPENDENT", independent.status === "PASS" && independent.fail_count === 0 && independent.warn_count === 0 ? "PASS" : "FAIL", independent.summary ?? "独立検証結果"));
    gate3.push(check("G3_REVISION", independent.revision === report.revision ? "PASS" : "FAIL", "独立検証revision一致"));
    gate3.push(check("G3_PROVENANCE", independent.source === "github_pr_review" && independent.verifier === "chatgpt-independent" ? "PASS" : "FAIL", "独立ChatGPT検証のPR証明"));
    gate3.push(check("G3_COMMIT", /^[0-9a-f]{40}$/i.test(expectedCommitSha ?? "") && independent.commit_sha === expectedCommitSha ? "PASS" : "FAIL", "検証対象コミットSHA一致"));
  }
  gate4.push(check("G4_RENDERABLE", report.renderMode === "structured" && report.guide?.sections?.length && report.scenario ? "PASS" : "FAIL", "正本JSONからHTML生成可能"));
  gate4.push(check("G4_PREVIEW", "PASS", "プレビュー生成は実行工程で再確認"));
  const gates = { gate1: summarize(gate1), gate2: summarize(gate2), gate3: summarize(gate3), gate4: summarize(gate4) };
  const summary = summarize(Object.values(gates).flatMap((gate) => gate.checks));
  return { decision: summary.status === "PASS" ? "AUTO_PUBLISH" : "AUTO_HOLD", candidate_revision: report.revision, validated_revision: summary.status === "PASS" ? report.revision : null, ...summary, gates };
}
export function isPublishedAudit(audit, revision) {
  return audit?.decision === "AUTO_PUBLISH" && audit?.published_revision === revision;
}
export function makeAudit({ report, result, commitSha = "local", publishedRevision = null, rollbackRevision = null }) {
  return { schemaVersion: 1, ticker: report.reportId, candidate_revision: report.revision, validated_revision: result.validated_revision, published_revision: publishedRevision, rollback_revision: rollbackRevision, decision: result.decision, fail_count: result.fail_count, warn_count: result.warn_count, gates: result.gates, commit_sha: commitSha, generated_at: new Date().toISOString() };
}
export function shouldRollback({ healthPassed, deployedSha, currentSha }) { return healthPassed === false && Boolean(deployedSha) && deployedSha === currentSha; }
