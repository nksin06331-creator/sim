import { collectStrings, escapeHtml as h, formatPrice, renderTemplate } from "./common.mjs";
import { validateSchema } from "./schema.mjs";

const forbiddenClaims = [
  /絶対(?:に)?上がる/,
  /必ず上がる/,
  /買うべき/,
  /売るべき/,
  /爆上げ確定/,
  /テンバガー確定/,
];
const dangerousHtml = /<\s*(script|iframe|object|embed|form)\b|on[a-z]+\s*=|javascript\s*:/i;
const evidenceClasses = new Set(["CONFIRMED", "COMPANY_GUIDANCE", "CONSENSUS", "HISTORICAL_RANGE", "MODEL_ESTIMATE", "UNKNOWN"]);
const eventTypes = new Set(["QUANTITATIVE", "SEMI_QUANTITATIVE", "QUALITATIVE"]);
const confidenceValues = new Set(["LOW", "MEDIUM", "HIGH"]);
const summaryStatuses = new Set(["CATALYST_RICH", "SELECTIVE", "EXPECTATIONS_HIGH", "BINARY", "NO_CONFIRMED_CATALYST"]);
const catalystCategories = new Set(["EARNINGS", "PRODUCT", "CAPACITY", "R_AND_D", "REGULATORY", "CONTRACT", "PARTNERSHIP", "M_AND_A", "FINANCING", "POLICY", "LEGAL", "INDUSTRY", "EVENT", "OTHER"]);
const catalystStatuses = new Set(["SCHEDULED", "WINDOWED", "ONGOING", "CONTINGENT", "TBD", "UNCONFIRMED"]);
const catalystDirections = new Set(["POSITIVE", "NEGATIVE", "TWO_SIDED", "NEUTRAL"]);
const pricedInLabels = new Set(["LOW", "LOW_TO_MEDIUM", "MEDIUM", "MEDIUM_TO_HIGH", "HIGH", "UNKNOWN", "ほぼ未織り込み", "一部織り込み", "半分前後", "かなり織り込み", "大半を織り込み", "定量不能"]);

