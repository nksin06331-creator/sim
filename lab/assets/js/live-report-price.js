(() => {
  const ticker = String(document.body.dataset.stockTicker || "").trim().toUpperCase();
  const source = document.body.dataset.priceSource || "../../data/prices.json";
  if (!ticker) return;

  const formatPrice = (value, currency) => new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: currency || "JPY",
    maximumFractionDigits: currency === "JPY" ? 0 : 3
  }).format(value);

  const formatDate = (value) => {
    if (!value) return "株価データ取得済み";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date)} 時点`;
  };

  fetch(`${source}${source.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const prices = payload.prices || payload;
      const quote = prices[ticker];
      const price = Number(quote?.price);
      if (!Number.isFinite(price)) throw new Error(`${ticker} price unavailable`);

      document.querySelectorAll("[data-live-price]").forEach((element) => {
        element.textContent = formatPrice(price, quote.currency);
      });
      document.querySelectorAll("[data-live-price-date]").forEach((element) => {
        element.textContent = formatDate(quote.marketTime || quote.updatedAt || payload.generatedAt);
      });
      document.documentElement.dataset.livePriceLoaded = "true";
    })
    .catch((error) => {
      console.warn("SiM live price load failed; keeping the analysis-date price.", error);
      document.querySelectorAll("[data-live-price-date]").forEach((element) => {
        element.textContent = `${element.textContent}｜自動更新を確認できませんでした`;
      });
    });
})();
