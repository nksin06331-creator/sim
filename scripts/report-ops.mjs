import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deepMerge,
  leafPaths,
  readJson,
  repoRoot,
  sha256,
  writeJson,
} from "../report-system/src/common.mjs";
import {
  baselineForStocks,
  compareMetrics,
  htmlMetrics,
} from "../report-system/src/metrics.mjs";
import { renderGuide, renderScenario } from "../report-system/src/render.mjs";
import { validateReport } from "../report-system/src/validate.mjs";
import { validateSchema } from "../report-system/src/schema.mjs";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (scriptRoot !== repoRoot) throw new Error("リポジトリルートを解決できませんでした。");
const config = await readJson(join(repoRoot, "report-system/config.json"));
const args = process.argv.slice(2);
const command = args[0];

function usage() {
  console.log(`SiM report operations

  node scripts/report-ops.mjs assets
  node scripts/report-ops.mjs baseline
  node scripts/report-ops.mjs validate REPORT_JSON
  node scripts/report-ops.mjs preview REPORT_JSON
  node scripts/report-ops.mjs verify REPORT_JSON
  node scripts/report-ops.mjs patch BASE_JSON PATCH_JSON --output OUTPUT_JSON

公開ディレクトリへ書き込むコマンドは意図的に用意していません。`);
}

function option(name, fallback = null) {
  const equal = args.find((value) => value.startsWith(`${name}=`));
  if (equal) return equal.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
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

function styleFrom(html) {
  const style = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1];
  if (!style) throw new Error("共通CSSを抽出できませんでした。");
  return style.trim();
}

async function buildPreview(reportPath) {
  const report = await readJson(reportPath);
  const validation = await validateReport(report, config);
  if (["FAIL", "BLOCKING_WARN"].includes(validation.status)) {
    console.log(JSON.stringify(validation, null, 2));
    throw new Error("Validation FAILのためプレビューを生成しません。");
  }
  const outDir = join(repoRoot, config.previewRoot, "stocks", report.meta.ticker);
  await mkdir(outDir, { recursive: true });
  const guideOut = join(outDir, "index.html");
  const scenarioOut = join(outDir, "scenario.html");

  if (report.renderMode === "legacy-preserve") {
    await cp(join(repoRoot, report.legacy.guidePath), guideOut);
    await cp(join(repoRoot, report.legacy.scenarioPath), scenarioOut);
  } else {
    const guideCss = await readFile(join(repoRoot, config.assets.guideCss), "utf8");
    const scenarioCss = await readFile(join(repoRoot, config.assets.scenarioCss), "utf8");
    await writeFile(guideOut, await renderGuide(report, guideCss), "utf8");
    await writeFile(scenarioOut, await renderScenario(report, scenarioCss), "utf8");
  }
  await writeJson(join(outDir, "validation.json"), validation);
  return { report, validation, outDir, guideOut, scenarioOut };
}

