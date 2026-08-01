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

function isBlockingValidation(validation) {
  const status = validation?.status;
  return status === "FAIL" || status === "BLOCKING_WARN" || Number(validation?.failCount ?? validation?.fail_count ?? 0) > 0 || Number(validation?.blockingWarnCount ?? validation?.blocking_warn_count ?? 0) > 0;
}

function encodeDocument(html) {
  return Buffer.from(html, "utf8").toString("base64");
}

function redirectHtml() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex,nofollow">
<title>リダイレクト中...</title>
<script>location.replace('index.html');<\/script>
</head>
<body><p>移動中... <a href="index.html">こちらをクリックして移動してください</a></p></body>
</html>`;
}

function unifiedHtml({ report, guideHtml, scenarioHtml, catalystHtml, catalystAvailable, infoWarnMessages }) {
  const guide = encodeDocument(guideHtml);
  const scenario = encodeDocument(scenarioHtml);
  const catalyst = catalystAvailable ? encodeDocument(catalystHtml) : "";
  const warning = infoWarnMessages.length
    ? `<div class="warn"><b>注意：</b>${infoWarnMessages.map((m) => String(m).replace(/[&<>\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))).join(" / ")}</div>`
    : "";
  const catalystButton = catalystAvailable
    ? `<button type="button" data-view-btn="catalyst">カタリスト</button>`
    : `<button type="button" disabled title="カタリストレポートは準備中です">カタリスト（準備中）</button>`;
  const catalystFrame = catalystAvailable
    ? `<iframe title="カタリスト" data-view="catalyst" hidden></iframe>`
    : `<section class="placeholder" data-view="catalyst" hidden><h2>カタリストレポートは準備中です</h2><p>企業ガイドと結論・シナリオは公開済みです。</p></section>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="description" content="${report.meta.companyName}（${report.meta.ticker}）の企業ガイド・株価シナリオ・カタリストレポート">
