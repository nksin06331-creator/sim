import { escapeHtml as h, formatPrice } from "./common.mjs";

const statusLabels = {
  CATALYST_RICH: "複数の重要材料を観測",
  SELECTIVE: "重要材料を選別して確認",
  EXPECTATIONS_HIGH: "期待先行に注意",
  BINARY: "結果の振れ幅が大きい",
  NO_CONFIRMED_CATALYST: "確認できる主要材料なし",
};
const categoryLabels = {
  EARNINGS: "決算・ガイダンス",
  PRODUCT: "製品",
  CAPACITY: "量産・能力増強",
  R_AND_D: "研究開発",
  REGULATORY: "規制",
  CONTRACT: "契約・受注",
  PARTNERSHIP: "提携",
  M_AND_A: "M&A",
  FINANCING: "資金調達",
  POLICY: "政策",
  LEGAL: "訴訟・調査",
  INDUSTRY: "業界需給",
  EVENT: "イベント",
  OTHER: "その他",
};

function array(value) {
  return Array.isArray(value) ? value : [];
}

function percentage(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number >= 0 ? "+" : ""}${number.toFixed(digits)}%`;
}

function compactPercentage(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number}%` : "—";
}

function listItems(items) {
  return array(items).map((item) => `<li>${h(item)}</li>`).join("");
}

