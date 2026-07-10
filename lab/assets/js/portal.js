const grid = document.querySelector("#stock-grid");
const status = document.querySelector("#status");
const search = document.querySelector("#stock-search");
let stocks = [];

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

function scenarioCell(parent, label, value, currency) {
  const cell = document.createElement("div");
  addText(cell, "span", label);
  addText(cell, "strong", formatPrice(value, currency));
  parent.append(cell);
}

function actionLink(parent, label, href, primary = false) {
  const link = document.createElement("a");
  link.className = primary ? "card-button primary" : "card-button";
  link.href = `../${href}`;
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

  addText(card, "h3", stock.ticker, "ticker");
  addText(card, "p", stock.name, "company");
  addText(card, "p", stock.summary, "summary");

  const row = document.createElement("div");
  row.className = "scenario-row";
  scenarioCell(row, "Bear", stock.scenarios.bear, stock.price.currency);
  scenarioCell(row, "Base", stock.scenarios.base, stock.price.currency);
  scenarioCell(row, "Bull", stock.scenarios.bull, stock.price.currency);
  card.append(row);

  const meta = document.createElement("div");
  meta.className = "card-footer";
  addText(meta, "span", `現在値 ${formatPrice(stock.price.current, stock.price.currency)}`);
  addText(meta, "span", `${stock.zone} / 更新 ${stock.updated}`);
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
  const filtered = stocks.filter((stock) =>
    [stock.ticker, stock.name, stock.market, stock.sector, stock.method, ...(stock.tags ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );
  filtered.forEach((stock) => grid.append(createCard(stock)));
  status.textContent = normalized
    ? `${filtered.length}件が一致しました`
    : `${filtered.length}銘柄をmeta.jsonから自動掲載中`;
}

async function init() {
  try {
    const response = await fetch("./data/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`一覧データを取得できませんでした（${response.status}）`);
    stocks = await response.json();
    render();
  } catch (error) {
    status.className = "error-panel";
    status.textContent = `${error.message}。GitHub Pagesの更新状況を確認してください。`;
  }
}

search.addEventListener("input", (event) => render(event.target.value));
init();
