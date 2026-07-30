import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "data", "manifest-20260729-60.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const scriptTag = '<script src="../../lab/assets/js/live-report-price.js" defer></script>';
const liveBadge = '<span style="color:#6EE24E;font-size:10px;font-weight:700;letter-spacing:.04em">LIVE</span>';

function addAttribute(tag, name, value = null) {
  if (new RegExp(`\\s${name}(?:\\s|=|>)`, "i").test(tag)) return tag;
  const attribute = value === null ? ` ${name}` : ` ${name}="${value}"`;
  return tag.replace(/>$/, `${attribute}>`);
}

function isInsideComment(html, index) {
  return html.lastIndexOf("<!--", index) > html.lastIndexOf("-->", index);
}

function replaceFirstOutsideComment(html, regex, predicate, replacer) {
  regex.lastIndex = 0;
  for (const match of html.matchAll(regex)) {
    if (isInsideComment(html, match.index)) continue;
    if (!predicate(match[0])) continue;
    const replacement = replacer(match[0]);
    return `${html.slice(0, match.index)}${replacement}${html.slice(match.index + match[0].length)}`;
  }
  return html;
}

function addBodySettings(html, ticker) {
  return html.replace(/<body\b[^>]*>/i, (bodyTag) => {
    let updated = addAttribute(bodyTag, "data-stock-ticker", ticker);
    updated = addAttribute(updated, "data-price-source", "../../data/prices.json");
    return updated;
  });
}

function addLiveBadge(labelHtml) {
  if (/LIVE/i.test(labelHtml)) return labelHtml;
  return labelHtml.replace(/(<\/(?:div|small|span)>$)/i, ` ${liveBadge}$1`);
}