<title>${report.meta.ticker} ${report.meta.companyName}｜SiM MARKET LAB</title>
<style>
:root{color-scheme:dark;--bg:#0a0c0a;--surface:#141815;--line:rgba(255,255,255,.11);--ink:#f1f5f1;--muted:#9aa39a;--accent:#6ee24e;--amber:#fbbf24}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:"Noto Sans JP",system-ui,sans-serif}body{display:grid;grid-template-rows:auto auto 1fr;overflow:hidden}
header{padding:14px 18px 10px;border-bottom:1px solid var(--line);background:#0d100d}header b{letter-spacing:.12em}header span{color:var(--muted);font-size:12px;margin-left:10px}
nav{display:flex;gap:8px;padding:10px 14px;background:rgba(10,12,10,.96);border-bottom:1px solid var(--line);overflow:auto}button{border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:8px 14px;border-radius:999px;font-weight:700;white-space:nowrap;cursor:pointer}button.active{border-color:var(--accent);color:var(--accent);background:rgba(110,226,78,.12)}button:disabled{opacity:.45;cursor:not-allowed}.warn{padding:10px 16px;border-bottom:1px solid rgba(251,191,36,.35);background:rgba(251,191,36,.08);font-size:13px}.warn b{color:var(--amber)}main{min-height:0;position:relative}iframe{display:block;width:100%;height:100%;border:0;background:var(--bg)}[hidden]{display:none!important}.placeholder{padding:60px 20px;text-align:center;color:var(--muted)}.placeholder h2{color:var(--ink)}
</style>
</head>
<body>
<header><b>SiM MARKET LAB</b><span>${report.meta.companyName}（${report.meta.ticker}）</span></header>
${warning}
<nav aria-label="レポート切替">
<button type="button" class="active" data-view-btn="guide">企業ガイド</button>
<button type="button" data-view-btn="scenario">結論・シナリオ</button>
${catalystButton}
</nav>
<main>
<iframe title="企業ガイド" data-view="guide"></iframe>
<iframe title="結論・シナリオ" data-view="scenario" hidden></iframe>
${catalystFrame}
</main>
<script>
(function(){
'use strict';
const documents={guide:'${guide}',scenario:'${scenario}',catalyst:'${catalyst}'};
const decode=(value)=>decodeURIComponent(Array.prototype.map.call(atob(value),(c)=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
document.querySelectorAll('iframe[data-view]').forEach((frame)=>{const value=documents[frame.dataset.view];if(value)frame.srcdoc=decode(value);});
const buttons=document.querySelectorAll('[data-view-btn]');
const views=document.querySelectorAll('[data-view]');
function showView(name){views.forEach((view)=>{view.hidden=view.dataset.view!==name;});buttons.forEach((button)=>{const active=button.dataset.viewBtn===name;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');});}
buttons.forEach((button)=>button.addEventListener('click',()=>showView(button.dataset.viewBtn)));
showView('guide');
})();
<\/script>
</body>
</html>`;
}

const report = await readJson(reportPath);
const ticker = report?.meta?.ticker;
if (!ticker || report.reportId !== ticker) throw new Error("reportIdとmeta.tickerが一致しません。");

const reportValidation = await validateReport(report, config);
if (isBlockingValidation(reportValidation)) {
  console.log(JSON.stringify(reportValidation, null, 2));
  throw new Error(`${ticker}: 通常レポートにFAILまたはBLOCKING_WARNがあります。`);
}

const catalystCandidates = [
  join(root, "report-system", "catalysts", `${ticker}.catalyst.json`),
  join(root, "report-system", "catalysts", `${ticker}.json`),
  join(root, "report-system", "reports", `${ticker}.catalyst.json`),
];
const catalystIndex = (await Promise.all(catalystCandidates.map(exists))).findIndex(Boolean);
let catalyst = null;
let catalystValidation = null;
let catalystAvailable = false;
if (catalystIndex >= 0) {
  catalyst = await readJson(catalystCandidates[catalystIndex]);
  if (catalyst?.meta?.ticker !== ticker) throw new Error(`${ticker}: カタリストJSONのティッカーが一致しません。`);
  catalystValidation = validateCatalystReport(catalyst);
  catalystAvailable = !isBlockingValidation(catalystValidation);
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
const catalystHtml = catalystAvailable ? renderCatalyst(catalyst, catalystTemplate, catalystValidation) : "";

for (const [name, html] of [["guide", guideHtml], ["scenario", scenarioHtml], ...(catalystAvailable ? [["catalyst", catalystHtml]] : [])]) {
  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) throw new Error(`${ticker}/${name}: 未置換プレースホルダーがあります。`);
}

const infoWarnMessages = [
  ...(reportValidation?.infoWarnMessages ?? report?.validation?.infoWarnMessages ?? []),
  ...(catalystValidation?.infoWarnMessages ?? []),
];
const html = unifiedHtml({ report, guideHtml, scenarioHtml, catalystHtml, catalystAvailable, infoWarnMessages });
const redirect = redirectHtml();
const outDir = join(root, "stocks", ticker);
await mkdir(outDir, { recursive: true });
await Promise.all([
  writeFile(join(outDir, "index.html"), html, "utf8"),
  writeFile(join(outDir, `${ticker}.html`), redirect, "utf8"),
  writeFile(join(outDir, "catalysts.html"), redirect, "utf8"),
]);

const published = structuredClone(report);
published.status = "published";
published.validation = {
  ...published.validation,
  status: infoWarnMessages.length ? "INFO_WARN" : "PASS",
  fail_count: 0,
  blocking_warn_count: 0,
  info_warn_count: infoWarnMessages.length,
  infoWarnMessages,
  machinePublished: true,
};
await mkdir(join(root, "report-system", "published"), { recursive: true });
await writeJson(join(root, "report-system", "published", `${ticker}.report.json`), published);

const scenarios = Object.fromEntries(report.scenario.scenarios.map((item) => [item.name.toLowerCase(), item.price]));
const market = report.meta.market === "JP" ? "日本株" : "米国株";
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
  catalyst: catalyst?.summary?.one_line ?? "カタリストレポートは準備中です",
  summary: report.scenario.decision.oneLine,
  tags: report.overview.heroTags,
  risk: report.scenario.risk.riskClass,
  detailPath: `stocks/${ticker}/index.html`,
  scenarioPath: `stocks/${ticker}/index.html`,
  catalystPath: `stocks/${ticker}/index.html`,
  sourceRevision: report.revision,
};
await writeJson(join(outDir, "meta.json"), meta);
console.log(`${ticker}: 統合レポート、旧URLリダイレクト、meta.json、公開用正本を生成しました。`);