export function catalystPathForPortalStock(stock, ticker) {
  const folder = stock?.detailPath?.match(/^stocks\/([^/?#]+)\/index\.html$/)?.[1];
  return `stocks/${folder ?? ticker}/catalysts.html`;
}

function check(id, status, message) {
  return { id, status, message };
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "")
    && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function rangeIsValid(value, minimum = -Infinity, maximum = Infinity) {
  return Array.isArray(value)
    && value.length === 2
    && value.every((item) => Number.isFinite(item))
    && value[0] <= value[1]
    && value[0] >= minimum
    && value[1] <= maximum;
}

function allOrNone(values) {
  const present = values.filter((value) => Number.isFinite(value));
  return present.length === 0 || present.length === values.length;
}

function collectSourceReferences(report) {
  const refs = [];
  const add = (values) => {
    if (Array.isArray(values)) refs.push(...values);
  };
  for (const catalyst of report.catalysts ?? []) {
    add(catalyst.source_ids);
    add(catalyst.date?.source_ids);
    for (const item of catalyst.extra_items ?? []) add(item.source_ids);
  }
  for (const assumption of report.assumptions ?? []) add(assumption.source_ids);
  for (const section of report.extra_sections ?? []) add(section.source_ids);
  return refs;
}

export function validateCatalystReport(report) {
  const checks = [];
  const push = (id, status, message) => checks.push(check(id, status, message));
  const meta = report?.meta ?? {};
  const summary = report?.summary ?? {};
  const catalysts = Array.isArray(report?.catalysts) ? report.catalysts : [];
  const sources = Array.isArray(report?.sources) ? report.sources : [];

  const schema = validateSchema("catalyst", report);
  push(
    "C00_SCHEMA_V11",
    schema.valid ? "PASS" : "FAIL",
    schema.valid ? "catalyst schema v1.1に適合" : `Schema違反: ${schema.errors.join(" / ")}`,
  );

  push(
    "C00_SHAPE",
    Boolean(
      report
      && Array.isArray(report.catalysts)
      && Array.isArray(report.dependency_groups)
      && Array.isArray(report.watch_items)
      && Array.isArray(report.assumptions)
      && Array.isArray(report.sources)
      && report.validation_summary
      && report.disclaimer,
    ) ? "PASS" : "FAIL",
    "トップレベルの必須項目を確認",
  );
  push(
    "C01_TARGET",
    Boolean(meta.company_name && /^[A-Z0-9.-]+$/.test(meta.ticker ?? "") && meta.exchange && ["USD", "JPY"].includes(meta.currency))
      ? "PASS"
      : "FAIL",
    "企業名・ティッカー・取引所・通貨を確認",
  );
  push(
    "C02_DATES",
    isDate(meta.valuation_date) && Boolean(meta.last_updated && meta.current_price_as_of && meta.source_cutoff)
      ? "PASS"
      : "FAIL",
    "評価基準日・株価時点・最終更新・情報締切を確認",
  );
  push(
    "C03_PRICE",
    Number.isFinite(meta.current_price_fallback) && meta.current_price_fallback > 0 ? "PASS" : "FAIL",
    "分析基準株価は正の数",
  );
  push(
    "C04_FRAMEWORK",
    meta.framework_version === "1.1" ? "PASS" : "FAIL",
    "framework_versionは1.1",
  );

  const catalystIds = catalysts.map((item) => item?.id).filter(Boolean);
  const catalystIdSet = new Set(catalystIds);
  push(
    "C05_UNIQUE_CATALYSTS",
    catalystIds.length === catalysts.length && catalystIdSet.size === catalysts.length ? "PASS" : "FAIL",
    "カタリストIDの欠落・重複なし",
  );
  push(
    "C06_NEXT_CATALYST",
    summary.next_catalyst_id === null || catalystIdSet.has(summary.next_catalyst_id) ? "PASS" : "FAIL",
    "次の主要カタリストIDを解決",
  );
  push(
    "C07_EMPTY_REPORT",
    catalysts.length > 0 || (summary.status === "NO_CONFIRMED_CATALYST" && summary.next_catalyst_id === null)
      ? "PASS"
      : "FAIL",
    catalysts.length ? `${catalysts.length}件を掲載` : "材料なしの表示条件を確認",
  );
  const overall = summary.overall_priced_in;
  push(
    "C07B_SUMMARY",
    summaryStatuses.has(summary.status)
      && Boolean(summary.one_line && summary.next_window && summary.primary_risk)
    ? "PASS"
    : "FAIL",
    "要約の必須項目を確認",
  );
  if (!overall) {
    push("C07C_OVERALL_PRICED", "INFO_WARN", "全体の織り込み度は未設定");
  } else {
    const overallPricedOk = overall.quantifiable
      ? rangeIsValid(overall.percent_range, 0, 100)
      : pricedInLabels.has(overall.label);
    push(
      "C07C_OVERALL_PRICED",
      overallPricedOk && confidenceValues.has(overall.confidence) ? "PASS" : "FAIL",
      "全体の織り込み度は数値レンジまたは段階評価で表示",
    );
    if (!overall.quantifiable) {
      push(
        "C07D_OVERALL_UNQUANTIFIABLE",
        overall.unquantifiable_reason && overall.qualitative_assessment && overall.revaluation_trigger ? "PASS" : "BLOCKING_WARN",
        "全体を定量不能とする場合は理由・代替評価・再評価条件が必要",
      );
    }
  }

  const sourceIds = sources.map((source) => source?.id).filter(Boolean);
  const sourceIdSet = new Set(sourceIds);
  push(
    "C08_SOURCE_IDS",
    sourceIds.length === sources.length && sourceIdSet.size === sources.length ? "PASS" : "FAIL",
    "出典IDの欠落・重複なし",
  );
  push(
    "C09_SOURCE_URLS",
    sources.every((source) => /^https?:\/\//.test(source?.url ?? "")) ? "PASS" : "FAIL",
    "出典URLはhttpまたはhttps",
  );
  push(
    "C09B_SOURCE_SHAPE",
    sources.every((source) => Boolean(
      source.id
      && source.title
      && source.publisher
      && source.accessed_at
      && source.source_type
      && typeof source.is_primary === "boolean"
      && Array.isArray(source.supports_catalyst_ids),
    )) ? "PASS" : "FAIL",
    "出典の名称・発行元・取得日・種別・対象を確認",
  );

  for (const catalyst of catalysts) {
    const prefix = catalyst?.id || "UNKNOWN";
    const date = catalyst?.date ?? {};
    push(
      `C12_${prefix}`,
      Boolean(
        catalyst.title
        && eventTypes.has(catalyst.event_type)
        && catalystCategories.has(catalyst.category)
        && catalystStatuses.has(catalyst.status)
        && Number.isInteger(catalyst.importance)
        && catalyst.importance >= 1
        && catalyst.importance <= 5
        && catalystDirections.has(catalyst.direction)
        && catalyst.plain_language
        && catalyst.why_it_matters
        && Array.isArray(catalyst.update_triggers)
        && Array.isArray(catalyst.source_ids)
      ) ? "PASS" : "FAIL",
      `${prefix}: v1.1のイベント型・重要度・方向性・更新条件を確認`,
    );
    push(
      `D01_${prefix}`,
      Boolean(date.display_text && evidenceClasses.has(date.basis) && confidenceValues.has(date.confidence) && Array.isArray(date.source_ids))
        ? "PASS"
        : "FAIL",
      `${prefix}: 日程表示・根拠・確度・出典を確認`,
    );
    const endIsPast = isDate(date.end_date) && date.end_date < meta.valuation_date;
    push(
      `D02_${prefix}`,
      !endIsPast || catalyst.status === "ONGOING" ? "PASS" : "FAIL",
      `${prefix}: 完了済み日程を今後一覧へ残さない`,
    );
    const outcomes = catalyst.outcomes ?? [];
    push(
      `O01_${prefix}`,
      catalyst.event_type !== "QUANTITATIVE" || Number(catalyst.importance) < 3 || outcomes.length > 0 ? "PASS" : "INFO_WARN",
      `${prefix}: 重要な定量型イベントの結果パターンを確認`,
    );
    const probabilities = outcomes.map((outcome) => outcome.probability);
    const probabilitySum = probabilities.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
    push(
      `O02_${prefix}`,
      allOrNone(probabilities) && (probabilities.every((value) => !Number.isFinite(value)) || Math.abs(probabilitySum - 1) < 0.0001)
        ? "PASS"
        : "FAIL",
      `${prefix}: 結果確率は全非表示または合計100%`,
    );

    for (const outcome of outcomes) {
      const hasRanges = rangeIsValid(outcome.price_change_pct_range)
        && rangeIsValid(outcome.price_range, 0);
      push(
        `O03_${prefix}_${outcome.label}`,
        outcome.quantifiable ? (hasRanges && evidenceClasses.has(outcome.quantification_basis) ? "PASS" : "FAIL") : (!outcome.price_change_pct_range && !outcome.price_range ? "PASS" : "FAIL"),
        `${prefix}/${outcome.label}: 定量可否と価格レンジを一致`,
      );
      if (outcome.quantifiable === false) {
        push(
          `O03B_${prefix}_${outcome.label}`,
          outcome.unquantifiable_reason && outcome.qualitative_assessment && outcome.revaluation_trigger ? "PASS" : "BLOCKING_WARN",
          `${prefix}/${outcome.label}: 定量不能の理由・代替評価・再評価条件を確認`,
        );
      }
      if (outcome.quantifiable && hasRanges) {
        const expected = outcome.price_change_pct_range.map((pct) => meta.current_price_fallback * (1 + pct / 100));
        const tolerance = Math.max(meta.currency === "JPY" ? 2 : 0.05, meta.current_price_fallback * 0.005);
        const arithmeticOk = expected.every((value, index) => Math.abs(value - outcome.price_range[index]) <= tolerance);
        push(
          `O04_${prefix}_${outcome.label}`,
          arithmeticOk ? "PASS" : "FAIL",
          `${prefix}/${outcome.label}: 基準株価と騰落率を再計算`,
        );
      }
    }

    const priced = catalyst.priced_in;
    if (!priced) {
      push(`P01_${prefix}`, "INFO_WARN", `${prefix}: 個別の織り込み度は未設定`);
    } else {
      const pricedOk = priced.quantifiable ? rangeIsValid(priced.percent_range, 0, 100) : pricedInLabels.has(priced.label);
      push(
        `P01_${prefix}`,
        pricedOk && confidenceValues.has(priced.confidence) ? "PASS" : "FAIL",
        `${prefix}: 織り込み度の幅または段階評価を確認`,
      );
      if (!priced.quantifiable) {
        push(
          `P02_${prefix}`,
          priced.unquantifiable_reason && priced.qualitative_assessment && priced.revaluation_trigger ? "PASS" : "BLOCKING_WARN",
          `${prefix}: 定量不能の理由・代替評価・再評価条件を確認`,
        );
      }
    }
    push(
      `Q01_${prefix}`,
      Number.isInteger(catalyst.quantification_priority) && catalyst.quantification_priority >= 1 && catalyst.quantification_priority <= 8 ? "PASS" : "INFO_WARN",
      `${prefix}: 定量化優先順位の適用記録を確認`,
    );
    push(
      `S01_${prefix}`,
      (catalyst.source_ids ?? []).length > 0 && catalyst.source_ids.every((id) => sourceIdSet.has(id))
        ? "PASS"
        : "FAIL",
      `${prefix}: 出典参照を解決`,
    );
    if (Number(catalyst.importance) >= 4) {
      const primary = (catalyst.source_ids ?? []).some((id) => sources.find((source) => source.id === id)?.is_primary);
      push(
        `S02_${prefix}`,
        primary ? "PASS" : "BLOCKING_WARN",
        `${prefix}: 重要度4〜5は一次情報が必要`,
      );
    }
    push(
      `U01_${prefix}`,
      Number(catalyst.importance) < 3 || (catalyst.leading_indicators?.length || catalyst.update_triggers?.length)
        ? "PASS"
        : "INFO_WARN",
      `${prefix}: 先行指標または更新条件を確認`,
    );
  }

  const missingSourceRefs = collectSourceReferences(report).filter((id) => !sourceIdSet.has(id));
  push(
    "C10_SOURCE_REFERENCES",
    missingSourceRefs.length ? "FAIL" : "PASS",
    missingSourceRefs.length ? `未定義の出典ID: ${[...new Set(missingSourceRefs)].join(", ")}` : "全出典参照を解決",
  );

  const dependencyIds = (report.dependency_groups ?? []).flatMap((group) => group.catalyst_ids ?? []);
  const missingDependencies = dependencyIds.filter((id) => !catalystIdSet.has(id));
  push(
    "C11_DEPENDENCIES",
    missingDependencies.length ? "FAIL" : "PASS",
    missingDependencies.length ? `未定義の依存先: ${[...new Set(missingDependencies)].join(", ")}` : "依存関係を解決",
  );
  push(
    "C12_ASSUMPTIONS",
    (report.assumptions ?? []).every((item) => Boolean(
      item.item
      && item.classification
      && evidenceClasses.has(item.classification)
      && item.as_of
      && Array.isArray(item.source_ids)
      && typeof item.note === "string",
    )) ? "PASS" : "FAIL",
    "前提の値・事実区分・基準日・出典を確認",
  );
  push(
    "C13_WATCH_ITEMS",
    (report.watch_items ?? []).every((item) => Boolean(
      item.item
      && item.why_it_matters
      && item.frequency
      && item.update_trigger
      && Array.isArray(item.catalyst_ids)
      && item.catalyst_ids.every((id) => catalystIdSet.has(id)),
    )) ? "PASS" : "FAIL",
    "観測項目と対象カタリストを確認",
  );

  const strings = collectStrings(report);
  const dangerous = strings.filter((item) => dangerousHtml.test(item.value));
  push(
    "SEC01_HTML",
    dangerous.length ? "FAIL" : "PASS",
    dangerous.length ? `危険なHTML: ${dangerous.map((item) => item.path).join(", ")}` : "危険なHTMLなし",
  );
  const claims = strings.filter((item) => forbiddenClaims.some((pattern) => pattern.test(item.value)));
  push(
    "TXT01_NO_ADVICE",
    claims.length ? "FAIL" : "PASS",
    claims.length ? `売買断定: ${claims.map((item) => item.path).join(", ")}` : "売買断定なし",
  );
  push(
    "PUB01_INTERNAL_STATUS",
    report.validation_summary?.status === "FAIL" || Number(report.validation_summary?.fail_count ?? 0) > 0
      ? "FAIL"
      : report.validation_summary?.status === "BLOCKING_WARN" || Number(report.validation_summary?.blocking_warn_count ?? 0) > 0
        ? "BLOCKING_WARN"
        : "PASS",
    "内部Validationに公開停止項目がない",
  );
  for (const message of report.validation_summary?.messages ?? []) {
    if (message?.level === "INFO_WARN") push(`INTERNAL_${message.check_id}`, "INFO_WARN", message.message);
  }

  const failCount = checks.filter((item) => item.status === "FAIL").length;
  const blockingWarnCount = checks.filter((item) => item.status === "BLOCKING_WARN").length;
  const infoWarnCount = checks.filter((item) => item.status === "INFO_WARN").length;
  const status = failCount ? "FAIL" : blockingWarnCount ? "BLOCKING_WARN" : infoWarnCount ? "INFO_WARN" : "PASS";
  return {
    status,
    fail_count: failCount,
    blocking_warn_count: blockingWarnCount,
    info_warn_count: infoWarnCount,
    failCount,
    blockingWarnCount,
    infoWarnCount,
    infoWarnMessages: checks.filter((item) => item.status === "INFO_WARN").map((item) => item.message),
    checks,
  };
}

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
const statusLabels = {
  CATALYST_RICH: "複数の重要材料を観測",
  SELECTIVE: "重要材料を選別して確認",
  EXPECTATIONS_HIGH: "期待先行に注意",
  BINARY: "結果の振れ幅が大きい",
  NO_CONFIRMED_CATALYST: "確認できる主要材料なし",
};
const dateConfidenceLabels = { HIGH: "高い", MEDIUM: "中程度", LOW: "低い" };
const outcomeLabels = { SUCCESS: "上振れ", INLINE: "想定内", FAILURE: "下振れ・遅延" };
const directionClasses = { SUCCESS: "success", INLINE: "inline", FAILURE: "failure" };

function list(items, className = "") {
  return `<ul${className ? ` class="${className}"` : ""}>${(items ?? []).map((item) => `<li>${h(item)}</li>`).join("")}</ul>`;
}

function formatRange(range, suffix = "") {
  if (!rangeIsValid(range)) return "定量不能";
  return `${range[0]}〜${range[1]}${suffix}`;
}

function renderPriced(priced) {
  if (!priced) return `<div class="priced unknown">未算定<p>織り込み度は未設定です。</p></div>`;
  if (!priced.quantifiable || !rangeIsValid(priced.percent_range, 0, 100)) {
    return `<div class="priced unknown">${h(priced.label ?? "UNKNOWN")}<p>${h(priced.unquantifiable_reason ?? priced.qualitative_assessment ?? priced.model ?? "イベント単体価値を分離できません。")}</p></div>`;
  }
  const [low, high] = priced.percent_range;
  return `<div class="priced"><div class="priced-head"><span>推定レンジ</span><b>${h(formatRange(priced.percent_range, "%"))}</b></div><div class="range-meter"><i class="range-band" style="left:${low}%;width:${Math.max(0, high - low)}%"></i></div><p>${h(priced.label)}｜確度 ${h(priced.confidence)}</p></div>`;
}

function renderOutcome(outcome, currency) {
  const price = outcome.quantifiable
    ? `${formatPrice(outcome.price_range?.[0], currency)}〜${formatPrice(outcome.price_range?.[1], currency)}`
    : "定性評価";
  const change = outcome.quantifiable ? formatRange(outcome.price_change_pct_range, "%") : h(outcome.direction);
  return `<div class="outcome ${directionClasses[outcome.label] ?? ""}"><b>${h(outcomeLabels[outcome.label] ?? outcome.label)}</b><div class="impact">${price}</div><p>基準株価比 ${h(change)}</p>${list(outcome.conditions)}${outcome.effect_on_assumptions?.length ? `<p>前提への影響</p>${list(outcome.effect_on_assumptions)}` : ""}</div>`;
}

function renderTimeline(catalysts) {
  return catalysts.map((item) => `<div class="time-row"><div class="time-date">${h(item.date.display_text)}</div><div class="time-dot"></div><div class="time-body"><b>${h(item.title)}</b><p>${h(item.plain_language)}</p><div class="time-meta"><span class="chip">${h(categoryLabels[item.category] ?? item.category)}</span><span class="chip amber">重要度 ${h(item.importance)}</span><span class="chip blue">日程確度 ${h(item.date.confidence)}</span></div></div></div>`).join("");
}

function renderCatalystCard(item, currency) {
  const extra = (item.extra_items ?? []).length
    ? `<div class="facts">${item.extra_items.map((entry) => `<div class="fact"><span>${h(entry.label)}</span><b>${h(entry.value)}</b></div>`).join("")}</div>`
    : "";
  return `<article class="catalyst-card">
    <div class="catalyst-head"><div><div class="chips"><span class="chip">${h(categoryLabels[item.category] ?? item.category)}</span><span class="chip amber">重要度 ${h(item.importance)}</span><span class="chip blue">${h(item.status)}</span></div><h3>${h(item.title)}</h3><p>${h(item.plain_language)}</p></div><div class="date-box"><b>${h(item.date.display_text)}</b><span>${h(item.date.basis)}｜確度 ${h(item.date.confidence)}</span></div></div>
    <p>${h(item.detail ?? item.why_it_matters)}</p>
    ${(item.mechanism ?? []).length ? `<div class="mechanism">${item.mechanism.map((step, index) => `<span>${index ? '<i aria-hidden="true">→</i> ' : ""}${h(step)}</span>`).join("")}</div>` : ""}
    <div class="outcomes">${(item.outcomes ?? []).map((outcome) => renderOutcome(outcome, currency)).join("")}</div>
    ${renderPriced(item.priced_in)}
    ${(item.priced_in?.evidence_for?.length || item.priced_in?.evidence_against?.length) ? `<div class="evidence"><div><h4>織り込みを支持する材料</h4>${list(item.priced_in?.evidence_for)}</div><div><h4>反証・不確実性</h4>${list(item.priced_in?.evidence_against)}</div></div>` : ""}
    <div class="facts"><div class="fact"><span>影響の試算方法</span><b>${h(item.impact_method ?? `優先順位 ${item.quantification_priority ?? "未記録"}`)}</b></div><div class="fact"><span>影響の時間軸</span><b>${h(item.impact_horizon ?? "未設定")}｜確度 ${h(item.impact_confidence ?? "未設定")}</b></div><div class="fact"><span>材料出尽くし</span><b>${h(item.sell_the_news_risk ?? "未評価")}</b></div><div class="fact"><span>資金調達・希薄化</span><b>${h(item.financing_risk ?? item.dilution_impact ?? "未評価")}</b></div></div>
    ${extra}
    <details><summary>先行指標・依存関係・更新条件</summary><div><h4>先行指標</h4>${list(item.leading_indicators)}<h4>依存関係</h4>${list(item.dependencies?.length ? item.dependencies : ["重大な依存関係なし"])}<h4>更新条件</h4>${list(item.update_triggers)}<p class="small">出典ID：${h((item.source_ids ?? []).join(", "))}</p></div></details>
  </article>`;
}

function renderDependencies(groups) {
  if (!groups?.length) return `<p>重大な重複グループはありません。</p>`;
  return groups.map((group) => `<div class="signal"><div><b>${h(group.name)}</b><span class="chip">${h(group.catalyst_ids.join(" / "))}</span></div><p>${h(group.relationship)}</p><p class="small">集計ルール：${h(group.aggregation_rule)}</p></div>`).join("");
}

function renderWatch(items) {
  if (!items?.length) return `<p>定期観測項目は未設定です。</p>`;
  return items.map((item) => `<div class="signal"><div><b>${h(item.item)}</b><span class="chip blue">${h(item.frequency)}</span></div><p>${h(item.why_it_matters)}</p><p class="small">更新条件：${h(item.update_trigger)}｜対象：${h(item.catalyst_ids.join(", "))}</p></div>`).join("");
}

function renderAssumptions(items) {
  return (items ?? []).map((item) => `<tr><td>${h(item.item)}</td><td>${h(item.value)}</td><td>${h(item.classification)}</td><td>${h(item.as_of)}</td><td>${h(item.note)}</td></tr>`).join("");
}

function renderSources(sources) {
  if (!sources?.length) return `<p>出典は未登録です。</p>`;
  return `<ul>${sources.map((source) => {
    const title = /^https?:\/\//.test(source.url ?? "")
      ? `<a href="${h(source.url)}" rel="noopener noreferrer">${h(source.title)}</a>`
      : h(source.title);
    return `<li>${title}<br><span class="small">${h(source.publisher)}｜公開 ${h(source.published_at ?? "不明")}｜取得 ${h(source.accessed_at)}｜${h(source.is_primary ? "一次情報" : source.source_type)}｜対象 ${h(source.supports_catalyst_ids.join(", ") || "全体")}</span></li>`;
  }).join("")}</ul>`;
}

function renderValidation(validation) {
  const exceptions = validation.checks.filter((item) => item.status !== "PASS");
  return `<p><b>${h(validation.status)}</b>｜FAIL ${validation.failCount}件｜BLOCKING_WARN ${validation.blockingWarnCount}件｜INFO_WARN ${validation.infoWarnCount}件</p>${exceptions.length ? list(exceptions.map((item) => `${item.id}: ${item.message}`)) : "<p>公開を止める検証エラーはありません。</p>"}`;
}

function renderHistory(items, meta) {
  const history = items?.length ? items : [{ updated_at: meta.last_updated, change: "初版作成" }];
  return list(history.map((item) => `${item.updated_at}｜${item.change}`));
}

function renderExtraSections(sections) {
  return (sections ?? []).map((section) => `<section class="card" id="${h(section.id)}"><h2>${h(section.title)}</h2><p class="lead">${h(section.summary)}</p><div class="facts">${(section.items ?? []).map((item) => `<div class="fact"><span>${h(item.label)}</span><b>${h(item.value)}</b></div>`).join("")}</div><p class="small">出典ID：${h((section.source_ids ?? []).join(", "))}</p></section>`).join("");
}

export function renderCatalyst(report, template, validation = validateCatalystReport(report)) {
  if (["FAIL", "BLOCKING_WARN"].includes(validation.status)) throw new Error("Catalyst Validationに公開停止項目があるためHTMLを生成しません。");
  const next = (report.catalysts ?? []).find((item) => item.id === report.summary.next_catalyst_id);
  const overall = report.summary.overall_priced_in;
  const warnMessages = [
    ...validation.checks.filter((item) => item.status === "WARN").map((item) => item.message),
    ...(report.validation_summary?.messages ?? []).filter((item) => item?.level === "INFO_WARN").map((item) => item.message),
  ];
  const html = renderTemplate(template, {
    COMPANY_NAME: h(report.meta.company_name),
    TICKER: h(report.meta.ticker),
    EXCHANGE: h(report.meta.exchange),
    VALUATION_DATE: h(report.meta.valuation_date),
    LAST_UPDATED: h(report.meta.last_updated),
    CURRENT_PRICE: formatPrice(report.meta.current_price_fallback, report.meta.currency),
    CURRENT_PRICE_NOTE: h(report.meta.current_price_as_of),
    REPORT_STATUS: h(statusLabels[report.summary.status] ?? report.summary.status),
    SUMMARY_LINE_1: h(report.summary.one_line),
    SUMMARY_LINE_2: h(`最大リスク：${report.summary.primary_risk}`),
    NEXT_CATALYST_TITLE: h(next?.title ?? "確認できる主要材料なし"),
    NEXT_CATALYST_WINDOW: h(next?.date?.display_text ?? report.summary.next_window ?? "時期未定"),
    DATE_CONFIDENCE: h(next ? dateConfidenceLabels[next.date.confidence] ?? next.date.confidence : "未判定"),
    CATALYST_COUNT: `${report.catalysts.length}件`,
    OVERALL_PRICED_IN: h(overall?.quantifiable ? formatRange(overall.percent_range, "%") : overall?.label ?? "未算定"),
    OVERALL_PRICED_LABEL: h(overall?.label ?? "UNKNOWN"),
    OVERALL_PRICED_BLOCK: renderPriced(overall),
    PRICED_IN_CONFIDENCE: h(overall?.confidence ?? "LOW"),
    PRICED_IN_METHOD: h(overall?.model ?? overall?.unquantifiable_reason ?? "未設定"),
    PRIMARY_RISK: h(report.summary.primary_risk),
    SURPRISE_UP: h(report.summary.surprise_up),
    SURPRISE_DOWN: h(report.summary.surprise_down),
    NO_CATALYST_NOTICE: report.catalysts.length ? "" : `<div class="wrap"><div class="notice"><b>確認できる材料なし：</b>十分な検索を行いましたが、評価基準日時点で主要な今後材料を確認できませんでした。</div></div>`,
    WARN_BAND: warnMessages.length ? `<div class="wrap"><div class="notice"><b>確認事項：</b>${h([...new Set(warnMessages)].join(" / "))}</div></div>` : "",
    TIMELINE_ROWS: renderTimeline(report.catalysts),
    CATALYST_CARDS: report.catalysts.map((item) => renderCatalystCard(item, report.meta.currency)).join(""),
    DEPENDENCY_ROWS: renderDependencies(report.dependency_groups),
    WATCH_ROWS: renderWatch(report.watch_items),
    EXTRA_SECTIONS: renderExtraSections(report.extra_sections),
    ASSUMPTION_ROWS: renderAssumptions(report.assumptions),
    SOURCE_DETAILS: renderSources(report.sources),
    VALIDATION_DETAILS: renderValidation(validation),
    UPDATE_HISTORY: renderHistory(report.update_history, report.meta),
    DISCLAIMER: h(report.disclaimer),
    FOOTER_NOTE: `SiM MARKET LAB｜評価基準日 ${h(report.meta.valuation_date)}｜最終更新 ${h(report.meta.last_updated)}｜現在株価だけ自動更新。分析値は評価基準日時点で固定。`,
  });
  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) throw new Error("未置換プレースホルダーが残っています。");
  return html;
}