function markTemplateStatCard(card) {
  let updated = card.replace(/<div class="stat-value([^>]*)>/i, (tag) => addAttribute(tag, "data-live-price"));
  updated = updated.replace(
    /<div class="stat-label">[\s\S]*?<\/div>/i,
    `<div class="stat-label">現在株価 ${liveBadge}</div>`,
  );

  const dateNote = /<div class="stat-note[^>]*>[\s\S]*?(?:\d{4}[/-]\d{1,2}|\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}|終値|取得|時点|基準)[\s\S]*?<\/div>/i;
  if (dateNote.test(updated)) {
    updated = updated.replace(dateNote, (note) => {
      const withAttribute = note.replace(/<div class="stat-note([^>]*)>/i, (tag) => addAttribute(tag, "data-live-price-date"));
      return /分析基準値/.test(withAttribute)
        ? withAttribute
        : withAttribute.replace(/<\/div>$/, "（分析基準値）</div>");
    });
  } else {
    updated = updated.replace(/<\/div>$/, '<div class="stat-note" data-live-price-date>分析基準値</div></div>');
  }
  return updated;
}

function normalizeTemplateLiveCard(card) {
  let updated = card.replace(
    /<div class="stat-label">[\s\S]*?<\/div>/i,
    `<div class="stat-label">現在株価 ${liveBadge}</div>`,
  );
  const liveNote = updated.match(/<div class="stat-note"[^>]*data-live-price-date[^>]*>([\s\S]*?)<\/div>/i);
  if (!liveNote) {
    return updated.replace(/<\/div>$/, '<div class="stat-note" data-live-price-date>分析基準値</div></div>');
  }

  const text = liveNote[1].replace(/<[^>]*>/g, "").trim();
  const fallbackText = text.replace(/（分析基準値）$/, "").trim();
  const dateLike = fallbackText === ""
    || /(?:\d{4}[/-]\d{1,2}|\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}|終値|取得|時点|基準)/.test(fallbackText);
  if (dateLike) return updated;

  const repairedNote = liveNote[0]
    .replace(/\sdata-live-price-date(?:="[^"]*")?/i, "")
    .replace(/（分析基準値）(?=<\/div>)/, "");
  updated = updated.replace(liveNote[0], repairedNote);
  return updated.replace(/<\/div>$/, '<div class="stat-note" data-live-price-date>分析基準値</div></div>');
}

function normalizeIndexPrice(html) {
  const templateCard = /<div class="stat"><div class="stat-value[^>]*data-live-price(?:\s|>)[\s\S]*?<\/div><div class="stat-label">[\s\S]*?<\/div>(?:<div class="stat-note"[^>]*>[\s\S]*?<\/div>)*<\/div>/gi;
  return replaceFirstOutsideComment(
    html,
    templateCard,
    () => true,
    normalizeTemplateLiveCard,
  );
}

function markCompactStatCard(card) {
  let updated = card.replace(/<b([^>]*)>/i, (tag) => addAttribute(tag, "data-live-price"));
  updated = updated.replace(/<(small|span)([^>]*)>[\s\S]*?(?:現在株価|現在の株価|現値|株価)[\s\S]*?<\/\1>/i, addLiveBadge);

  const priceEnd = updated.search(/<\/b>/i);
  const trailing = priceEnd >= 0 ? updated.slice(priceEnd + 4) : "";
  if (/<small\b/i.test(trailing)) {
    const before = updated.slice(0, priceEnd + 4);
    let after = trailing.replace(/<small([^>]*)>/i, (tag) => addAttribute(tag, "data-live-price-date"));
    if (!/分析基準値/.test(after.match(/<small[^>]*>[\s\S]*?<\/small>/i)?.[0] ?? "")) {
      after = after.replace(/(<small[^>]*>[\s\S]*?)(<\/small>)/i, "$1（分析基準値）$2");
    }
    updated = `${before}${after}`;
  } else {
    updated = updated.replace(/<\/b>/i, '</b><small data-live-price-date>分析基準値</small>');
  }
  return updated;
}

function markIndexPrice(html) {
  if (!/data-live-price(?:\s|>)/i.test(html)) {
    const templateCard = /<div class="stat"><div class="stat-value[^>]*>[\s\S]*?<\/div><div class="stat-label">[\s\S]*?<\/div>(?:<div class="stat-note"[^>]*>[\s\S]*?<\/div>)*<\/div>/gi;
    html = replaceFirstOutsideComment(
      html,
      templateCard,
      () => true,
      markTemplateStatCard,
    );
  }

  if (!/data-live-price(?:\s|>)/i.test(html)) {
    const compactCard = /<div class="(?:card )?stat">[\s\S]*?<\/div>/gi;
    html = replaceFirstOutsideComment(
      html,
      compactCard,
      () => true,
      markCompactStatCard,
    );
  }
  return normalizeIndexPrice(html);
}

function markKpiCard(card) {
  let updated = card.replace(/<b([^>]*)>/i, (tag) => addAttribute(tag, "data-live-price"));
  updated = updated.replace(/<span([^>]*)>[\s\S]*?現在株価[\s\S]*?<\/span>/i, (label) => {
    if (/LIVE/i.test(label)) return label;
    return label.replace(/<\/span>$/i, ' <em style="font-style:normal;color:#6EE24E;font-size:10px">LIVE</em></span>');
  });
  if (/<small\b/i.test(updated)) {
    updated = updated.replace(/<small([^>]*)>/i, (tag) => addAttribute(tag, "data-live-price-date"));
    if (!/分析基準値/.test(updated.match(/<small[^>]*>[\s\S]*?<\/small>/i)?.[0] ?? "")) {
      updated = updated.replace(/(<small[^>]*>[\s\S]*?)(<\/small>)/i, "$1（分析基準値）$2");
    }
  } else {
    updated = updated.replace(/<\/b>/i, '</b><small data-live-price-date>分析基準値</small>');
  }
  return updated;
}

function markScenarioPrice(html) {
  if (!/data-live-price(?:\s|>)/i.test(html)) {
    const kpiCard = /<div class="kpi">[\s\S]*?<\/div>/gi;
    html = replaceFirstOutsideComment(
      html,
      kpiCard,
      (card) => /<span[^>]*>[\s\S]*?現在株価[\s\S]*?<\/span>/i.test(card),
      markKpiCard,
    );
  }

  if (!/data-live-price(?:\s|>)/i.test(html)) {
    const statCard = /<div class="(?:card )?stat">[\s\S]*?<\/div>/gi;
    html = replaceFirstOutsideComment(
      html,
      statCard,
      (card) => /<(?:small|span)[^>]*>[\s\S]*?(?:現在株価|現在の株価|現値|株価)[\s\S]*?<\/(?:small|span)>/i.test(card),
      markCompactStatCard,
    );
  }

  if (!/data-live-price(?:\s|>)/i.test(html)) {
    const mainStart = html.search(/<main\b/i);
    const hero = mainStart >= 0 ? html.slice(0, mainStart) : html;
    if (/<div class="price"[^>]*>[\s\S]*?<\/div>/i.test(hero)) {
      const updatedHero = hero.replace(/<div class="price"([^>]*)>([\s\S]*?)<\/div>/i, (match) => {
        const price = match.replace(/<div class="price"([^>]*)>/i, (tag) => addAttribute(tag, "data-live-price"));
        return `${price}<div class="sub" data-live-price-date>現在株価 ${liveBadge}｜分析基準値</div>`;
      });
      html = `${updatedHero}${html.slice(hero.length)}`;
    }
  }
  return html;
}

function addLiveScript(html) {
  if (html.includes("../../lab/assets/js/live-report-price.js")) return html;
  return html.replace(/<\/body>/i, `${scriptTag}\n</body>`);
}

const changed = [];
for (const entry of manifest) {
  const folder = entry.detailPath.split("/")[1];
  for (const fileName of ["index.html", "scenario.html"]) {
    const filePath = join(root, "stocks", folder, fileName);
    const before = await readFile(filePath, "utf8");
    let after = addBodySettings(before, entry.ticker);
    after = fileName === "index.html" ? markIndexPrice(after) : markScenarioPrice(after);
    after = addLiveScript(after);

    const required = [
      `data-stock-ticker="${entry.ticker}"`,
      'data-price-source="../../data/prices.json"',
      "data-live-price",
      "data-live-price-date",
      "../../lab/assets/js/live-report-price.js",
    ];
    const missing = required.filter((marker) => !after.includes(marker));
    if (missing.length) {
      throw new Error(`${entry.detailPath.replace("index.html", fileName)}: 設定できませんでした: ${missing.join(", ")}`);
    }
    if (after !== before) {
      await writeFile(filePath, after, "utf8");
      changed.push(`stocks/${folder}/${fileName}`);
    }
  }
}

console.log(`${changed.length}ページをSiM v5ライブ株価設定へ更新しました。`);
for (const path of changed) console.log(path);
