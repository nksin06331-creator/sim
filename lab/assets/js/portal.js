const grid = document.querySelector("#stock-grid");
const status = document.querySelector("#status");
const search = document.querySelector("#stock-search");
const filters = document.querySelector("#market-filters");
const manifestUrl = document.body.dataset.manifestUrl || "./data/manifest.json";
const linkPrefix = document.body.dataset.linkPrefix ?? (location.pathname.includes("/lab/") ? "../" : "");
let stocks = [];
let activeMarket = "all";

const formatPrice = (value, currency = "USD") => {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

const addText = (parent, tag, text, className) => {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
};

const setText = (selector, text) => {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
};

function scenarioCell(parent, label, value, currency) {
  const cell = document.createElement("div");
  addText(cell, "span", label);
  addText(cell, "strong", formatPrice(value, currency));
  parent.append(cell);
}

function metaItem(parent, label, value) {
  if (!value) return;
  const item = document.createElement("span");
  addText(item, "small", label);
  addText(item, "strong", value);
  parent.append(item);
}

function actionLink(parent, label, href, primary = false) {
  const link = document.createElement("a");
  link.className = primary ? "card-button primary" : "card-button";
  link.href = `${linkPrefix}${href}`;
  link.textContent = label;
  parent.append(link);
}

function createCard(stock) {
  const card = document.createElement("article");
  card.className = "stock-card";

  const top = document.createElement("div");
  top.className = "card-top";
  addText(top, "span", stock.market, "tag");
  addText(top, "span", stock.sector, "tag");
  addText(top, "span", stock.method, "tag");
  card.append(top);

  const title = document.createElement("div");
  title.className = "card-title";
  addText(title, "h3", stock.ticker, "ticker");
  addText(title, "p", stock.name, "company");
  card.append(title);

  addText(card, "p", stock.summary, "summary");

  const price = document.createElement("div");
  price.className = "price-strip";
  addText(price, "span", "更新時株価");
  addText(price, "strong", formatPrice(stock.price.current, stock.price.currency));
  addText(price, "small", `${stock.updated}時点`);
  card.append(price);

  const row = document.createElement("div");
  row.className = "scenario-row";
  scenarioCell(row, "Bear", stock.scenarios.bear, stock.price.currency);
  scenarioCell(row, "Base", stock.scenarios.base, stock.price.currency);
  scenarioCell(row, "Bull", stock.scenarios.bull, stock.price.currency);
  card.append(row);

  const meta = document.createElement("div");
  meta.className = "card-footer";
  metaItem(meta, "リスク", stock.risk);
  metaItem(meta, "注目点", stock.catalyst);
  card.append(meta);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actionLink(actions, "企業詳細を見る", stock.detailPath);
  actionLink(actions, "シナリオ試算を見る", stock.scenarioPath, true);
  card.append(actions);
  return card;
}

function render(query = "") {
  grid.replaceChildren();
  const normalized = query.trim().toLowerCase();
  const filtered = stocks.filter((stock) => {
    const marketOk = activeMarket === "all" || stock.market === activeMarket;
    const searchOk = [stock.ticker, stock.name, stock.market, stock.sector, stock.method, stock.summary, stock.catalyst, ...(stock.tags ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(normalized);
    return marketOk && searchOk;
  });
  filtered.forEach((stock) => grid.append(createCard(stock)));
  status.textContent = normalized
    ? `${filtered.length}件が一致しました`
    : `${filtered.length}銘柄をmeta.jsonから自動掲載中`;
}

async function init() {
  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`一覧データを取得できませんでした（${response.status}）`);
    stocks = await response.json();
    setText("#hero-total", stocks.length);
    setText("#hero-us", stocks.filter((stock) => stock.market === "米国株").length);
    setText("#hero-jp", stocks.filter((stock) => stock.market === "日本株").length);
    render();
  } catch (error) {
    status.className = "error-panel";
    status.textContent = `${error.message}。GitHub Pagesの更新状況を確認してください。`;
  }
}

search.addEventListener("input", (event) => render(event.target.value));
filters?.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-tab");
  if (!button) return;
  filters.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.remove("active"));
  button.classList.add("active");
  activeMarket = button.dataset.market;
  render(search.value);
});
init();
