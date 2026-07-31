const grid = document.querySelector("#stock-grid");
const status = document.querySelector("#status");
const search = document.querySelector("#stock-search");
const filters = document.querySelector("#market-filters");
const themeFilters = document.querySelector("#theme-filters");
const sort = document.querySelector("#stock-sort");
const cardViewButton = document.querySelector("#card-view");
const listViewButton = document.querySelector("#list-view");
const loadMoreButton = document.querySelector("#load-more");
const manifestUrl = document.body.dataset.manifestUrl || "./data/manifest.json";
const catalystManifestUrl = document.body.dataset.catalystManifestUrl || "./data/catalyst-reports.json";
const linkPrefix = document.body.dataset.linkPrefix ?? (location.pathname.includes("/lab/") ? "../" : "");
const PAGE_SIZE = 12;
let stocks = [];
let activeMarket = "all";
let activeTheme = "all";
let activeSort = "updated";
let activeView = "card";
let visibleCount = PAGE_SIZE;

const preferredThemes = ["AI", "半導体", "宇宙", "量子", "原子力", "防衛", "バイオ", "金融", "エネルギー"];

const latestOverrides = {
  ASPI: {
    updated: "2026-07-17",
    price: { current: 3.945, currency: "USD" },
    scenarios: { bear: 2.5, base: 5.5, bull: 10 },
    positionPct: 19.3,
    zone: "慎重寄り",
    riskReward: "4.19倍",
    catalyst: "2026年Q3 / Si-28初回商業出荷・Renergen商業生産",
    summary: "QLE社債交換で負債は減少。一方、約2,320万株の発行による希薄化を警戒。",
    risk: "非常に高い"
  }
};

const applyLatestOverride = (stock) => {
  const override = latestOverrides[stock.ticker];
  if (!override) return stock;
  return { ...stock, ...override, price: { ...stock.price, ...override.price }, scenarios: { ...stock.scenarios, ...override.scenarios } };
};

const formatPrice = (value, currency = "USD") => Number.isFinite(value)
  ? new Intl.NumberFormat("ja-JP", { style: "currency", currency, maximumFractionDigits: 3 }).format(value)
  : "—";
