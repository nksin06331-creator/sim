import { access } from "node:fs/promises";
import { join } from "node:path";
import { collectStrings, repoRoot } from "./common.mjs";
import { validateSchema } from "./schema.mjs";

const requiredTopics = ["company", "industry", "products", "operations", "competition", "glossary", "catalysts"];
const updateModes = new Set(["initial", "full-refresh", "patch", "correction", "corporate-action"]);
const forbiddenClaims = [
  /絶対(?:に)?上がる/,
  /必ず上がる/,
  /買うべき/,
  /売るべき/,
  /爆上げ確定/,
  /テンバガー確定/,
];
const dangerousHtml = /<\s*(script|iframe|object|embed|form)\b|on[a-z]+\s*=|javascript\s*:/i;

function result(id, status, message) {
  return { id, status, message };
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function countItemsByBlock(report, type) {
  return [...(report.guide?.sections ?? []), ...(report.guide?.extraSections ?? [])]
    .flatMap((section) => section.blocks ?? [])
    .filter((block) => block.type === type)
    .reduce((sum, block) => sum + (block.items?.length ?? block.rows?.length ?? 0), 0);
}

function sourceReferences(report) {
  const refs = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (key === "sourceRefs" && Array.isArray(child)) child.forEach((ref) => refs.add(ref));
        else visit(child);
      }
    }
  };
  visit(report);
  return refs;
}

function finalResult(checks) {
  const failCount = checks.filter((check) => check.status === "FAIL").length;
  const blockingWarnCount = checks.filter((check) => check.status === "BLOCKING_WARN").length;
  const infoWarnCount = checks.filter((check) => check.status === "INFO_WARN").length;
  const status = failCount ? "FAIL" : blockingWarnCount ? "BLOCKING_WARN" : infoWarnCount ? "INFO_WARN" : "PASS";
  const infoWarnMessages = checks.filter((check) => check.status === "INFO_WARN").map((check) => check.message);
  return {
    status,
    fail_count: failCount,
    blocking_warn_count: blockingWarnCount,
    info_warn_count: infoWarnCount,
    failCount,
    blockingWarnCount,
    infoWarnCount,
    infoWarnMessages,
    checks,
  };
}

