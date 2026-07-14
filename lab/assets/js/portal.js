const grid = document.querySelector("#stock-grid");
const status = document.querySelector("#status");
const search = document.querySelector("#stock-search");
const filters = document.querySelector("#market-filters");
const sort = document.querySelector("#stock-sort");
const manifestUrl = document.body.dataset.manifestUrl || "./data/manifest.json";
const linkPrefix = document.body.dataset.linkPrefix ?? (location.pathname.includes("/lab/") ? "../" : "");
let stocks = [];
let activeMarket = "all";
let activeSort = "updated";

const formatPrice = (value, currency = "USD") => Number.isFinite(value)
  ? new Intl.NumberFormat("ja-JP", { style: "currency", currency, maximumFractionDigits: 2 }).format(value)
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
  const aValue = numberValue(a);
  const bValue = numberValue(b);
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
  const cell = document.createElement("div");
  addText(cell, "span", label);
  addText(cell, "strong", formatPrice(value, currency));
  parent.append(cell);
}
function actionLink(parent, label, href, primary = false) {
  if (!href) return;
  const link = document.createElement("a");
  link.className = primary ? "card-button primary" : "card-button";
  link.href = `${linkPrefix}${href}`;
  link.innerHTML = `<span>${label}</span><b aria-hidden="true">↗</b>`;
  parent.append(link);
}
function createCard(stock) {
  const card = document.createElement("article");
  card.className = "stock-card";
  const head = document.createElement("div"); head.className = "card-head";
  const identity = document.createElement("div");
  addText(identity, "p", stock.ticker, "ticker"); addText(identity, "h3", stock.name, "company");
  const badge = addText(head, "span", stock.market, "market-badge"); badge.dataset.market = stock.market;
  head.prepend(identity); card.append(head);
  const tags = document.createElement("div"); tags.className = "card-tags";
  [stock.sector, stock.method].filter(Boolean).forEach((tag) => addText(tags, "span", tag)); card.append(tags);
  addText(card, "p", stock.summary, "summary");
  const snapshot = document.createElement("div"); snapshot.className = "snapshot";
  const price = document.createElement("div"); addText(price, "span", "現在株価"); addText(price, "strong", formatPrice(stock.price?.current, stock.price?.currency)); addText(price, "small", `${stock.updated} 更新`); snapshot.append(price);
  const risk = document.createElement("div"); addText(risk, "span", "リスク"); const riskValue = addText(risk, "strong", stock.risk || "—"); riskValue.className = /非常|VERY/i.test(stock.risk || "") ? "risk very-high" : /高|HIGH/i.test(stock.risk || "") ? "risk high" : "risk"; snapshot.append(risk); card.append(snapshot);
  const row = document.createElement("div"); row.className = "scenario-row";
  scenarioCell(row, "BEAR", stock.scenarios?.bear, stock.price?.currency); scenarioCell(row, "BASE", stock.scenarios?.base, stock.price?.currency); scenarioCell(row, "BULL", stock.scenarios?.bull, stock.price?.currency); card.append(row);
  if (Number.isFinite(stock.positionPct)) {
    const position = document.createElement("div"); position.className = "position-block";
    const label = document.createElement("div"); label.className = "position-label"; addText(label, "span", "シナリオ帯の現在地"); addText(label, "strong", stock.zone || `${stock.positionPct}%`); position.append(label);
    const track = document.createElement("div"); track.className = "position-track"; const marker = document.createElement("span"); marker.style.left = `${Math.max(0, Math.min(100, stock.positionPct))}%`; track.append(marker); position.append(track);
    const ends = document.createElement("div"); ends.className = "position-ends"; addText(ends, "span", "BEAR"); addText(ends, "span", "BULL"); position.append(ends); card.append(position);
  }
  if (stock.catalyst) { const catalyst = document.createElement("div"); catalyst.className = "catalyst"; addText(catalyst, "span", "NEXT CATALYST"); addText(catalyst, "p", stock.catalyst); card.append(catalyst); }
  const actions = document.createElement("div"); actions.className = "card-actions";
  actionLink(actions, "企業を知る", stock.detailPath); actionLink(actions, "株価を考える", stock.scenarioPath, true); card.append(actions);
  return card;
}
function render(query = "") {
  grid.replaceChildren(); const normalized = query.trim().toLowerCase();
  const filtered = stocks.filter((stock) => (activeMarket === "all" || stock.market === activeMarket) && [stock.ticker, stock.name, stock.market, stock.sector, stock.method, stock.summary, stock.catalyst, ...(stock.tags ?? [])].join(" ").toLowerCase().includes(normalized)).sort(sorters[activeSort] ?? sorters.updated);
  filtered.forEach((stock) => grid.append(createCard(stock)));
  status.textContent = normalized ? `${filtered.length}件が一致しました` : `${filtered.length}銘柄のレポートを公開中`;
}
async function init() {
  try {
    const response = await fetch(manifestUrl, { cache: "no-store" }); if (!response.ok) throw new Error(`一覧データを取得できませんでした（${response.status}）`);
    stocks = (await response.json()).filter((stock) => stock.status !== "draft");
    setText("#hero-total", stocks.length); setText("#hero-us", stocks.filter((s) => s.market === "米国株").length); setText("#hero-jp", stocks.filter((s) => s.market === "日本株").length); render();
  } catch (error) { status.className = "error-panel"; status.textContent = `${error.message}。GitHub Pagesの更新状況を確認してください。`; }
}
search?.addEventListener("input", (event) => render(event.target.value));
filters?.addEventListener("click", (event) => { const button = event.target.closest(".filter-tab"); if (!button) return; filters.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.remove("active")); button.classList.add("active"); activeMarket = button.dataset.market; render(search.value); });
sort?.addEventListener("change", (event) => { activeSort = event.target.value; render(search.value); });
init();
