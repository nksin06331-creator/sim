import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256, stripHtml, writeJson } from "../report-system/src/common.mjs";
import { catalystPathForPortalStock, renderCatalyst, validateCatalystReport } from "../report-system/src/catalyst.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = await readJson(join(repoRoot, "report-system/config.json"));
const args = process.argv.slice(2);
const command = args[0];

function usage() {
  console.log(`SiM catalyst operations

  node scripts/catalyst-ops.mjs validate TICKER.catalyst.json
  node scripts/catalyst-ops.mjs preview TICKER.catalyst.json
  node scripts/catalyst-ops.mjs verify TICKER.catalyst.json
  node scripts/catalyst-ops.mjs stage TICKER.catalyst.json
  node scripts/catalyst-ops.mjs registry

previewとstageの出力先は_report-previewです。
公開中のstocks/とdata/catalyst-reports.jsonは変更しません。`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function safeCatalystPath(value) {
  return typeof value === "string"
    && !value.includes("..")
    && /^stocks\/[^/?#]+\/catalysts\.html$/.test(value);
}

async function portalStockForTicker(ticker) {
  const portalStocks = await readJson(join(repoRoot, config.portalManifestPath));
  return portalStocks.find((stock) => stock.ticker === ticker) ?? null;
}

async function buildPreview(reportPath) {
  const report = await readJson(reportPath);
  const validation = validateCatalystReport(report);
  if (validation.status === "FAIL") {
    console.log(JSON.stringify(validation, null, 2));
    throw new Error("Catalyst Validation FAILのためプレビューを生成しません。");
  }
  const template = await readFile(join(repoRoot, "report-system/templates/catalyst-shell.html"), "utf8");
  const html = renderCatalyst(report, template, validation);
  const portalStock = await portalStockForTicker(report.meta.ticker);
  const publicPath = catalystPathForPortalStock(portalStock, report.meta.ticker);
  const outDir = dirname(join(repoRoot, config.previewRoot, publicPath));
  const htmlPath = join(outDir, "catalysts.html");
  await mkdir(outDir, { recursive: true });
  await writeFile(htmlPath, html, "utf8");
  await writeJson(join(outDir, "catalyst-validation.json"), validation);
  return { report, validation, outDir, htmlPath, html, publicPath };
}

async function verify(reportPath) {
  const built = await buildPreview(reportPath);
  const checks = [
    {
      id: "HTML01_PLACEHOLDERS",
      status: /\{\{[A-Z0-9_]+\}\}/.test(built.html) ? "FAIL" : "PASS",
      message: "未置換プレースホルダーなし",
    },
    {
      id: "HTML02_LIVE_PRICE",
      status: built.html.includes("data-live-price")
        && built.html.includes("data-live-price-date")
        && built.html.includes("live-report-price.js")
        ? "PASS"
        : "FAIL",
      message: "ライブ株価は表示値だけを更新",
    },
    {
      id: "HTML03_NAVIGATION",
      status: built.html.includes('href="index.html"')
        && built.html.includes('href="scenario.html"')
        && built.html.includes('href="../../index.html"')
        ? "PASS"
        : "FAIL",
      message: "現行の企業ガイド・シナリオ・一覧URLと一致",
    },
    {
      id: "HTML04_TICKER",
      status: built.html.includes(`data-stock-ticker="${built.report.meta.ticker}"`) ? "PASS" : "FAIL",
      message: "ライブ株価ティッカーを保持",
    },
    {
      id: "HTML05_CONTENT",
      status: stripHtml(built.html).length >= 1200 ? "PASS" : "WARN",
      message: `本文 ${stripHtml(built.html).length}文字`,
    },
  ];
  const failCount = checks.filter((item) => item.status === "FAIL").length;
  const warnCount = checks.filter((item) => item.status === "WARN").length;
  const compatibility = {
    status: failCount ? "FAIL" : warnCount ? "WARN" : "PASS",
    failCount,
    warnCount,
    checks,
  };
  await writeJson(join(built.outDir, "catalyst-compatibility.json"), compatibility);
  console.log(JSON.stringify(compatibility, null, 2));
  if (failCount) process.exitCode = 1;
  return built;
}

async function validateRegistry() {
  const registryPath = join(repoRoot, config.catalystRegistryPath);
  const portalManifestPath = join(repoRoot, config.portalManifestPath);
  const registry = await readJson(registryPath);
  const portalStocks = await readJson(portalManifestPath);
  const portalTickers = new Set(portalStocks.map((stock) => stock.ticker));
  const reports = Array.isArray(registry.reports) ? registry.reports : [];
  const checks = [];
  const seen = new Set();

  checks.push({
    id: "REG01_SCHEMA",
    status: registry.schemaVersion === 1 && Array.isArray(registry.reports) ? "PASS" : "FAIL",
    message: "公開台帳schemaVersionは1",
  });
  for (const report of reports) {
    const ticker = report?.ticker ?? "UNKNOWN";
    const portalStock = portalStocks.find((stock) => stock.ticker === ticker);
    const expectedPath = catalystPathForPortalStock(portalStock, ticker);
    const duplicate = seen.has(ticker);
    seen.add(ticker);
    checks.push({
      id: `REG02_${ticker}`,
      status: /^[A-Z0-9.-]+$/.test(ticker) && !duplicate ? "PASS" : "FAIL",
      message: `${ticker}: ティッカー形式と重複を確認`,
    });
    checks.push({
      id: `REG03_${ticker}`,
      status: portalTickers.has(ticker) ? "PASS" : "FAIL",
      message: `${ticker}: 現行ポータルに存在`,
    });
    checks.push({
      id: `REG04_${ticker}`,
      status: safeCatalystPath(report.path) && report.path === expectedPath && ["draft", "published"].includes(report.status) ? "PASS" : "FAIL",
      message: `${ticker}: 既存銘柄フォルダと公開状態を確認`,
    });
    if (report.status !== "published") continue;
    checks.push({
      id: `REG05_${ticker}`,
      status: Boolean(report.reviewedBy && /^\d{4}-\d{2}-\d{2}$/.test(report.reviewedAt ?? "")) ? "PASS" : "FAIL",
      message: `${ticker}: 人による確認者と確認日を記録`,
    });
    const pagePath = join(repoRoot, report.path);
    if (!(await exists(pagePath))) {
      checks.push({ id: `REG06_${ticker}`, status: "FAIL", message: `${ticker}: ${report.path}が存在しない` });
      continue;
    }
    const html = await readFile(pagePath, "utf8");
    checks.push({
      id: `REG06_${ticker}`,
      status: html.includes(`data-stock-ticker="${ticker}"`)
        && html.includes("data-live-price")
        && !/\{\{[A-Z0-9_]+\}\}/.test(html)
        ? "PASS"
        : "FAIL",
      message: `${ticker}: 公開ページのティッカー・ライブ株価・置換完了を確認`,
    });
    const sourcePath = join(repoRoot, "report-system", "catalysts", `${ticker}.json`);
    if (!(await exists(sourcePath))) {
      checks.push({ id: `REG07_${ticker}`, status: "FAIL", message: `${ticker}: 更新用の正本JSONが存在しない` });
      continue;
    }
    const sourceReport = await readJson(sourcePath);
    const sourceValidation = validateCatalystReport(sourceReport);
    checks.push({
      id: `REG07_${ticker}`,
      status: sourceReport.meta?.ticker === ticker && sourceValidation.status !== "FAIL" ? "PASS" : "FAIL",
      message: `${ticker}: 更新用の正本JSONとCatalyst Validationを確認`,
    });
    if (sourceReport.meta?.ticker === ticker && sourceValidation.status !== "FAIL") {
      const template = await readFile(join(repoRoot, "report-system/templates/catalyst-shell.html"), "utf8");
      const generated = renderCatalyst(sourceReport, template, sourceValidation);
      checks.push({
        id: `REG08_${ticker}`,
        status: sha256(generated) === sha256(html) ? "PASS" : "FAIL",
        message: `${ticker}: 公開HTMLが正本JSONからの生成結果と一致`,
      });
    }
  }

  const failCount = checks.filter((item) => item.status === "FAIL").length;
  const warnCount = checks.filter((item) => item.status === "WARN").length;
  const result = {
    status: failCount ? "FAIL" : warnCount ? "WARN" : "PASS",
    failCount,
    warnCount,
    publishedCount: reports.filter((report) => report.status === "published").length,
    checks,
  };
  console.log(JSON.stringify(result, null, 2));
  if (failCount) process.exitCode = 1;
}

if (!command || ["help", "--help", "-h"].includes(command)) {
  usage();
} else if (command === "validate") {
  if (!args[1]) throw new Error("TICKER.catalyst.jsonを指定してください。");
  const validation = validateCatalystReport(await readJson(resolve(args[1])));
  console.log(JSON.stringify(validation, null, 2));
  if (validation.status === "FAIL") process.exitCode = 1;
} else if (command === "preview") {
  if (!args[1]) throw new Error("TICKER.catalyst.jsonを指定してください。");
  const built = await buildPreview(resolve(args[1]));
  console.log(`非公開プレビューを生成しました: ${built.htmlPath}`);
} else if (command === "verify") {
  if (!args[1]) throw new Error("TICKER.catalyst.jsonを指定してください。");
  await verify(resolve(args[1]));
} else if (command === "stage") {
  if (!args[1]) throw new Error("TICKER.catalyst.jsonを指定してください。");
  const built = await verify(resolve(args[1]));
  const entry = {
    ticker: built.report.meta.ticker,
    path: built.publicPath,
    status: "draft",
    reviewedBy: null,
    reviewedAt: null,
  };
  await writeJson(join(built.outDir, `${built.report.meta.ticker}.json`), built.report);
  await writeJson(join(built.outDir, "catalyst-registry-entry.json"), entry);
  console.log(`公開前の台帳エントリを生成しました: ${join(built.outDir, "catalyst-registry-entry.json")}`);
} else if (command === "registry") {
  await validateRegistry();
} else {
  usage();
  throw new Error(`不明なコマンド: ${command}`);
}