function renderTable(columns = [], rows = []) {
  return `<div class="table-wrap"><table><thead><tr>${array(columns).map((column) => `<th>${h(column)}</th>`).join("")}</tr></thead><tbody>${array(rows).map((row) => `<tr>${array(row).map((cell) => `<td>${h(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderBlock(block = {}) {
  const title = block.title ? `<div class="block-label">${h(block.title)}</div>` : "";
  if (block.type === "facts") {
    return `${title}<div class="facts">${array(block.items).map((item) => `<div class="fact"><span>${h(item.label)}</span><b>${h(item.value)}</b></div>`).join("")}</div>`;
  }
  if (block.type === "cards") {
    return `${title}<div class="card-grid">${array(block.items).map((item) => `<div class="card-sm"><span class="card-emoji">${h(item.icon ?? "●")}</span><div class="card-title">${h(item.title)}</div><div class="card-desc">${h(item.description ?? item.text ?? "")}</div></div>`).join("")}</div>`;
  }
  if (block.type === "keypoints") {
    return `${title}<ul class="keypoints">${array(block.items).map((item) => `<li><span class="kp-emoji">${h(item.icon ?? "●")}</span><span class="kp-text"><b>${h(item.title)}</b>${item.text ? `：${h(item.text)}` : ""}</span></li>`).join("")}</ul>`;
  }
  if (block.type === "terms") {
    return `${title}<div class="term-list">${array(block.items).map((item) => `<details class="term-item"><summary class="term-header"><span class="term-name">${h(item.term)}<span class="term-en">${h(item.english ?? "")}</span></span><span class="term-arrow">⌄</span></summary><div class="term-body"><p><b>定義：</b>${h(item.definition ?? "")}<br><b>なぜ重要：</b>${h(item.whyImportant ?? "")}<br><b>この銘柄では：</b>${h(item.companyContext ?? "")}</p></div></details>`).join("")}</div>`;
  }
  if (block.type === "products") {
    return `${title}<div class="product-grid">${array(block.items).map((item) => `<div class="product-box"><div class="product-symbol">${h(item.symbol ?? "")}</div><div class="product-name">${h(item.name)}</div><div class="product-use">${h(item.use ?? item.description ?? "")}</div></div>`).join("")}</div>`;
  }
  if (["comparison", "table"].includes(block.type)) return `${title}${renderTable(block.columns, block.rows)}`;
  if (block.type === "timeline") {
    return `${title}<div class="cat-timeline">${array(block.items).map((item) => `<div class="time-row"><div class="time-date">${h(item.timing ?? item.date ?? "未定")}</div><div class="time-dot"></div><div class="time-body"><b>${h(item.title)}</b><p>${h(item.description ?? "")}</p></div></div>`).join("")}</div>`;
  }
  if (block.type === "risk-grid") {
    return `${title}<div class="grid-2">${array(block.items).map((item) => `<div class="card"><h3>${h(item.title)}</h3><p>${h(item.text ?? item.description ?? "")}</p></div>`).join("")}</div>`;
  }
  if (block.type === "highlight") return `<div class="highlight"><h3>${h(block.title ?? "重要ポイント")}</h3><p>${h(block.text ?? "")}</p></div>`;
  if (block.type === "paragraphs") return `${title}${array(block.paragraphs).map((text) => `<p class="lead">${h(text)}</p>`).join("")}`;
  if (block.type === "custom") {
    return `<div class="card"><h3>${h(block.title ?? "追加情報")}</h3><p>${h(block.text ?? block.payload?.summary ?? "")}</p>${array(block.items).length ? `<ul class="clean">${listItems(block.items)}</ul>` : ""}</div>`;
  }
  return "";
}

function guideSection(report, topic) {
  return [...array(report.guide?.sections), ...array(report.guide?.extraSections)].find((section) => section.topic === topic) ?? {};
}

function block(section, type) {
  return array(section.blocks).find((item) => item.type === type) ?? {};
}

function renderSectionBlocks(section) {
  return array(section.blocks).map(renderBlock).join("");
}

function renderGuideExtra(section, index) {
  return `<div class="guide-section" id="${h(section.id)}"><div class="section-header"><div class="section-icon">${h(section.icon ?? "●")}</div><div class="section-num">${index}</div><div><div class="section-title">${h(section.title)}</div><div class="section-sub">${h(section.subtitle ?? "")}</div></div></div><div class="tldr"><div class="tldr-label">⚡ このセクションの3秒まとめ</div><ul>${listItems(section.summaryItems)}</ul></div>${renderSectionBlocks(section)}</div>`;
}

function renderReportSources(sources) {
  if (!array(sources).length) return "";
  return `<section class="card"><h2>主要出典</h2><ul>${sources.map((source) => `<li><a href="${h(source.url)}" rel="noopener noreferrer">${h(source.publisher)}｜${h(source.title)}</a><br><span class="small">公開 ${h(source.publishedAt ?? "不明")}｜取得 ${h(source.accessedAt)}</span></li>`).join("")}</ul></section>`;
}

function scenarioByName(report, name) {
  return array(report.scenario?.scenarios).find((item) => item.name === name) ?? { name, price: 0, probability: 0, conditions: [], details: [] };
}

function priceDelta(price, current) {
  return current > 0 ? (price / current - 1) * 100 : NaN;
}

function bandPosition(current, bear, bull) {
  if (!(bull > bear)) return 0;
  return Math.max(0, Math.min(100, (current - bear) / (bull - bear) * 100));
}

function zoneJudge(current, bear, base, bull) {
  if (current < bear) return "Bear未満";
  if (current < base) return "Bear〜Base";
  if (current <= bull) return "Base〜Bull";
  return "Bull超";
}

function renderDetails(items) {
  return array(items).map((item) => `<div><dt>${h(item.label)}</dt><dd>${h(item.value)}</dd></div>`).join("");
}

function renderSignals(items) {
  return array(items).map((item) => {
    const description = item.description ?? [item.timing, item.whyItMatters, item.successImpact ? `上振れ時：${item.successImpact}` : "", item.failureImpact ? `下振れ時：${item.failureImpact}` : ""].filter(Boolean).join("｜");
    const signal = item.signal ?? (item.direction === "POSITIVE" ? "up" : item.direction === "NEGATIVE" ? "down" : "flat");
    return `<div class="signal"><div><b>${h(item.title)}</b><span class="${h(signal)}">${item.importance ? `重要度 ${h(item.importance)}` : signal === "up" ? "追い風" : signal === "down" ? "注意" : "要確認"}</span></div><p>${h(description)}</p></div>`;
  }).join("");
}

function renderScenarioConditions(report, currency) {
  return array(report.scenario?.scenarios).map((item) => `<details${item.name === "Base" ? " open" : ""}><summary>${h(item.name)}：${formatPrice(item.price, currency)} / 確率${h(item.probability)}%</summary><p>${h(array(item.conditions).join(" "))}</p></details>`).join("");
}

function calculationTable(report) {
  const calculation = report.scenario?.calculation ?? {};
  if (array(calculation.columns).length && array(calculation.rows).length) return { columns: calculation.columns, rows: calculation.rows };
  const scenarios = array(report.scenario?.scenarios);
  const detailLabels = [...new Set(scenarios.flatMap((item) => array(item.details).map((detail) => detail.label)))];
  const columns = ["ケース", ...detailLabels, "株価"];
  const rows = scenarios.map((item) => [item.name, ...detailLabels.map((label) => array(item.details).find((detail) => detail.label === label)?.value ?? "—"), formatPrice(item.price, report.meta.currency)]);
  return { columns, rows };
}

function renderScenarioExtras(report) {
  const extras = array(report.scenario?.extraSections).map((section) => `<section class="card" id="${h(section.id)}"><h2>${h(section.title)}</h2><p class="lead">${h(array(section.summaryItems).join(" / "))}</p>${renderSectionBlocks(section)}</section>`).join("");
  return `${extras}${renderReportSources(report.sources)}`;
}

function pricedText(priced) {
  if (!priced) return "未算定";
  if (priced.quantifiable && Array.isArray(priced.percent_range)) return `${priced.percent_range[0]}〜${priced.percent_range[1]}%`;
  return priced.label ?? "UNKNOWN";
}

function renderPricedBlock(priced) {
  if (!priced) return `<div class="priced unknown"><b>未算定</b><p>織り込み度は未設定です。</p></div>`;
  if (priced.quantifiable && Array.isArray(priced.percent_range)) {
    const [low, high] = priced.percent_range;
    return `<div class="priced"><div class="priced-head"><span>推定レンジ</span><b>${h(low)}〜${h(high)}%</b></div><div class="range-meter"><i class="range-band" style="left:${h(low)}%;width:${h(Math.max(0, high - low))}%"></i></div><p>${h(priced.label)}｜確度 ${h(priced.confidence)}</p></div>`;
  }
  return `<div class="priced unknown"><b>${h(priced.label ?? "UNKNOWN")}</b><p>${h(priced.qualitative_assessment ?? priced.unquantifiable_reason ?? "定量評価に必要な情報が不足しています。")}</p></div>`;
}

function renderCatalystTimeline(catalysts) {
  return array(catalysts).map((item) => `<div class="time-row"><div class="time-date">${h(item.date?.display_text ?? "未定")}</div><div class="time-dot"></div><div class="time-body"><b>${h(item.title)}</b><p>${h(item.plain_language)}</p><div class="time-meta"><span class="chip">${h(categoryLabels[item.category] ?? item.category)}</span><span class="chip amber">重要度 ${h(item.importance)}</span><span class="chip blue">日程確度 ${h(item.date?.confidence ?? "LOW")}</span></div></div></div>`).join("");
}

function renderOutcome(outcome, currency) {
  const quantifiable = outcome.quantifiable === true && Array.isArray(outcome.price_range);
  const price = quantifiable ? `${formatPrice(outcome.price_range[0], currency)}〜${formatPrice(outcome.price_range[1], currency)}` : h(outcome.qualitative_assessment ?? outcome.direction ?? "定性評価");
  const change = quantifiable && Array.isArray(outcome.price_change_pct_range) ? `${outcome.price_change_pct_range[0]}〜${outcome.price_change_pct_range[1]}%` : h(outcome.unquantifiable_reason ?? "数値レンジなし");
  const label = String(outcome.label ?? "RESULT");
  const tone = /success|outperform|positive/i.test(label) ? "success" : /fail|underperform|negative/i.test(label) ? "failure" : "inline";
  return `<div class="outcome ${tone}"><b>${h(label)}</b><div class="impact">${price}</div><p>${change}</p><ul>${listItems(outcome.conditions)}</ul></div>`;
}

function renderCatalystCards(catalystReport) {
  return array(catalystReport?.catalysts).map((item) => {
    const outcomes = array(item.outcomes).length
      ? `<div class="outcomes">${item.outcomes.map((outcome) => renderOutcome(outcome, catalystReport.meta.currency)).join("")}</div>`
      : `<div class="notice"><b>定性評価：</b>${h(item.price_impact_direction ?? item.direction)}｜${h(item.price_impact_magnitude ?? item.why_it_matters)}</div>`;
    const mechanism = array(item.mechanism).length ? `<div class="mechanism">${item.mechanism.map((step, index) => `<span>${index ? '<i aria-hidden="true">→</i> ' : ""}${h(step)}</span>`).join("")}</div>` : "";
    const evidence = item.priced_in?.evidence_for?.length || item.priced_in?.evidence_against?.length
      ? `<div class="evidence"><div><h4>織り込みを支持する材料</h4><ul>${listItems(item.priced_in?.evidence_for)}</ul></div><div><h4>反証・不確実性</h4><ul>${listItems(item.priced_in?.evidence_against)}</ul></div></div>`
      : "";
    return `<article class="catalyst-card"><div class="catalyst-head"><div><div class="chips"><span class="chip">${h(categoryLabels[item.category] ?? item.category)}</span><span class="chip amber">重要度 ${h(item.importance)}</span><span class="chip blue">${h(item.event_type)}</span></div><h3>${h(item.title)}</h3><p>${h(item.plain_language)}</p></div><div class="date-box"><b>${h(item.date?.display_text ?? "未定")}</b><span>${h(item.date?.basis ?? "UNKNOWN")}｜確度 ${h(item.date?.confidence ?? "LOW")}</span></div></div><p>${h(item.detail ?? item.why_it_matters)}</p>${mechanism}${outcomes}${renderPricedBlock(item.priced_in)}${evidence}<div class="facts"><div class="fact"><span>影響の試算方法</span><b>${h(item.impact_method ?? `定量化優先順位 ${item.quantification_priority ?? "未記録"}`)}</b></div><div class="fact"><span>影響の時間軸</span><b>${h(item.impact_horizon ?? "未設定")}｜確度 ${h(item.impact_confidence ?? "未設定")}</b></div><div class="fact"><span>材料出尽くし</span><b>${h(item.sell_the_news_risk ?? "未評価")}</b></div><div class="fact"><span>資金調達・希薄化</span><b>${h(item.financing_risk ?? item.dilution_impact ?? "未評価")}</b></div></div><details><summary>先行指標・依存関係・更新条件</summary><div><h4>先行指標</h4><ul>${listItems(item.leading_indicators)}</ul><h4>依存関係</h4><ul>${listItems(array(item.dependencies).length ? item.dependencies : ["重大な依存関係なし"])}</ul><h4>更新条件</h4><ul>${listItems(item.update_triggers)}</ul><p class="small">出典ID：${h(array(item.source_ids).join(", "))}</p></div></details></article>`;
  }).join("");
}

function renderDependencies(groups) {
  if (!array(groups).length) return `<p>重大な重複グループはありません。</p>`;
  return groups.map((group) => `<div class="signal"><div><b>${h(group.name)}</b><span class="chip">${h(array(group.catalyst_ids).join(" / "))}</span></div><p>${h(group.relationship)}</p><p class="small">集計ルール：${h(group.aggregation_rule)}</p></div>`).join("");
}

function renderCatalystWatch(items) {
  if (!array(items).length) return `<p>定期観測項目は未設定です。</p>`;
  return items.map((item) => `<div class="signal"><div><b>${h(item.item)}</b><span class="chip blue">${h(item.frequency)}</span></div><p>${h(item.why_it_matters)}</p><p class="small">更新条件：${h(item.update_trigger)}｜対象：${h(array(item.catalyst_ids).join(", "))}</p></div>`).join("");
}

function renderCatalystSources(sources) {
  return `<ul>${array(sources).map((source) => `<li><a href="${h(source.url)}" rel="noopener noreferrer">${h(source.title)}</a><br><span class="small">${h(source.publisher)}｜公開 ${h(source.published_at ?? "不明")}｜取得 ${h(source.accessed_at)}｜${h(source.is_primary ? "一次情報" : source.source_type)}</span></li>`).join("")}</ul>`;
}

function declaredBindingNames(bindings) {
  return new Set([
    ...Object.keys(bindings.globalBindings ?? {}),
    ...Object.keys(bindings.guideViewBindings ?? {}),
    ...Object.keys(bindings.scenarioViewBindings ?? {}),
    ...Object.keys(bindings.catalystViewBindings ?? {}),
  ]);
}

function replacePlaceholders(template, values, bindings) {
  const placeholders = [...new Set([...template.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((match) => match[1]))];
  const declared = declaredBindingNames(bindings);
  const unbound = placeholders.filter((name) => !declared.has(name));
  if (unbound.length) throw new Error(`template-bindingsに未定義のプレースホルダーがあります: ${unbound.join(", ")}`);
  const missing = placeholders.filter((name) => !(name in values));
  if (missing.length) throw new Error(`レンダラーに未実装のプレースホルダーがあります: ${missing.join(", ")}`);
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, name) => values[name]);
}

function validateGeneratedHtml(html) {
  const active = html.replace(/<!--[\s\S]*?-->/g, "");
  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) throw new Error("未置換プレースホルダーがあります。");
  if (/<iframe\b/i.test(active)) throw new Error("iframeは使用できません。");
  if (/<a\b[^>]*href=["'](?:\.\.\/\.\.\/index\.html|[^"']*(?:scenario|catalysts|[A-Z0-9.-]+)\.html)["']/i.test(active)) throw new Error("統合ページ内に旧ページリンクがあります。");
  if (/<a\b[^>]*href=["']#/i.test(active)) throw new Error("URLハッシュを変更するアンカーがあります。");
  if (/javascript\s*:/i.test(active) || /\son[a-z]+\s*=/i.test(active)) throw new Error("危険なHTMLがあります。");
  if (/history\.(?:pushState|replaceState)\s*\(/.test(active)) throw new Error("ブラウザ履歴を変更するコードがあります。");
}

export function renderUnifiedReport({ report, catalystReport, reportValidation, catalystValidation, template, bindings }) {
  const currency = report.meta.currency;
  const current = Number(report.scenario.valuation.currentPrice);
  const bear = scenarioByName(report, "Bear");
  const base = scenarioByName(report, "Base");
  const bull = scenarioByName(report, "Bull");
  const position = bandPosition(current, bear.price, bull.price);
  const calculation = calculationTable(report);
  const sensitivity = report.scenario.calculation?.sensitivity ?? {};
  const catalystState = !catalystReport ? "missing" : ["FAIL", "BLOCKING_WARN"].includes(catalystValidation?.status) ? "blocking" : "available";
  const reportInfo = [...new Set([...(reportValidation?.infoWarnMessages ?? []), ...(report.validation?.infoWarnMessages ?? [])])];
  const catalystInfo = [...new Set(catalystValidation?.infoWarnMessages ?? [])];

  const company = guideSection(report, "company");
  const industry = guideSection(report, "industry");
  const products = guideSection(report, "products");
  const operations = guideSection(report, "operations");
  const competition = guideSection(report, "competition");
  const glossary = guideSection(report, "glossary");
  const catalysts = guideSection(report, "catalysts");
  const mainTopics = new Set(["company", "industry", "products", "operations", "competition", "glossary", "catalysts"]);
  const guideExtras = [...array(report.guide.extraSections), ...array(report.guide.sections).filter((section) => !mainTopics.has(section.topic))];
  const currentNote = report.scenario.valuation.currentPriceNote ?? `${report.meta.valuationDate}・分析基準値`;
  const heroStats = array(report.overview.heroStats);
  const nextCatalyst = array(catalystReport?.catalysts).find((item) => item.id === catalystReport?.summary?.next_catalyst_id);
  const overall = catalystReport?.summary?.overall_priced_in;

  const values = {
    TICKER: h(report.reportId), COMPANY_NAME: h(report.meta.companyName), EXCHANGE: h(report.meta.exchange),
    CURRENCY: h(currency), VALUATION_DATE: h(report.meta.valuationDate), LAST_UPDATED: h(report.meta.lastUpdated),
    INDUSTRY: h(report.meta.industry), DATE: h(report.meta.valuationDate), TAGLINE: h(report.overview.tagline),
    BUSINESS_SUMMARY: h(report.overview.businessSummary),
    HERO_TAGS: array(report.overview.heroTags).map((tag) => `<span class="hero-tag">${h(tag)}</span>`).join(""),
    HERO_STATS: heroStats.map((stat) => `<div class="kpi"><span>${h(stat.label)}${stat.livePrice ? ' <em style="font-style:normal;color:var(--accent);font-size:10px">LIVE</em>' : ""}</span><b${stat.livePrice ? " data-live-price" : ""}>${h(stat.value)}</b><small${stat.livePrice ? " data-live-price-date" : ""}>${h(stat.note ?? "")}</small></div>`).join(""),
    GUIDE_HERO_STATS: heroStats.map((stat) => `<div class="stat"><div class="stat-value ${h(stat.tone ?? "")}"${stat.livePrice ? " data-live-price" : ""}>${h(stat.value)}</div><div class="stat-label">${h(stat.label)}${stat.livePrice ? ' <span class="g">LIVE</span>' : ""}</div><div class="stat-note"${stat.livePrice ? " data-live-price-date" : ""}>${h(stat.note ?? "")}</div></div>`).join(""),
    GUIDE_SECTIONS: "",
    GUIDE_EXTRA_SECTIONS: `${guideExtras.map((section, index) => renderGuideExtra(section, index + 8)).join("")}${renderReportSources(report.sources)}`,
    SEC1_TLDR: listItems(company.summaryItems),
    SEC1_FACTS: array(block(company, "facts").items).map((item) => `<div class="fact"><span>${h(item.label)}</span><b>${h(item.value)}</b></div>`).join(""),
    SEC1_CARDS: array(block(company, "cards").items).map((item) => `<div class="card-sm"><span class="card-emoji">${h(item.icon ?? "●")}</span><div class="card-title">${h(item.title)}</div><div class="card-desc">${h(item.description ?? "")}</div></div>`).join(""),
    SEC1_BIZMODEL: array(block(company, "keypoints").items).map((item) => `<li><span class="kp-emoji">${h(item.icon ?? "●")}</span><span class="kp-text"><b>${h(item.title)}</b>${item.text ? `：${h(item.text)}` : ""}</span></li>`).join(""),
    SEC1_HIGHLIGHT: array(company.blocks).filter((item) => !["facts", "cards", "keypoints"].includes(item.type)).map(renderBlock).join(""),
    SEC2_ICON: h(industry.icon ?? "🏭"), SEC2_TITLE: h(industry.title ?? "業界の基本"), SEC2_SUB: h(industry.subtitle ?? ""), SEC2_LABEL: h(industry.title ?? "業界"), SEC2_TLDR: listItems(industry.summaryItems), SEC2_CONTENT: renderSectionBlocks(industry),
    SEC3_TITLE: h(products.title ?? "製品・サービス"), SEC3_SUB: h(products.subtitle ?? ""), SEC3_LABEL: h(products.title ?? "製品"), SEC3_TLDR: listItems(products.summaryItems), SEC3_CONTENT: renderSectionBlocks(products),
    SEC4_TITLE: h(operations.title ?? "事業運営"), SEC4_SUB: h(operations.subtitle ?? ""), SEC4_LABEL: h(operations.title ?? "運営"), SEC4_TLDR: listItems(operations.summaryItems), SEC4_CONTENT: renderSectionBlocks(operations),
    SEC5_TITLE: h(competition.title ?? "競争環境"), SEC5_SUB: h(competition.subtitle ?? ""), SEC5_LABEL: h(competition.title ?? "競合"), SEC5_TLDR: listItems(competition.summaryItems), SEC5_CONTENT: renderSectionBlocks(competition),
    SEC6_TLDR: listItems(glossary.summaryItems), SEC6_CONTENT: renderSectionBlocks(glossary),
    SEC7_TLDR: listItems(catalysts.summaryItems), SEC7_CONTENT: renderSectionBlocks(catalysts),
    METHOD: h(report.scenario.valuation.method), VERDICT_STATUS: h(report.scenario.decision.status), VERDICT_LINE_1: h(report.scenario.decision.oneLine), VERDICT_LINE_2: h(report.scenario.decision.valuationView), SCORE: h(report.scenario.decision.score),
    CURRENT_PRICE: formatPrice(current, currency), CURRENT_PRICE_NOTE: h(currentNote),
    BASE_PRICE: formatPrice(base.price, currency), BASE_DELTA: percentage(priceDelta(base.price, current)), BASE_PROB: compactPercentage(base.probability),
    EXPECTED_VALUE: formatPrice(report.scenario.valuation.expectedValue, currency), EXPECTED_DELTA: percentage(report.scenario.valuation.expectedReturnPct),
    RISK_CLASS: h(report.scenario.risk.riskClass), RISK_NOTE: h(array(report.scenario.risk.items).slice(0, 2).map((item) => item.title).join("・")),
    BEAR_PRICE: formatPrice(bear.price, currency), BEAR_DELTA: percentage(priceDelta(bear.price, current)), BEAR_PROB: compactPercentage(bear.probability), BEAR_DL_ROWS: renderDetails(bear.details),
    BULL_PRICE: formatPrice(bull.price, currency), BULL_DELTA: percentage(priceDelta(bull.price, current)), BULL_PROB: compactPercentage(bull.probability), BULL_DL_ROWS: renderDetails(bull.details), BASE_DL_ROWS: renderDetails(base.details),
    BAND_POSITION: `${position.toFixed(1)}%`, ZONE_JUDGE: h(zoneJudge(current, bear.price, base.price, bull.price)), ZONE_NOTE: h(report.scenario.positioning.note ?? report.scenario.positioning.interpretation ?? report.scenario.positioning.sizingView ?? ""),
    ENDPOINT_RR: Number.isFinite(priceDelta(bull.price, current) / Math.abs(priceDelta(bear.price, current))) ? (priceDelta(bull.price, current) / Math.abs(priceDelta(bear.price, current))).toFixed(2) : "—",
    MARKET_SCORE: h(position.toFixed(0)), OWN_SCORE: h(report.scenario.decision.score), MARKET_REVERSE_NOTE: h(report.scenario.marketReverse.conclusion ?? report.scenario.marketReverse.interpretation ?? report.scenario.marketReverse.impliedRequirement ?? ""),
    SNAPSHOT_LEAD: h(report.scenario.positioning.summary ?? report.scenario.entryContext.pricedInNote ?? report.scenario.positioning.interpretation ?? report.scenario.positioning.sizingView ?? ""),
    SCENARIOS_LEAD: h(report.scenario.calculation.summary ?? report.scenario.calculation.modelNote ?? report.scenario.valuation.method),
    PRICE_ZONE_ROWS: renderSignals(array(report.scenario.positioning.priceZones).length ? report.scenario.positioning.priceZones.map((zone) => ({ title: zone.range, description: zone.note, signal: "flat" })) : [{ title: `${formatPrice(bear.price, currency)}未満`, description: "悲観ケース以下。前提の崩れを確認。", signal: "down" }, { title: `${formatPrice(bear.price, currency)}〜${formatPrice(base.price, currency)}`, description: "Bear〜Base帯。主要KPIを確認。", signal: "flat" }, { title: `${formatPrice(base.price, currency)}〜${formatPrice(bull.price, currency)}`, description: "Base〜Bull帯。強気前提の実現度を確認。", signal: "up" }, { title: `${formatPrice(bull.price, currency)}超`, description: "強気ケース超。追加の上振れ前提が必要。", signal: "up" }]),
    SIGNAL_ROWS: renderSignals(report.scenario.entryContext.catalysts), POSITIVES: listItems(report.scenario.positives), CONCERNS: listItems(report.scenario.concerns),
    FORMULA: h(report.scenario.calculation.formula ?? report.scenario.calculation.expectedValueFormula ?? report.scenario.calculation.summary ?? report.scenario.calculation.modelNote ?? "シナリオ確率と価格を加重して期待値を算出します。"),
    CALC_TABLE_HEAD: calculation.columns.map((column) => `<th>${h(column)}</th>`).join(""), CALC_TABLE_ROWS: calculation.rows.map((row) => `<tr>${row.map((cell) => `<td>${h(cell)}</td>`).join("")}</tr>`).join(""), CALC_NOTICE: h(report.scenario.calculation.notice ?? report.scenario.calculation.modelNote ?? "表示値は仮定に依存します。"),
    CONDITIONS: renderScenarioConditions(report, currency),
    SENSITIVITY_HEAD: array(sensitivity.columns ?? report.scenario.calculation.sensitivityHead).map((column) => `<th>${h(column)}</th>`).join(""),
    SENSITIVITY_ROWS: array(sensitivity.rows ?? report.scenario.calculation.sensitivityRows).map((row) => `<tr>${array(row).map((cell) => `<td>${h(cell)}</td>`).join("")}</tr>`).join("") || `<tr><td>感応度表は未設定です。</td></tr>`,
    SENSITIVITY_NOTE: h(sensitivity.note ?? report.scenario.calculation.sensitivityNote ?? ""), DIST_LEAD: h(report.scenario.calculation.distLead ?? "確率は予言ではなく、仮定の重みです。"),
    DIST_ROWS: array(report.scenario.scenarios).map((item) => `<div class="dist-row"><span>${h(item.name)} ${formatPrice(item.price, currency)}</span><div class="track"><i style="width:${h(item.probability)}%"></i></div><b>${h(item.probability)}%</b></div>`).join(""), DIST_SUMMARY: h(report.scenario.calculation.distSummary ?? "3シナリオの確率合計は100%です。"),
    WATCH_ROWS: renderSignals(report.scenario.watchItems), ASSUMPTIONS_ROWS: array(report.scenario.assumptions).map((item) => `<tr><td>${h(item.item)}</td><td>${h(item.value)}</td><td>${h(item.classification)}</td><td>${h(item.note)}</td></tr>`).join(""),
    DEEPDIVE_DETAILS: array(report.scenario.deepDive).map((item) => `<details><summary>${h(item.title)}</summary><p>${h(item.content)}</p></details>`).join(""), SCENARIO_EXTRA_SECTIONS: renderScenarioExtras(report),
    DISCLAIMER: h(report.scenario.disclaimer), FOOTER_NOTE: `SiM MARKET LAB｜評価基準日 ${h(report.meta.valuationDate)}｜最終更新 ${h(report.meta.lastUpdated)}｜現在株価だけ自動更新。分析値は評価基準日時点で固定。`,
    WARN_BAND: reportInfo.length ? `<div class="wrap"><div class="info-warn-band"><b>注意：</b>${reportInfo.map(h).join(" / ")}</div></div>` : "",
    REPORT_STATUS: h(statusLabels[catalystReport?.summary?.status] ?? catalystReport?.summary?.status ?? "準備中"), SUMMARY_LINE_1: h(catalystReport?.summary?.one_line ?? "カタリストレポートは準備中です。"), SUMMARY_LINE_2: h(catalystReport?.summary?.primary_risk ?? ""),
    OVERALL_PRICED_IN: h(pricedText(overall)), OVERALL_PRICED_LABEL: h(overall?.label ?? "UNKNOWN"), PRICED_IN_CONFIDENCE: h(overall?.confidence ?? "LOW"), NEXT_CATALYST_TITLE: h(nextCatalyst?.title ?? "未定"), NEXT_CATALYST_WINDOW: h(nextCatalyst?.date?.display_text ?? catalystReport?.summary?.next_window ?? "未定"),
    DATE_CONFIDENCE: h(nextCatalyst?.date?.confidence ?? "未判定"), CATALYST_COUNT: `${array(catalystReport?.catalysts).length}件`, OVERALL_PRICED_BLOCK: renderPricedBlock(overall), PRICED_IN_METHOD: h(overall?.model ?? overall?.unquantifiable_reason ?? "未設定"),
    SURPRISE_UP: h(catalystReport?.summary?.surprise_up ?? "未設定"), SURPRISE_DOWN: h(catalystReport?.summary?.surprise_down ?? "未設定"), PRIMARY_RISK: h(catalystReport?.summary?.primary_risk ?? "未設定"),
    TIMELINE_ROWS: renderCatalystTimeline(catalystReport?.catalysts), CATALYST_CARDS: renderCatalystCards(catalystReport), DEPENDENCY_ROWS: renderDependencies(catalystReport?.dependency_groups), WATCH_ROWS_CAT: renderCatalystWatch(catalystReport?.watch_items),
    ASSUMPTIONS_CAT: array(catalystReport?.assumptions).map((item) => `<tr><td>${h(item.item)}</td><td>${h(item.value)}</td><td>${h(item.classification)}</td><td>${h(item.as_of)}</td><td>${h(item.note)}</td></tr>`).join(""), SOURCES_CAT: renderCatalystSources(catalystReport?.sources),
    WARN_BAND_CAT: catalystInfo.length && catalystState === "available" ? `<div class="wrap"><div class="info-warn-band"><b>カタリスト注意：</b>${catalystInfo.map(h).join(" / ")}</div></div>` : "",
    NO_CATALYST_NOTICE: catalystReport?.summary?.status === "NO_CONFIRMED_CATALYST" ? `<div class="wrap"><div class="notice" style="margin-top:14px">現時点で確認できる確定カタリストはありません。</div></div>` : "",
    CATALYST_PLACEHOLDER: catalystState === "available" ? "" : `<div class="wrap catalyst-placeholder"><h2>カタリストレポートは準備中です</h2><p>${catalystState === "blocking" ? "カタリストの検証に公開停止項目があります。" : "企業ガイドと株価シナリオは公開済みです。"}</p></div>`,
  };

  let html = replacePlaceholders(template, values, bindings);
  if (catalystState !== "available") html = html.replace(/\s*<!-- CATALYST_CONTENT_START -->[\s\S]*?<!-- CATALYST_CONTENT_END -->/m, "");
  if (catalystState === "blocking") {
    html = html.replace(/<button type="button" class="tab-btn" data-view-btn="catalyst"[^>]*>[^<]*<\/button>/, '<button type="button" class="tab-btn" hidden disabled>カタリスト（準備中）</button>');
  }
  validateGeneratedHtml(html);
  return { html, catalystState };
}