const addText = (parent, tag, text, className) => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; parent.append(el); return el; };
const setText = (selector, text) => { const el = document.querySelector(selector); if (el) el.textContent = text; };
const numberValue = (value) => {
  if (Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const compareNumber = (a, b, direction = "desc") => {
  const aValue = numberValue(a); const bValue = numberValue(b);
  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return 1;
  if (bValue === null) return -1;
  return direction === "asc" ? aValue - bValue : bValue - aValue;
};
const tieBreak = (a, b) => a.ticker.localeCompare(b.ticker, "ja");
const sorters = {
  updated: (a, b) => b.updated.localeCompare(a.updated) || tieBreak(a, b),
  "price-desc": (a, b) => compareNumber(a.price?.current, b.price?.current) || tieBreak(a, b),
  "price-asc": (a, b) => compareNumber(a.price?.current, b.price?.current, "asc") || tieBreak(a, b),
  "value-desc": (a, b) => compareNumber(a.riskReward, b.riskReward) || compareNumber(a.positionPct, b.positionPct, "asc") || tieBreak(a, b),
  "ticker-asc": tieBreak,
};

function scenarioCell(parent, label, value, currency) {
  const cell = document.createElement("div"); addText(cell, "span", label); addText(cell, "strong", formatPrice(value, currency)); parent.append(cell);
}
function actionLink(parent, label, href, primary = false, variant = "") {
  if (!href) return;
  const link = document.createElement("a"); link.className = ["card-button", primary ? "primary" : "", variant].filter(Boolean).join(" "); link.href = `${linkPrefix}${href}`; link.innerHTML = `<span>${label}</span><b aria-hidden="true">↗</b>`; parent.append(link);
}
function createCard(stock) {
  const card = document.createElement("article"); card.className = "stock-card";
  const head = document.createElement("div"); head.className = "card-head";
  const identity = document.createElement("div"); addText(identity, "p", stock.ticker, "ticker"); addText(identity, "h3", stock.name, "company");
  const badge = addText(head, "span", stock.market, "market-badge"); badge.dataset.market = stock.market; head.prepend(identity); card.append(head);
  const tags = document.createElement("div"); tags.className = "card-tags"; [stock.sector, ...(stock.tags ?? []).slice(0, 2)].filter(Boolean).forEach((tag) => addText(tags, "span", tag)); card.append(tags);
  addText(card, "p", stock.summary, "summary");
  const snapshot = document.createElement("div"); snapshot.className = "snapshot";
  const price = document.createElement("div"); addText(price, "span", "現在株価"); addText(price, "strong", formatPrice(stock.price?.current, stock.price?.currency)); addText(price, "small", `${stock.updated} 更新`); snapshot.append(price);
  const risk = document.createElement("div"); addText(risk, "span", "リスク"); const riskValue = addText(risk, "strong", stock.risk || "—"); riskValue.className = /非常|極めて|VERY/i.test(stock.risk || "") ? "risk very-high" : /高|HIGH/i.test(stock.risk || "") ? "risk high" : "risk"; snapshot.append(risk); card.append(snapshot);
  const row = document.createElement("div"); row.className = "scenario-row"; scenarioCell(row, "BEAR", stock.scenarios?.bear, stock.price?.currency); scenarioCell(row, "BASE", stock.scenarios?.base, stock.price?.currency); scenarioCell(row, "BULL", stock.scenarios?.bull, stock.price?.currency); card.append(row);
  const actions = document.createElement("div"); actions.className = "card-actions"; actionLink(actions, "企業を知る", stock.detailPath); actionLink(actions, "株価を考える", stock.scenarioPath, true); actionLink(actions, "今後のカタリストをみる", stock.catalystPath, false, "catalyst"); card.append(actions);
  return card;
}
function riskClass(risk = "") { return /非常|極めて|VERY/i.test(risk) ? "very-high" : /高|HIGH/i.test(risk) ? "high" : ""; }
function createList(stocksToRender) {
  const wrap = document.createElement("div"); wrap.className = "stock-list-wrap";
  const mobileList = document.createElement("div"); mobileList.className = "stock-mobile-list";
  stocksToRender.forEach((stock) => {
    const item = document.createElement("details"); item.className = "stock-mobile-row";
    const theme = detectTheme(stock);
    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="mobile-stock-id"><strong>${stock.ticker}</strong><small>${stock.name}</small></span><span class="mobile-stock-price"><small>現在株価</small><strong>${formatPrice(stock.price?.current, stock.price?.currency)}</strong></span><span class="mobile-stock-toggle" aria-hidden="true"></span>`;
    const panel = document.createElement("div"); panel.className = "mobile-stock-panel";
    panel.innerHTML = `<div class="mobile-stock-meta"><span>${stock.market}</span><span>${theme === "その他" ? stock.sector : theme}</span><span>${stock.updated} 更新</span></div><div class="mobile-stock-values"><div><small>BASE</small><strong>${formatPrice(stock.scenarios?.base, stock.price?.currency)}</strong></div><div><small>リスク</small><strong class="stock-list-risk ${riskClass(stock.risk)}">${stock.risk || "—"}</strong></div></div><div class="stock-list-actions">${stock.scenarioPath ? `<a class="stock-list-link stock-list-link-primary" href="${linkPrefix}${stock.scenarioPath}">株価を考える →</a>` : ""}${stock.detailPath ? `<a class="stock-list-link" href="${linkPrefix}${stock.detailPath}">企業を知る →</a>` : ""}${stock.catalystPath ? `<a class="stock-list-link stock-list-link-catalyst" href="${linkPrefix}${stock.catalystPath}">今後のカタリストをみる →</a>` : ""}</div>`;
    item.append(summary, panel); mobileList.append(item);
  });
  const table = document.createElement("table"); table.className = "stock-list";
  table.innerHTML = "<thead><tr><th>ティッカー</th><th>企業名</th><th>市場</th><th>テーマ</th><th>現在株価</th><th>BASE</th><th>リスク</th><th>更新日</th><th>レポート</th></tr></thead>";
  const body = document.createElement("tbody");
  stocksToRender.forEach((stock) => {
    const row = document.createElement("tr");
    const theme = detectTheme(stock);
    const detailLink = stock.detailPath ? `<a class="stock-list-link" href="${linkPrefix}${stock.detailPath}">企業を知る →</a>` : "";
    const scenarioLink = stock.scenarioPath ? `<a class="stock-list-link stock-list-link-primary" href="${linkPrefix}${stock.scenarioPath}">株価を考える →</a>` : "";
    const catalystLink = stock.catalystPath ? `<a class="stock-list-link stock-list-link-catalyst" href="${linkPrefix}${stock.catalystPath}">今後のカタリストをみる →</a>` : "";
    row.innerHTML = `<td class="stock-list-ticker">${stock.ticker}</td><td class="stock-list-company">${stock.name}</td><td>${stock.market}</td><td>${theme === "その他" ? stock.sector : theme}</td><td>${formatPrice(stock.price?.current, stock.price?.currency)}</td><td>${formatPrice(stock.scenarios?.base, stock.price?.currency)}</td><td><span class="stock-list-risk ${riskClass(stock.risk)}">${stock.risk || "—"}</span></td><td>${stock.updated}</td><td><div class="stock-list-actions">${detailLink}${scenarioLink}${catalystLink}</div></td>`;
    body.append(row);
  });
  table.append(body); wrap.append(mobileList, table); return wrap;
}
function stockSearchText(stock) { return [stock.ticker, stock.name, stock.market, stock.sector, stock.method, stock.summary, stock.catalyst, ...(stock.tags ?? [])].join(" ").toLowerCase(); }
function detectTheme(stock) {
  const text = stockSearchText(stock);
  const rules = [
    ["AI", /\bai\b|人工知能|watsonx|athena|データセンター|xpu/],
    ["半導体", /半導体|メモリ|ddr|nand|dram|チップ|silicon|光インターコネクト/],
    ["宇宙", /宇宙|衛星|ロケット|space|launch/],
    ["量子", /量子|quantum/],
    ["原子力", /原子力|原子炉|核融合|uranium|nuclear/],
    ["防衛", /防衛|軍事|defense|ミサイル/],
    ["バイオ", /バイオ|創薬|医薬|抗体|治療|biolog/],
    ["金融", /金融|銀行|融資|fintech|保険/],
    ["エネルギー", /エネルギー|太陽電池|電力|solar|battery/]
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || "その他";
}
function renderThemeFilters() {
  if (!themeFilters) return;
  const counts = new Map(preferredThemes.map((theme) => [theme, stocks.filter((stock) => detectTheme(stock) === theme).length]));
  const visibleThemes = preferredThemes.filter((theme) => counts.get(theme) > 0);
  themeFilters.replaceChildren();
  [["all", "すべて", stocks.length], ...visibleThemes.map((theme) => [theme, theme, counts.get(theme)])].forEach(([value, label, count]) => {
    const button = document.createElement("button"); button.type = "button"; button.className = `theme-chip${activeTheme === value ? " active" : ""}`; button.dataset.theme = value; button.innerHTML = `<span>${label}</span><small>${count}</small>`; themeFilters.append(button);
  });
}
function getFilteredStocks(query = "") {
  const normalized = query.trim().toLowerCase();
  return stocks.filter((stock) => {
    const marketMatch = activeMarket === "all" || stock.market === activeMarket;
    const themeMatch = activeTheme === "all" || detectTheme(stock) === activeTheme;
    const searchMatch = stockSearchText(stock).includes(normalized);
    return marketMatch && themeMatch && searchMatch;
  }).sort(sorters[activeSort] ?? sorters.updated);
}
function render(query = "") {
  const filtered = getFilteredStocks(query);
  const visible = filtered.slice(0, visibleCount);
  grid.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = "条件に一致する銘柄がありません。"; grid.className = ""; grid.append(empty);
  } else if (activeView === "card") {
    grid.className = "stock-grid compact-view"; visible.forEach((stock) => grid.append(createCard(stock)));
  } else {
    grid.className = ""; grid.append(createList(visible));
  }
  const normalized = query.trim();
  status.textContent = normalized || activeTheme !== "all" || activeMarket !== "all" ? `${filtered.length}件が一致しました（${visible.length}件表示）` : `${filtered.length}銘柄のうち${visible.length}件を表示中`;
  loadMoreButton.hidden = visible.length >= filtered.length;
  if (!loadMoreButton.hidden) loadMoreButton.textContent = `さらに${Math.min(PAGE_SIZE, filtered.length - visible.length)}件表示`;
}
async function init() {
  try {
    const response = await fetch(manifestUrl, { cache: "no-store" }); if (!response.ok) throw new Error(`一覧データを取得できませんでした（${response.status}）`);
    const catalystPaths = await loadCatalystPaths();
    stocks = (await response.json())
      .filter((stock) => stock.status !== "draft")
      .map(applyLatestOverride)
      .map((stock) => ({ ...stock, catalystPath: catalystPaths.get(stock.ticker) }));
    setText("#hero-total", stocks.length); setText("#hero-us", stocks.filter((s) => s.market === "米国株").length); setText("#hero-jp", stocks.filter((s) => s.market === "日本株").length);
    renderThemeFilters(); render();
  } catch (error) { status.className = "error-panel"; status.textContent = `${error.message}。GitHub Pagesの更新状況を確認してください。`; }
}

function safeCatalystPath(value) {
  return typeof value === "string"
    && !value.includes("..")
    && /^stocks\/[^/?#]+\/catalysts\.html$/.test(value);
}

async function loadCatalystPaths() {
  try {
    const response = await fetch(catalystManifestUrl, { cache: "no-store" });
    if (!response.ok) return new Map();
    const payload = await response.json();
    if (!Array.isArray(payload) && payload?.schemaVersion !== 1) return new Map();
    const reports = Array.isArray(payload) ? payload : payload?.reports;
    if (!Array.isArray(reports)) return new Map();
    const paths = new Map();
    for (const report of reports) {
      if (report?.status === "draft") continue;
      const valid = report?.status === "published"
        && /^[A-Z0-9.-]+$/.test(report.ticker ?? "")
        && safeCatalystPath(report.path)
        && Boolean(report.reviewedBy)
        && /^\d{4}-\d{2}-\d{2}$/.test(report.reviewedAt ?? "");
      if (!valid || paths.has(report.ticker)) return new Map();
      paths.set(report.ticker, report.path);
    }
    return paths;
  } catch {
    return new Map();
  }
}
search?.addEventListener("input", (event) => { visibleCount = PAGE_SIZE; render(event.target.value); });
filters?.addEventListener("click", (event) => { const button = event.target.closest(".filter-tab"); if (!button) return; filters.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.remove("active")); button.classList.add("active"); activeMarket = button.dataset.market; visibleCount = PAGE_SIZE; render(search.value); });
themeFilters?.addEventListener("click", (event) => { const button = event.target.closest(".theme-chip"); if (!button) return; activeTheme = button.dataset.theme; visibleCount = PAGE_SIZE; renderThemeFilters(); render(search.value); });
sort?.addEventListener("change", (event) => { activeSort = event.target.value; visibleCount = PAGE_SIZE; render(search.value); });
cardViewButton?.addEventListener("click", () => { activeView = "card"; cardViewButton.classList.add("active"); listViewButton.classList.remove("active"); render(search.value); });
listViewButton?.addEventListener("click", () => { activeView = "list"; listViewButton.classList.add("active"); cardViewButton.classList.remove("active"); render(search.value); });
loadMoreButton?.addEventListener("click", () => { visibleCount += PAGE_SIZE; render(search.value); });
init();