async function verifyPreview(reportPath) {
  const built = await buildPreview(reportPath);
  const [guide, scenario] = await Promise.all([
    readFile(built.guideOut, "utf8"),
    readFile(built.scenarioOut, "utf8"),
  ]);
  const metrics = { guide: htmlMetrics(guide), scenario: htmlMetrics(scenario) };
  const checks = [];

  if (built.report.renderMode === "legacy-preserve") {
    const [sourceGuide, sourceScenario] = await Promise.all([
      readFile(join(repoRoot, built.report.legacy.guidePath), "utf8"),
      readFile(join(repoRoot, built.report.legacy.scenarioPath), "utf8"),
    ]);
    checks.push({
      id: "LEGACY_GUIDE_BYTE_MATCH",
      status: sha256(sourceGuide) === metrics.guide.sha256 ? "PASS" : "FAIL",
      message: "企業ガイドが既存HTMLとバイト単位で一致",
    });
    checks.push({
      id: "LEGACY_SCENARIO_BYTE_MATCH",
      status: sha256(sourceScenario) === metrics.scenario.sha256 ? "PASS" : "FAIL",
      message: "シナリオが既存HTMLとバイト単位で一致",
    });
  } else {
    const baselineFile = join(repoRoot, config.baselinePath);
    const baseline = (await exists(baselineFile)) ? await readJson(baselineFile) : null;
    const tickerBaseline = baseline?.reports?.[built.report.meta.ticker];
    if (tickerBaseline) {
      checks.push(...compareMetrics(metrics, tickerBaseline, config));
    } else {
      checks.push({
        id: "NEW_GUIDE_TEXT",
        status: metrics.guide.textCharacters >= config.coverage.new.minimumGuideTextCharacters ? "PASS" : "FAIL",
        message: `新規ガイド本文 ${metrics.guide.textCharacters}文字`,
      });
      checks.push({
        id: "NEW_SCENARIO_TEXT",
        status: metrics.scenario.textCharacters >= config.coverage.new.minimumScenarioTextCharacters ? "PASS" : "FAIL",
        message: `新規シナリオ本文 ${metrics.scenario.textCharacters}文字`,
      });
    }
  }

  checks.push({
    id: "LIVE_PRICE_MARKERS",
    status: metrics.guide.livePriceMarkers > 0 && metrics.scenario.livePriceMarkers > 0 ? "PASS" : "FAIL",
    message: "企業ガイドとシナリオにライブ株価マーカー",
  });
  const failCount = checks.filter((check) => check.status === "FAIL").length;
  const warnCount = checks.filter((check) => check.status === "WARN").length;
  const report = {
    status: failCount ? "FAIL" : warnCount ? "WARN" : "PASS",
    failCount,
    warnCount,
    checks,
    metrics,
  };
  await writeJson(join(built.outDir, "compatibility.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (failCount) process.exitCode = 1;
}

if (!command || ["help", "--help", "-h"].includes(command)) {
  usage();
} else if (command === "assets") {
  const [guideHtml, scenarioHtml] = await Promise.all([
    readFile(join(repoRoot, "stocks/BE/index.html"), "utf8"),
    readFile(join(repoRoot, "stocks/BE/scenario.html"), "utf8"),
  ]);
  await mkdir(join(repoRoot, "report-system/assets"), { recursive: true });
  await writeFile(join(repoRoot, config.assets.guideCss), `${styleFrom(guideHtml)}\n`, "utf8");
  await writeFile(join(repoRoot, config.assets.scenarioCss), `${styleFrom(scenarioHtml)}\n`, "utf8");
  console.log("現行BEページから共通CSSを抽出しました。公開ページは変更していません。");
} else if (command === "baseline") {
  const baseline = await baselineForStocks(join(repoRoot, "stocks"));
  await mkdir(dirname(join(repoRoot, config.baselinePath)), { recursive: true });
  await writeJson(join(repoRoot, config.baselinePath), baseline);
  console.log(`${baseline.reportCount}銘柄の現行情報量を基準として保存しました。`);
} else if (command === "validate") {
  if (!args[1]) throw new Error("REPORT_JSONを指定してください。");
  const validation = await validateReport(await readJson(resolve(args[1])), config);
  console.log(JSON.stringify(validation, null, 2));
  if (["FAIL", "BLOCKING_WARN"].includes(validation.status)) process.exitCode = 1;
} else if (command === "preview") {
  if (!args[1]) throw new Error("REPORT_JSONを指定してください。");
  const built = await buildPreview(resolve(args[1]));
  console.log(`プレビューを生成しました: ${built.outDir}`);
} else if (command === "verify") {
  if (!args[1]) throw new Error("REPORT_JSONを指定してください。");
  await verifyPreview(resolve(args[1]));
} else if (command === "patch") {
  if (!args[1] || !args[2]) throw new Error("BASE_JSONとPATCH_JSONを指定してください。");
  const output = option("--output");
  if (!output) throw new Error("--outputを指定してください。正本を直接上書きしません。");
  const base = await readJson(resolve(args[1]));
  const patch = await readJson(resolve(args[2]));
  const patchSchema = validateSchema("patch", patch);
  if (!patchSchema.valid) throw new Error(`patch schema v1.1違反: ${patchSchema.errors.join(" / ")}`);
  if (patch.schemaVersion !== 1 || patch.reportId !== base.reportId) throw new Error("patchのreportIdまたはschemaVersionが一致しません。");
  if (patch.baseRevision !== base.revision) throw new Error("baseRevisionが一致しません。最新版の正本からやり直してください。");
  const actualPaths = leafPaths(patch.changes).sort();
  const declaredPaths = [...(patch.changedFields ?? [])].sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(declaredPaths)) {
    throw new Error(`changedFieldsとchangesが一致しません。\n宣言: ${declaredPaths.join(", ")}\n実際: ${actualPaths.join(", ")}`);
  }
  const merged = deepMerge(base, patch.changes);
  merged.revision = new Date().toISOString();
  merged.status = "draft";
  merged.update = {
    mode: patch.patchMode ?? "patch",
    baseRevision: base.revision,
    reason: patch.reason,
    changedFields: patch.changedFields,
  };
  if (patch.deletedInfo) {
    merged.updateHistory = [...(merged.updateHistory ?? []), {
      updatedAt: new Date().toISOString().slice(0, 10),
      mode: patch.patchMode ?? "patch",
      summary: patch.reason,
      deletedInfo: patch.deletedInfo,
    }];
  }
  merged.validation = { status: "INFO_WARN", fail_count: 0, blocking_warn_count: 0, info_warn_count: 1, infoWarnMessages: ["patch適用後の再検証が必要"], humanReviewed: false, checks: [] };
  const validation = await validateReport(merged, config);
  if (["FAIL", "BLOCKING_WARN"].includes(validation.status)) {
    console.log(JSON.stringify(validation, null, 2));
    throw new Error("patch適用後にValidation FAILが発生しました。出力しません。");
  }
  await writeJson(resolve(output), merged);
  console.log(`部分更新版を別ファイルへ出力しました: ${resolve(output)}`);
} else {
  usage();
  throw new Error(`不明なコマンド: ${command}`);
}