export async function validateReport(report, config) {
  const checks = [];
  const push = (id, status, message) => checks.push(result(id, status, message));
  const meta = report.meta ?? {};
  const schema = validateSchema("report", report);

  push("JSON_SCHEMA_V11", schema.valid ? "PASS" : "FAIL", schema.valid ? "report schema v1.1に適合" : `Schema違反: ${schema.errors.join(" / ")}`);
  push("S01_SCHEMA_VERSION", report.schemaVersion === 1 ? "PASS" : "FAIL", "schemaVersionは1");
  push("S02_REPORT_ID", /^[A-Z0-9.-]+$/.test(report.reportId ?? "") ? "PASS" : "FAIL", "reportIdは半角大文字");
  push("S03_TICKER_MATCH", report.reportId === meta.ticker ? "PASS" : "FAIL", "reportIdとtickerが一致");
  push("S04_RENDER_MODE", ["legacy-preserve", "structured"].includes(report.renderMode) ? "PASS" : "FAIL", "renderModeを確認");

  const update = report.update ?? {};
  const baseRequired = ["patch", "correction", "corporate-action"].includes(update.mode);
  push(
    "S05_UPDATE_MODE",
    updateModes.has(update.mode) && Boolean(update.reason && update.changedFields?.length) && (!baseRequired || Boolean(update.baseRevision)) ? "PASS" : "FAIL",
    "更新種別・理由・変更範囲・baseRevisionを確認",
  );
  push("S06_DATES", isDate(meta.valuationDate) && isDate(meta.lastUpdated) ? "PASS" : "FAIL", "評価基準日と更新日はYYYY-MM-DD");
  push("S07_CURRENCY", (meta.market === "US" && meta.currency === "USD") || (meta.market === "JP" && meta.currency === "JPY") ? "PASS" : "FAIL", "市場と通貨が一致");

  if (meta.market === "US") {
    push(
      "M01_US_FIELDS",
      Boolean(meta.marketDetails?.reportingStandard && meta.marketDetails?.secCik !== undefined) ? "PASS" : "BLOCKING_WARN",
      "米国株は会計基準とSEC CIKを確認",
    );
  } else if (meta.market === "JP") {
    push(
      "M02_JP_FIELDS",
      Boolean(meta.marketDetails?.reportingStandard && meta.marketDetails?.securitiesCode && meta.marketDetails?.listingSegment && meta.marketDetails?.fiscalYearEndMonth)
        ? "PASS"
        : "BLOCKING_WARN",
      "日本株は会計基準・証券コード・市場区分・決算月を確認",
    );
  } else {
    push("M00_MARKET", "FAIL", "marketはUSまたはJP");
  }

  if (report.renderMode === "legacy-preserve") {
    const paths = [report.legacy?.guidePath, report.legacy?.scenarioPath].filter(Boolean);
    push("L01_PATHS", paths.length === 2 ? "PASS" : "FAIL", "legacyページ2枚のパスを保持");
    for (const path of paths) {
      try {
        await access(join(repoRoot, path));
        push(`L02_EXISTS_${path}`, "PASS", `${path}が存在`);
      } catch {
        push(`L02_EXISTS_${path}`, "FAIL", `${path}が見つからない`);
      }
    }
  }

  if (report.renderMode === "structured") {
    const guide = report.guide ?? {};
    const scenario = report.scenario ?? {};
    const sections = [...(guide.sections ?? []), ...(guide.extraSections ?? [])];
    const topics = new Set(sections.map((section) => section.topic));
    const missingTopics = requiredTopics.filter((topic) => !topics.has(topic));
    push("C01_CORE_TOPICS", missingTopics.length ? "FAIL" : "PASS", missingTopics.length ? `不足トピック: ${missingTopics.join(", ")}` : "共通7トピックを掲載");
    push("C02_SECTION_COUNT", sections.length >= config.coverage.new.minimumGuideSections ? "PASS" : "INFO_WARN", `ガイドセクション ${sections.length}件`);
    const glossaryCount = countItemsByBlock(report, "terms");
    push("C03_GLOSSARY", glossaryCount >= config.coverage.new.minimumGlossaryTerms ? "PASS" : "INFO_WARN", `用語 ${glossaryCount}件`);

    const scenarios = scenario.scenarios ?? [];
    const byName = Object.fromEntries(scenarios.map((item) => [item.name, item]));
    const namesOk = ["Bear", "Base", "Bull"].every((name) => byName[name]) && scenarios.length === 3;
    push("V01_SCENARIOS", namesOk ? "PASS" : "FAIL", "Bear/Base/Bullの3ケース");
    const probability = scenarios.reduce((sum, item) => sum + Number(item.probability || 0), 0);
    push("V02_PROBABILITY", Math.abs(probability - 100) < 0.001 ? "PASS" : "FAIL", `確率合計 ${probability}%`);
    const orderOk = namesOk && byName.Bear.price < byName.Base.price && byName.Base.price < byName.Bull.price;
    push("V03_ORDER", orderOk ? "PASS" : "FAIL", "Bear < Base < Bull");
    const expected = scenarios.reduce((sum, item) => sum + Number(item.price) * Number(item.probability) / 100, 0);
    const shownExpected = Number(scenario.valuation?.expectedValue);
    push("V04_EXPECTED_VALUE", Number.isFinite(shownExpected) && Math.abs(expected - shownExpected) <= Math.max(0.11, expected * 0.002) ? "PASS" : "FAIL", `期待値再計算 ${expected.toFixed(4)}`);
    const current = Number(scenario.valuation?.currentPrice);
    const expectedReturn = current ? (shownExpected / current - 1) * 100 : NaN;
    push("V05_EXPECTED_RETURN", Number.isFinite(expectedReturn) && Math.abs(expectedReturn - Number(scenario.valuation?.expectedReturnPct)) <= 0.2 ? "PASS" : "FAIL", `期待リターン再計算 ${Number.isFinite(expectedReturn) ? expectedReturn.toFixed(1) : "不可"}%`);
    push("V06_CURRENCY", scenario.valuation?.currency === meta.currency ? "PASS" : "FAIL", "シナリオ通貨と市場通貨が一致");

    const catalysts = scenario.entryContext?.catalysts ?? [];
    push("C04_CATALYSTS", catalysts.length >= config.coverage.new.minimumCatalysts ? "PASS" : "INFO_WARN", `カタリスト ${catalysts.length}件`);
    const risks = scenario.risk?.items ?? [];
    push("C05_RISKS", risks.length >= config.coverage.new.minimumRisks ? "PASS" : "INFO_WARN", `リスク ${risks.length}件`);
    push("C06_POSITIVES", (scenario.positives?.length ?? 0) >= 3 ? "PASS" : "INFO_WARN", `良い点 ${scenario.positives?.length ?? 0}件`);
    push("C07_CONCERNS", (scenario.concerns?.length ?? 0) >= 3 ? "PASS" : "INFO_WARN", `懸念 ${scenario.concerns?.length ?? 0}件`);

    const sources = report.sources ?? [];
    const sourceIds = new Set(sources.map((source) => source.id));
    const primaryCount = sources.filter((source) => source.primary).length;
    push("SRC01_COUNT", sources.length >= config.coverage.new.minimumSources ? "PASS" : "INFO_WARN", `出典 ${sources.length}件`);
    push("SRC02_PRIMARY", primaryCount >= config.coverage.new.minimumPrimarySources ? "PASS" : "INFO_WARN", `一次情報 ${primaryCount}件`);
    push("SRC03_UNIQUE", sourceIds.size === sources.length ? "PASS" : "FAIL", "出典IDの重複なし");
    push("SRC04_HTTPS", sources.every((source) => /^https:\/\//.test(source.url ?? "")) ? "PASS" : "FAIL", "出典URLはHTTPS");
    const missingRefs = [...sourceReferences(report)].filter((ref) => !sourceIds.has(ref));
    push("SRC05_REFERENCES", missingRefs.length ? "FAIL" : "PASS", missingRefs.length ? `未定義出典: ${missingRefs.join(", ")}` : "出典参照が解決");
  }

  for (const waiver of report.coverageWaivers ?? []) {
    push(
      `WAIVER_${waiver.checkId}`,
      waiver.waiver_type === "blocking" ? "BLOCKING_WARN" : "INFO_WARN",
      `${waiver.checkId}: ${waiver.reason}`,
    );
  }

  const internal = report.validation ?? {};
  if (internal.status === "FAIL" || Number(internal.fail_count ?? 0) > 0) push("GATE1_STATUS", "FAIL", "AI生成時チェックにFAILがあります");
  else if (internal.status === "BLOCKING_WARN" || Number(internal.blocking_warn_count ?? 0) > 0) push("GATE1_STATUS", "BLOCKING_WARN", "AI生成時チェックにBLOCKING_WARNがあります");
  else push("GATE1_STATUS", "PASS", "AI生成時チェックに公開停止項目なし");
  for (const message of internal.infoWarnMessages ?? []) push("GATE1_INFO", "INFO_WARN", String(message));

  const strings = collectStrings(report);
  const dangerous = strings.filter((item) => dangerousHtml.test(item.value));
  push("SEC01_INJECTION", dangerous.length ? "FAIL" : "PASS", dangerous.length ? `危険なHTML: ${dangerous.map((item) => item.path).join(", ")}` : "危険なHTMLなし");
  const claims = strings.filter((item) => forbiddenClaims.some((pattern) => pattern.test(item.value)));
  push("TXT01_NO_ADVICE", claims.length ? "FAIL" : "PASS", claims.length ? `断定表現: ${claims.map((item) => item.path).join(", ")}` : "売買断定なし");
  const publishedGate = report.status !== "published"
    || (["PASS", "INFO_WARN"].includes(report.validation?.status) && (report.validation?.humanReviewed === true || report.validation?.machinePublished === true));
  push("PUB01_REVIEW_GATE", publishedGate ? "PASS" : "FAIL", "publishedにはGitHub機械ゲート通過記録が必要");

  return finalResult(checks);
}
