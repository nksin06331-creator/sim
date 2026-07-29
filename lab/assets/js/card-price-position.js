(() => {
  const parsePrice = (text = "") => {
    const normalized = text.replace(/[^0-9.-]/g, "");
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function buildPositionBar(card) {
    if (card.querySelector(".price-position")) return;

    const currentText = card.querySelector(".snapshot > div:first-child strong")?.textContent;
    const scenarioValues = [...card.querySelectorAll(".scenario-row strong")].map((el) => parsePrice(el.textContent));
    const current = parsePrice(currentText);
    const [bear, base, bull] = scenarioValues;

    if (![current, bear, base, bull].every(Number.isFinite) || !(bear < base && base < bull)) return;

    const rawPosition = ((current - bear) / (bull - bear)) * 100;
    const position = clamp(rawPosition, 2, 98);
    const rangeState = current < bear ? "below" : current > bull ? "above" : "inside";

    const block = document.createElement("div");
    block.className = `price-position ${rangeState}`;
    block.setAttribute("aria-label", `現在株価はBearからBullの価格帯の${Math.round(rawPosition)}パーセント位置です`);
    block.innerHTML = `
      <div class="price-position-head">
        <span>現在株価の位置</span>
        <strong>${currentText || "—"}</strong>
      </div>
      <div class="price-position-scale" aria-hidden="true">
        <span>BEAR</span><span>BASE</span><span>BULL</span>
      </div>
      <div class="price-position-track" aria-hidden="true">
        <span class="price-position-marker" style="left:${position}%"></span>
      </div>
      <div class="price-position-values" aria-hidden="true">
        <span>${card.querySelector(".scenario-row strong:nth-of-type(1)")?.textContent || ""}</span>
        <span>${card.querySelector(".scenario-row div:nth-child(2) strong")?.textContent || ""}</span>
        <span>${card.querySelector(".scenario-row div:nth-child(3) strong")?.textContent || ""}</span>
      </div>`;

    const scenarioRow = card.querySelector(".scenario-row");
    scenarioRow?.before(block);
  }

  const enhanceCards = () => document.querySelectorAll(".stock-card").forEach(buildPositionBar);
  const grid = document.querySelector("#stock-grid");
  if (!grid) return;

  enhanceCards();
  new MutationObserver(enhanceCards).observe(grid, { childList: true, subtree: true });
})();
