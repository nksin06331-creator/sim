const root = document.querySelector("#report-root");
const status = document.querySelector("#report-status");

const addText = (parent, tag, text, className) => {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
};

const formatPrice = (value, currency = "USD") => {
  if (!Number.isFinite(value)) return "—";
  if (currency === "TEST") return `${value.toLocaleString("ja-JP")} pt`;
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

function addScenario(parent, label, value, stock, className = "") {
  const card = document.createElement("div");
  card.className = `scenario-card ${className}`.trim();
  addText(card, "span", label);
  addText(card, "strong", formatPrice(value, stock.price.currency));
  if (label !== "Current" && stock.price.current) {
    const change = ((value / stock.price.current) - 1) * 100;
    addText(card, "small", `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs 現在値`);
  } else {
    addText(card, "small", "基準値");
  }
  parent.append(card);
}

function renderBlock(parent, block) {
  if (block.type === "paragraph") {
    addText(parent, "p", block.text);
    return;
  }
  if (block.type === "bullets" && Array.isArray(block.items)) {
    const list = document.createElement("ul");
    list.className = "bullet-list";
    block.items.forEach((item) => addText(list, "li", item));
    parent.append(list);
  }
}

function renderReport(stock) {
  root.replaceChildren();
  document.title = `${stock.ticker} | ${stock.name} | Stock Scenario Lab`;

  const hero = document.createElement("section");
  hero.className = "report-hero";
  const kicker = document.createElement("div");
  kicker.className = "report-kicker";
  addText(kicker, "span", stock.market, "tag");
  addText(kicker, "span", stock.sector, "tag");
  if (stock.isDemo) addText(kicker, "span", "TEST DATA", "tag");
  hero.append(kicker);
  addText(hero, "h1", stock.ticker, "report-title");
  addText(hero, "p", stock.name, "report-company");
  addText(hero, "p", stock.summary, "report-summary");

  const scenarios = document.createElement("div");
  scenarios.className = "scenario-grid";
  addScenario(scenarios, "Current", stock.price.current, stock);
  addScenario(scenarios, "Bear", stock.scenarios.bear, stock, "bear");
  addScenario(scenarios, "Base", stock.scenarios.base, stock, "base");
  addScenario(scenarios, "Bull", stock.scenarios.bull, stock, "bull");
  hero.append(scenarios);
  root.append(hero);

  stock.sections.forEach((data) => {
    const section = document.createElement("section");
    section.className = "report-section";
    section.id = data.id;
    addText(section, "h2", data.title);
    data.blocks.forEach((block) => renderBlock(section, block));
    root.append(section);
  });

  if (stock.sources?.length) {
    const section = document.createElement("section");
    section.className = "report-section";
    addText(section, "h2", "出典");
    const list = document.createElement("div");
    list.className = "source-list";
    stock.sources.forEach((source) => {
      const link = document.createElement("a");
      link.textContent = source.label;
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      list.append(link);
    });
    section.append(list);
    root.append(section);
  }
}

async function init() {
  const ticker = new URLSearchParams(location.search).get("ticker")?.toUpperCase();
  if (!ticker) {
    status.className = "error-panel";
    status.textContent = "URLにtickerが指定されていません。銘柄一覧から開いてください。";
    return;
  }

  try {
    const manifestResponse = await fetch("./data/manifest.json", { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error("銘柄一覧を取得できませんでした");
    const manifest = await manifestResponse.json();
    const entry = manifest.find((stock) => stock.ticker.toUpperCase() === ticker);
    if (!entry) throw new Error(`${ticker}は公開銘柄に登録されていません`);

    const stockResponse = await fetch(`./data/stocks/${encodeURIComponent(entry.slug)}.json`, { cache: "no-store" });
    if (!stockResponse.ok) throw new Error(`${ticker}のデータを取得できませんでした`);
    renderReport(await stockResponse.json());
  } catch (error) {
    status.className = "error-panel";
    status.textContent = error.message;
  }
}

init();
