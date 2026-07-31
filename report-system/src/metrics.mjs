import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { sha256, stripHtml } from "./common.mjs";

export function htmlMetrics(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const sourceLinks = [...html.matchAll(/<a\b[^>]*href=["']https:\/\//gi)].length;
  return {
    sha256: sha256(html),
    characters: html.length,
    textCharacters: stripHtml(body).length,
    sections: (html.match(/<section\b/gi) ?? []).length,
    details: (html.match(/<details\b/gi) ?? []).length,
    tables: (html.match(/<table\b/gi) ?? []).length,
    sourceLinks,
    livePriceMarkers: (html.match(/data-live-price\b/gi) ?? []).length,
  };
}

export async function baselineForStocks(stocksRoot) {
  const folders = (await readdir(stocksRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ja"));
  const reports = {};
  for (const folder of folders) {
    const result = {};
    for (const [kind, fileName] of [["guide", "index.html"], ["scenario", "scenario.html"]]) {
      try {
        const html = await readFile(join(stocksRoot, folder, fileName), "utf8");
        result[kind] = htmlMetrics(html);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (result.guide || result.scenario) reports[folder] = result;
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    reportCount: Object.keys(reports).length,
    reports,
  };
}

export function compareMetrics(current, baseline, config) {
  const checks = [];
  const warnRatio = config.coverage.existing.warnTextRatio;
  const failRatio = config.coverage.existing.failTextRatio;
  const failSourceRatio = config.coverage.existing.failSourceRatio;
  for (const kind of ["guide", "scenario"]) {
    if (!baseline?.[kind] || !current?.[kind]) continue;
    const textRatio = current[kind].textCharacters / Math.max(1, baseline[kind].textCharacters);
    const sourceRatio = baseline[kind].sourceLinks
      ? current[kind].sourceLinks / baseline[kind].sourceLinks
      : 1;
    checks.push({
      id: `COVERAGE_${kind.toUpperCase()}_TEXT`,
      status: textRatio < failRatio ? "FAIL" : textRatio < warnRatio ? "WARN" : "PASS",
      message: `${kind}本文量 ${Math.round(textRatio * 100)}%（基準 ${baseline[kind].textCharacters}文字）`,
    });
    checks.push({
      id: `COVERAGE_${kind.toUpperCase()}_SOURCES`,
      status: sourceRatio < failSourceRatio ? "FAIL" : "PASS",
      message: `${kind}外部出典リンク ${current[kind].sourceLinks}/${baseline[kind].sourceLinks}`,
    });
    checks.push({
      id: `COVERAGE_${kind.toUpperCase()}_STRUCTURE`,
      status: current[kind].sections < Math.max(1, baseline[kind].sections - 1) ? "WARN" : "PASS",
      message: `${kind}セクション ${current[kind].sections}/${baseline[kind].sections}`,
    });
  }
  return checks;
}
