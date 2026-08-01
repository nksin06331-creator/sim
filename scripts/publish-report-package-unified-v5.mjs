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
if (!reportPath) throw new Error("使い方: node scripts/publish-report-package-unified-v5.mjs report-system/reports/TICKER.report.json");

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}
function isBlocking(validation) {
  return validation?.status === "FAIL"
    || validation?.status === "BLOCKING_WARN"
    || Number(validation?.fail_count ?? validation?.failCount ?? 0) > 0
    || Number(validation?.blocking_warn_count ?? validation?.blockingWarnCount ?? 0) > 0;
}
function esc(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function extractDocument(html) {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  let body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  body = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<a\b[^>]*href=["'](?:4015\.html|catalysts\.html|scenario\.html)["'][^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/\s+id=["']progressBar["']/gi, "");
  return { styles, body };
}
function redirectHtml() {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="robots" content="noindex,nofollow"><title>移動中</title><script>location.replace('index.html');<\/script></head><body><a href="index.html">移動</a></body></html>`;
}
function unifiedHtml({ report, guideHtml, scenarioHtml, catalystHtml, catalystAvailable, infoWarnMessages }) {
  const guide = extractDocument(guideHtml);
  const scenario = extractDocument(scenarioHtml);
  const catalyst = catalystAvailable ? extractDocument(catalystHtml) : { styles: "", body: "" };
  const tags = (report.overview?.heroTags ?? []).map((tag) => `<span class="hero-tag">${esc(tag)}</span>`).join("");
  const stats = (report.overview?.heroStats ?? []).map((item) => `<div class="shell-kpi"><span>${esc(item.label)}</span><b>${esc(item.value)}</b><small>${esc(item.note)}</small></div>`).join("");
  const warning = infoWarnMessages.length ? `<div class="info-warn"><b>注意：</b>${infoWarnMessages.map(esc).join(" / ")}</div>` : "";
  const catalystBody = catalystAvailable
    ? catalyst.body
    : `<div class="placeholder"><h2>カタリストレポートは準備中です</h2><p>企業ガイドと株価シナリオは公開済みです。</p></div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="description" content="${esc(report.meta.companyName)}（${esc(report.meta.ticker)}）の企業ガイド・株価シナリオ・カタリストレポート">
<title>${esc(report.meta.ticker)} ${esc(report.meta.companyName)}｜SiM MARKET LAB</title>
<style>
${guide.styles}
${scenario.styles}
${catalyst.styles}
:root{--sim-accent:#6EE24E;--sim-bg:#0a0c0a;--sim-surface:#141815;--sim-line:rgba(255,255,255,.1);--sim-ink:#f1f5f1;--sim-muted:#98a198;--sim-amber:#fbbf24}
html{scroll-behavior:auto}body{margin:0!important;background:var(--sim-bg)!important;color:var(--sim-ink)!important;overflow-x:hidden!important;height:auto!important;display:block!important}
.sim-shell-hero{padding:46px 20px 30px;background:radial-gradient(100% 100% at 50% 0%,#173320 0%,#0b100c 52%,#0a0c0a 100%);border-bottom:1px solid var(--sim-line)}
.sim-wrap{max-width:1040px;margin:auto}.sim-brand{font-weight:800;letter-spacing:.16em;color:var(--sim-muted);font-size:12px}.sim-shell-hero h1{font-size:clamp(32px,6vw,58px);line-height:1.1;margin:18px 0 10px;color:#fff}.sim-shell-hero h1 small{font-size:.34em;background:var(--sim-accent);color:#08220c;padding:5px 10px;border-radius:8px;vertical-align:middle}.sim-sub{color:var(--sim-muted);font-size:13px}.shell-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.hero-tag{padding:5px 10px;border-radius:999px;border:1px solid rgba(110,226,78,.35);background:rgba(110,226,78,.1);color:var(--sim-accent);font-size:11px;font-weight:700}.shell-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.shell-kpi{padding:15px;border-radius:14px;background:var(--sim-surface);border:1px solid var(--sim-line)}.shell-kpi span,.shell-kpi small{display:block;color:var(--sim-muted);font-size:11px}.shell-kpi b{display:block;font-size:22px;margin:5px 0;color:#fff}
.sim-tabs{position:sticky;top:0;z-index:9999;display:flex;gap:7px;padding:9px max(12px,calc((100% - 1040px)/2 + 20px));background:rgba(10,12,10,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--sim-line);overflow:auto}.sim-tabs button{border:1px solid var(--sim-line);background:var(--sim-surface);color:#fff;padding:8px 14px;border-radius:999px;font-weight:700;cursor:pointer;white-space:nowrap}.sim-tabs button.active{border-color:var(--sim-accent);color:var(--sim-accent);background:rgba(110,226,78,.12)}
.info-warn{max-width:1000px;margin:14px auto;padding:12px 15px;border-left:4px solid var(--sim-amber);border-radius:10px;background:rgba(251,191,36,.08);font-size:13px}.info-warn b{color:var(--sim-amber)}
.sim-view{min-height:60vh}.sim-view[hidden]{display:none!important}.sim-view>header:first-child{margin-top:0}.placeholder{max-width:760px;margin:50px auto;padding:48px 20px;text-align:center;color:var(--sim-muted);border:1px solid var(--sim-line);border-radius:18px;background:var(--sim-surface)}.placeholder h2{color:#fff}
@media(max-width:720px){.shell-kpis{grid-template-columns:1fr 1fr}.sim-shell-hero{padding:30px 14px 22px}.sim-tabs{padding:8px 12px}}
</style>
</head>
<body data-stock-ticker="${esc(report.meta.ticker)}" data-price-source="../../data/prices.json">
<header class="sim-shell-hero"><div class="sim-wrap"><div class="sim-brand">SiM MARKET LAB / UNIFIED REPORT</div><h1>${esc(report.meta.companyName)} <small>${esc(report.meta.ticker)}</small></h1><div class="sim-sub">${esc(report.meta.exchange)}｜評価基準日 ${esc(report.meta.valuationDate)}｜最終更新 ${esc(report.meta.lastUpdated)}</div><div class="shell-kpis">${stats}</div><div class="shell-tags">${tags}</div></div></header>
${warning}
<nav class="sim-tabs" aria-label="レポート切替"><button type="button" class="active" data-view-btn="guide">企業ガイド</button><button type="button" data-view-btn="scenario">結論・シナリオ</button><button type="button" data-view-btn="catalyst">カタリスト${catalystAvailable ? "" : "（準備中）"}</button></nav>
<section class="sim-view" data-view="guide">${guide.body}</section>
<section class="sim-view" data-view="scenario" hidden>${scenario.body}</section>
<section class="sim-view" data-view="catalyst" hidden>${catalystBody}</section>
<script src="../../lab/assets/js/live-report-price.js" defer><\/script>
<script>(function(){'use strict';const views=document.querySelectorAll('[data-view]');const buttons=document.querySelectorAll('[data-view-btn]');function show(name){views.forEach(v=>v.hidden=v.dataset.view!==name);buttons.forEach(b=>{const active=b.dataset.viewBtn===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false')});window.scrollTo({top:0,behavior:'smooth'})}buttons.forEach(b=>b.addEventListener('click',()=>show(b.dataset.viewBtn)));document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const t=document.getElementById(a.getAttribute('href').slice(1));if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'})}}));show('guide')})();<\/script>
</body></html>`;
}

const report = await readJson(reportPath);
const ticker = report?.meta?.ticker;
if (!ticker || report.reportId !== ticker) throw new Error("reportIdとmeta.tickerが一致しません。");
const reportValidation = await validateReport(report, config);
if (isBlocking(reportValidation)) throw new Error(`${ticker}: 通常レポートにFAILまたはBLOCKING_WARNがあります。`);

const candidates = [join(root,"report-system","catalysts",`${ticker}.catalyst.json`),join(root,"report-system","catalysts",`${ticker}.json`),join(root,"report-system","reports",`${ticker}.catalyst.json`)];
const index = (await Promise.all(candidates.map(exists))).findIndex(Boolean);
let catalyst = null; let catalystValidation = null; let catalystAvailable = false;
if (index >= 0) { catalyst = await readJson(candidates[index]); catalystValidation = validateCatalystReport(catalyst); catalystAvailable = !isBlocking(catalystValidation); }
const [guideCss,scenarioCss,catalystTemplate] = await Promise.all([readFile(join(root,config.assets.guideCss),"utf8"),readFile(join(root,config.assets.scenarioCss),"utf8"),readFile(join(root,"report-system/templates/catalyst-shell.html"),"utf8")]);
const [guideHtml,scenarioHtml] = await Promise.all([renderGuide(report,guideCss),renderScenario(report,scenarioCss)]);
const catalystHtml = catalystAvailable ? renderCatalyst(catalyst,catalystTemplate,catalystValidation) : "";
const infoWarnMessages = [...(reportValidation?.infoWarnMessages ?? report.validation?.infoWarnMessages ?? []),...(catalystValidation?.infoWarnMessages ?? [])];
const html = unifiedHtml({report,guideHtml,scenarioHtml,catalystHtml,catalystAvailable,infoWarnMessages});
if (/<iframe\b/i.test(html)) throw new Error(`${ticker}: iframeは使用できません。`);
if (/\{\{[A-Z0-9_]+\}\}/.test(html)) throw new Error(`${ticker}: 未置換プレースホルダーがあります。`);
const outDir = join(root,"stocks",ticker); await mkdir(outDir,{recursive:true});
await Promise.all([writeFile(join(outDir,"index.html"),html,"utf8"),writeFile(join(outDir,`${ticker}.html`),redirectHtml(),"utf8"),writeFile(join(outDir,"catalysts.html"),redirectHtml(),"utf8")]);
const published = structuredClone(report); published.status="published"; published.validation={...published.validation,status:infoWarnMessages.length?"INFO_WARN":"PASS",fail_count:0,blocking_warn_count:0,info_warn_count:infoWarnMessages.length,infoWarnMessages,machinePublished:true};
await mkdir(join(root,"report-system","published"),{recursive:true}); await writeJson(join(root,"report-system","published",`${ticker}.report.json`),published);
const scenarios=Object.fromEntries(report.scenario.scenarios.map((item)=>[item.name.toLowerCase(),item.price]));
await writeJson(join(outDir,"meta.json"),{schemaVersion:1,ticker,slug:ticker.toLowerCase(),name:report.meta.companyName,market:report.meta.market==="JP"?"日本株":"米国株",sector:report.meta.sector,method:report.scenario.valuation.method,status:"published",updated:report.meta.lastUpdated,price:{current:report.scenario.valuation.currentPrice,currency:report.meta.currency},scenarios,positionPct:Number(report.scenario.positioning?.bandPositionPct??0),zone:String(report.scenario.positioning?.zoneJudge??report.scenario.decision.valuationView),riskReward:String(report.scenario.positioning?.endpointRiskReward??"—"),catalyst:catalyst?.summary?.one_line??"カタリストレポートは準備中です",summary:report.scenario.decision.oneLine,tags:report.overview.heroTags,risk:report.scenario.risk.riskClass,detailPath:`stocks/${ticker}/index.html`,scenarioPath:`stocks/${ticker}/index.html`,catalystPath:`stocks/${ticker}/index.html`,sourceRevision:report.revision});
console.log(`${ticker}: iframeなしの統合レポートを生成しました。`);
