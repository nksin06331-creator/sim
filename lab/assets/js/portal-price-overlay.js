(() => {
  const nativeFetch = window.fetch.bind(window);
  const PRICE_URL = new URL("./data/prices.json", document.baseURI).href;

  const normalizeTicker = (value) => String(value || "").trim().toUpperCase();

  window.fetch = async (input, init) => {
    const requestUrl = new URL(typeof input === "string" ? input : input.url, document.baseURI);
    const response = await nativeFetch(input, init);

    if (!requestUrl.pathname.includes("/data/manifest") || !response.ok) return response;

    try {
      const [manifest, priceResponse] = await Promise.all([
        response.clone().json(),
        nativeFetch(`${PRICE_URL}?v=${Date.now()}`, { cache: "no-store" })
      ]);
      if (!priceResponse.ok) return response;

      const payload = await priceResponse.json();
      const prices = payload.prices || payload;
      const merged = manifest.map((stock) => {
        const live = prices[normalizeTicker(stock.ticker)];
        if (!live || !Number.isFinite(Number(live.price))) return stock;
        return {
          ...stock,
          price: {
            ...stock.price,
            current: Number(live.price),
            currency: live.currency || stock.price?.currency
          },
          livePriceUpdated: live.marketTime || live.updatedAt || payload.generatedAt || null
        };
      });

      return new Response(JSON.stringify(merged), {
        status: response.status,
        statusText: response.statusText,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    } catch (error) {
      console.warn("SiM live price overlay failed; using report prices.", error);
      return response;
    }
  };
})();
