import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { escapeHtml as h, formatPct, formatPrice, renderTemplate, repoRoot } from "./common.mjs";

function htmlList(items, className = "clean") {
  return `<ul class="${className}">${(items ?? []).map((item) => `<li>${h(item)}</li>`).join("")}</ul>`;
}

function renderTable(columns = [], rows = []) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${h(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderBlock(block) {
  const title = block.title ? `<div class="block-label">${h(block.title)}</div>` : "";
  if (block.type === "facts") {
    return `${title}<dl class="facts">${(block.items ?? []).map((item) => `<div><dt>${h(item.label)}</dt><dd>${h(item.value)}</dd></div>`).join("")}</dl>`;
  }
  if (block.type === "cards") {
    return `${title}<div class="card-grid">${(block.items ?? []).map((item) => `<div class="card-sm"><span class="card-emoji">${h(item.icon ?? "●")}</span><div class="card-title">${h(item.title)}</div><div class="card-desc">${h(item.description)}</div></div>`).join("")}</div>`;
  }
  if (block.type === "keypoints") {
    return `${title}<ul class="keypoints">${(block.items ?? []).map((item) => `<li><span class="kp-emoji">${h(item.icon ?? "●")}</span><span class="kp-text"><b>${h(item.title)}</b>：${h(item.text)}</span></li>`).join("")}</ul>`;
  }
  if (block.type === "terms") {
    return `${title}<div class="term-list">${(block.items ?? []).map((item) => `<details class="term-item"><summary class="term-header"><span class="term-name">${h(item.term)}<span class="term-en">${h(item.english ?? "")}</span></span><span class="term-arrow">⌄</span></summary><div class="term-body"><p><b>定義：</b>${h(item.definition)}<br><b>なぜ重要：</b>${h(item.whyImportant)}<br><b>この銘柄では：</b>${h(item.companyContext)}</p></div></details>`).join("")}</div>`;
  }
  if (block.type === "products") {
    return `${title}<div class="product-grid">${(block.items ?? []).map((item) => `<div class="product-box"><div class="product-symbol">${h(item.symbol ?? "")}</div><div class="product-name">${h(item.name)}</div><div class="product-use">${h(item.use)}</div></div>`).join("")}</div>`;
  }
  if (["comparison", "table"].includes(block.type)) {
    return `${title}${renderTable(block.columns ?? [], block.rows ?? [])}`;
  }
  if (block.type === "timeline") {
    return `${title}<div class="timeline">${(block.items ?? []).map((item) => `<div class="tl-item"><div class="tl-dot"></div><div class="tl-content"><div class="tl-title">${h(item.title)} <span class="signal ${h(item.signal ?? "neutral")}">${h(item.status ?? "")}</span></div><div class="tl-date">${h(item.timing ?? "")}</div><p>${h(item.description ?? "")}</p></div></div>`).join("")}</div>`;
  }
  if (block.type === "risk-grid") {
    return `${title}<div class="info-row">${(block.items ?? []).map((item) => `<div class="info-box"><h3>${h(item.title)}</h3><p>${h(item.text)}</p></div>`).join("")}</div>`;
  }
  if (block.type === "highlight") {
    return `<div class="highlight"><h3>${h(block.title ?? "重要ポイント")}</h3><p>${h(block.text ?? "")}</p></div>`;
  }
  if (block.type === "paragraphs") {
    return `${title}${(block.paragraphs ?? []).map((text) => `<p class="lead">${h(text)}</p>`).join("")}`;
  }
  if (block.type === "custom") {
    const items = block.items?.length ? htmlList(block.items) : "";
    return `<div class="card"><h3>${h(block.title ?? "追加情報")}</h3><p>${h(block.text ?? block.payload?.summary ?? "")}</p>${items}</div>`;
  }
  return "";
}

function renderGuideSection(section, index) {
  const summaries = (section.summaryItems ?? []).map((item) => `<li data-emoji="●">${h(item)}</li>`).join("");
  return `<section class="section" id="${h(section.id)}">
  <div class="section-header"><div class="section-icon">${h(section.icon ?? "●")}</div><div class="section-num">${index + 1}</div><div><div class="section-title">${h(section.title)}</div><div class="section-sub">${h(section.subtitle ?? "")}</div></div></div>
  <div class="tldr"><div class="tldr-label">⚡ このセクションの3秒まとめ</div><ul>${summaries}</ul></div>
  ${(section.blocks ?? []).map(renderBlock).join("\n")}
</section>`;
}

function renderSources(sources) {
  if (!sources?.length) return "";
  return `<section class="section" id="sources"><div class="section-header"><div class="section-icon">🔗</div><div><div class="section-title">主要出典</div><div class="section-sub">数値と事実の確認元</div></div></div><div class="term-list">${sources.map((source) => `<details class="term-item"><summary class="term-header"><span class="term-name">${h(source.title)}</span><span class="term-arrow">⌄</span></summary><div class="term-body"><p>${h(source.publisher)}｜${h(source.publishedAt ?? source.accessedAt)}</p><p><a href="${h(source.url)}">${h(source.url)}</a></p></div></details>`).join("")}</div></section>`;
}

export async function renderGuide(report, css) {
  const template = await readFile(join(repoRoot, "report-system/templates/guide-shell.html"), "utf8");
  const allSections = [...report.guide.sections];
  const extras = report.guide.extraSections ?? [];
  const stats = report.overview.heroStats.map((stat) => {
    const live = stat.livePrice ? " data-live-price" : "";
    const date = stat.livePrice ? ` data-live-price-date>${h(stat.note ?? `${report.meta.valuationDate}・分析基準値`)}` : `>${h(stat.note ?? "")}`;
    return `<div class="stat"><div class="stat-value ${h(stat.tone ?? "")}"${live}>${h(stat.value)}</div><div class="stat-label">${h(stat.label)}${stat.livePrice ? ' <span class="g">LIVE</span>' : ""}</div><div class="stat-note"${date}</div></div>`;
  }).join("");
  const hero = `<div class="hero"><div class="brandmark">S<span class="g">i</span>M &nbsp;MARKET LAB</div><div class="hero-badge">${h(report.meta.ticker)} 完全入門ガイド ・ ${h(report.meta.lastUpdated)}版</div><h1>${h(report.meta.companyName)}（${h(report.meta.ticker)}）を<br><span class="g">まるっと</span>解説</h1><p>${h(report.overview.tagline)}</p><div class="hero-tags">${report.overview.heroTags.map((tag) => `<span class="hero-tag">${h(tag)}</span>`).join("")}</div></div>`;
  const summary = `<div class="tldr-hero"><div class="tldr-hero-inner"><div class="tldr-hero-title">📊 まずは数字でざっくり</div><div class="stat-strip">${stats}</div></div></div>`;
  const nav = `<nav class="nav-index"><div class="nav-inner">${[...allSections, ...extras].map((section, index) => `<a class="nav-item" href="#${h(section.id)}">${index + 1} ${h(section.title)}</a>`).join("")}<a class="nav-item" href="#sources">出典</a></div></nav>`;
  return renderTemplate(template, {
    TITLE: `${report.meta.ticker} 完全入門ガイド`,
    STYLE: css,
    TICKER: report.meta.ticker,
    HERO: hero,
    HERO_SUMMARY: summary,
    NAV: nav,
    SECTIONS: allSections.map(renderGuideSection).join("\n"),
    EXTRA_SECTIONS: extras.map((section, index) => renderGuideSection(section, allSections.length + index)).join("\n"),
    SOURCES: renderSources(report.sources),
    DISCLAIMER: `<section class="section"><div class="highlight"><h3>免責</h3><p>${h(report.scenario.disclaimer)}</p></div></section>`,
    FOOTER: `SiM MARKET LAB｜評価基準日 ${h(report.meta.valuationDate)}｜最終更新 ${h(report.meta.lastUpdated)}`,
  });
}

function scenarioByName(report, name) {
  return report.scenario.scenarios.find((item) => item.name === name);
}

function renderScenarioCard(item, current, currency) {
  const tone = item.name.toLowerCase();
  const delta = (item.price / current - 1) * 100;
  return `<article class="scenario ${tone}"><div class="scenario-head"><span>${h(item.name)}</span><b>${h(item.probability)}%</b></div><div class="scenario-price">${formatPrice(item.price, currency)}</div><div class="small">現値比 ${formatPct(delta)}</div><dl>${(item.details ?? []).map((detail) => `<div><dt>${h(detail.label)}</dt><dd>${h(detail.value)}</dd></div>`).join("")}</dl></article>`;
}

function renderSignals(items) {
  return (items ?? []).map((item) => `<div class="signal"><div><b>${h(item.title)}</b><span class="${h(item.signal ?? "flat")}">${item.signal === "up" ? "追い風" : item.signal === "down" ? "注意" : "要確認"}</span></div><p>${h(item.description)}</p></div>`).join("");
}

function renderScenarioExtras(items) {
  return (items ?? []).map((section) => `<section class="card" id="${h(section.id)}"><h2>${h(section.title)}</h2><p class="lead">${h((section.summaryItems ?? []).join(" / "))}</p>${(section.blocks ?? []).map(renderBlock).join("")}</section>`).join("");
}

export async function renderScenario(report, css) {
  const template = await readFile(join(repoRoot, "report-system/templates/scenario-shell.html"), "utf8");
  const data = report.scenario;
  const currency = data.valuation.currency;
  const current = data.valuation.currentPrice;
  const bear = scenarioByName(report, "Bear");
  const base = scenarioByName(report, "Base");
  const bull = scenarioByName(report, "Bull");
  const position = Number(data.positioning.bandPositionPct ?? 0);
  const warning = report.validation?.status === "WARN"
    ? `<div class="wrap"><div class="notice" style="margin-top:14px"><b>注意：</b>${h(report.validation.summary ?? "一部に確認事項があります。")}</div></div>`
    : "";
  const hero = `<header class="hero"><div class="wrap"><div class="eyebrow">S<span style="color:#fff">i</span>M MARKET LAB / PRICE SCENARIO</div><h1>${h(report.meta.companyName)} <small>${h(report.meta.ticker)}</small></h1><div class="sub">${h(report.meta.exchange)}｜評価基準日 ${h(report.meta.valuationDate)}｜使用手法 ${h(data.valuation.method)}</div><div class="verdict"><div class="verdict-main"><span class="pill">まず結論だけ</span><div class="status">${h(data.decision.status)}</div><p>${h(data.decision.oneLine)}</p><p class="sub">${h(data.decision.valuationView)}</p></div><div class="score"><small>総合スコア（補助指標）</small><b>${h(data.decision.score)}</b><small>/ 100　売買判断そのものではありません</small></div></div><div class="kpis"><div class="kpi"><span>現在株価 <em style="font-style:normal;color:var(--accent);font-size:10px">LIVE</em></span><b data-live-price>${formatPrice(current, currency)}</b><small data-live-price-date>${h(data.valuation.currentPriceNote ?? `${report.meta.valuationDate}・分析基準値`)}</small></div><div class="kpi"><span>Base価値</span><b>${formatPrice(base.price, currency)}</b><small>${formatPct((base.price / current - 1) * 100)}</small></div><div class="kpi"><span>確率加重期待値</span><b>${formatPrice(data.valuation.expectedValue, currency)}</b><small>${formatPct(data.valuation.expectedReturnPct)}</small></div><div class="kpi"><span>リスク区分</span><b>${h(data.risk.riskClass)}</b><small>${h(data.risk.items.slice(0, 2).map((item) => item.title).join("・"))}</small></div></div></div></header>`;
  const nav = `<nav class="report-nav"><div class="wrap"><a href="#snapshot">結論</a><a href="#scenarios">3シナリオ</a><a href="#logic">計算</a><a href="#assumptions">前提</a><a href="#sources">出典</a></div></nav>`;
  const snapshot = `<section class="card" id="snapshot"><h2>いまの株価、どこにいる？</h2><p class="lead">${h(data.entryContext.pricedInNote)}</p><div class="grid-2"><div><h3>現値ポジショニング</h3><p>${h(data.positioning.interpretation ?? "")}</p><div class="position"><div class="position-line"><i class="pin" style="left:${Math.min(100, Math.max(0, position))}%"></i></div><div class="position-labels"><span>Bear ${formatPrice(bear.price, currency)}</span><span>Base ${formatPrice(base.price, currency)}</span><span>Bull ${formatPrice(bull.price, currency)}</span></div></div></div><div><h3>市場は何を織り込む？</h3><p>${h(data.marketReverse.conclusion ?? "")}</p><p class="small">直近20営業日 ${formatPct(data.entryContext.recent20dChangePct)}｜起点：${h(data.entryContext.moveTrigger)}</p></div></div></section>`;
  const scenarios = `<section class="card" id="scenarios"><h2>未来はこの3パターン</h2><p class="lead">${h(data.calculation.summary ?? data.valuation.method)}</p><div class="scenarios">${data.scenarios.map((item) => renderScenarioCard(item, current, currency)).join("")}</div></section>`;
  const zones = data.positioning.priceZones ?? [
    { range: `${formatPrice(bear.price, currency)}未満`, note: "悲観ケース以下。前提の崩れを確認。" },
    { range: `${formatPrice(bear.price, currency)}–${formatPrice(base.price, currency)}`, note: "Bear〜Base帯。主要KPIを確認。" },
    { range: `${formatPrice(base.price, currency)}–${formatPrice(bull.price, currency)}`, note: "Base〜Bull帯。強気前提の実現度を確認。" },
    { range: `${formatPrice(bull.price, currency)}超`, note: "強気ケース超。追加の上振れ前提が必要。" },
  ];
  const priceZones = `<section class="grid-2"><div class="card"><h2>この値段ならどう見る？</h2>${zones.map((zone) => `<div class="zone"><div><b>${h(zone.range)}</b></div><p>${h(zone.note)}</p></div>`).join("")}</div><div class="card"><h2>次の主要カタリスト</h2>${data.entryContext.catalysts.map((item) => `<div class="signal"><div><b>${h(item.title)}</b><span class="flat">★${h(item.importance)}</span></div><p>${h(item.timing)}｜成功時：${h(item.successImpact)}｜失敗時：${h(item.failureImpact)}</p></div>`).join("")}</div></section>`;
  const signals = `<section class="card"><h2>次に見る数字</h2>${renderSignals(data.watchItems)}</section>`;
  const positivesConcerns = `<section class="grid-2"><div class="card"><h2>ここは普通に強い</h2>${htmlList(data.positives)}</div><div class="card"><h2>ここで事故るかも</h2>${htmlList(data.concerns)}</div></section>`;
  const calculation = `<section class="card" id="logic"><h2>数字の作り方</h2><p class="lead">${h(data.calculation.summary ?? "")}</p>${renderTable(data.calculation.columns ?? [], data.calculation.rows ?? [])}<p class="notice"><b>重要：</b>${h(data.calculation.notice ?? "表示値は仮定に依存します。")}</p></section>`;
  const conditions = `<section class="card"><h2>この未来になる条件</h2>${data.scenarios.map((item) => `<details${item.name === "Base" ? " open" : ""}><summary>${h(item.name)}：${formatPrice(item.price, currency)} / 確率${h(item.probability)}%</summary><p>${h(item.conditions.join(" "))}</p></details>`).join("")}</section>`;
  const sensitivity = `<section class="grid-2"><div class="card"><h2>数字がズレるとどうなる？</h2>${renderTable(data.calculation.sensitivity?.columns ?? [], data.calculation.sensitivity?.rows ?? [])}<p class="small">${h(data.calculation.sensitivity?.note ?? "")}</p></div><div class="card"><h2>どの価格に行きやすい？</h2>${data.scenarios.map((item) => `<div class="dist-row"><span>${h(item.name)} ${formatPrice(item.price, currency)}</span><div class="track"><i style="width:${h(item.probability)}%"></i></div><b>${h(item.probability)}%</b></div>`).join("")}<p>確率は予言ではなく、仮定の重みです。</p></div></section>`;
  const watchItems = `<section class="card"><h2>次の決算で見る場所</h2>${renderSignals(data.watchItems)}</section>`;
  const assumptions = `<section class="card" id="assumptions"><h2>使った数字と前提</h2>${renderTable(["項目", "値", "分類", "注記"], data.assumptions.map((item) => [item.item, item.value, item.classification, item.note]))}</section>`;
  const deepDive = `<section class="card"><h2>ガチ勢向けの深掘り</h2>${data.deepDive.map((item) => `<details><summary>${h(item.title)}</summary><p>${h(item.content)}</p></details>`).join("")}</section>`;
  const sources = `<section class="card" id="sources"><h2>主要出典</h2><details><summary>出典一覧</summary><ul>${report.sources.map((source) => `<li><a href="${h(source.url)}">${h(source.publisher)}｜${h(source.title)}</a></li>`).join("")}</ul></details></section>`;
  return renderTemplate(template, {
    TITLE: `${report.meta.ticker} 株価シナリオ`,
    STYLE: css,
    TICKER: report.meta.ticker,
    HERO: hero,
    WARNING: warning,
    NAV: nav,
    SNAPSHOT: snapshot,
    SCENARIOS: scenarios,
    PRICE_ZONES: priceZones,
    SIGNALS: signals,
    POSITIVES_CONCERNS: positivesConcerns,
    CALCULATION: calculation,
    CONDITIONS: conditions,
    SENSITIVITY: sensitivity,
    WATCH_ITEMS: watchItems,
    ASSUMPTIONS: assumptions,
    DEEP_DIVE: deepDive,
    EXTRA_SECTIONS: renderScenarioExtras(data.extraSections),
    SOURCES: sources,
    DISCLAIMER: `<section class="card notice"><h3>免責</h3><p>${h(data.disclaimer)}</p></section>`,
    FOOTER: `SiM MARKET LAB｜評価基準日 ${h(report.meta.valuationDate)}｜最終更新 ${h(report.meta.lastUpdated)}｜Validation: ${h(report.validation.status)}`,
  });
}
