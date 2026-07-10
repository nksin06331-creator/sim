import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stocksDirectory = join(root, "data", "stocks");
const manifestPath = join(root, "data", "manifest.json");

const requiredStrings = ["ticker", "slug", "name", "market", "sector", "updated", "summary", "status"];

function validate(stock, filename) {
  const errors = [];
  for (const key of requiredStrings) {
    if (typeof stock[key] !== "string" || !stock[key].trim()) errors.push(`${key}が未入力`);
  }
  if (stock.schemaVersion !== 1) errors.push("schemaVersionは1にしてください");
  if (!/^[A-Z0-9.-]+$/.test(stock.ticker ?? "")) errors.push("tickerは半角大文字で入力してください");
  if (!/^[a-z0-9-]+$/.test(stock.slug ?? "")) errors.push("slugは半角小文字で入力してください");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stock.updated ?? "")) errors.push("updatedはYYYY-MM-DD形式にしてください");
  if (!stock.price || !Number.isFinite(stock.price.current) || typeof stock.price.currency !== "string") errors.push("priceが不正です");
  for (const type of ["bear", "base", "bull"]) {
    if (!Number.isFinite(stock.scenarios?.[type])) errors.push(`scenarios.${type}は数値にしてください`);
  }
  if (!Array.isArray(stock.sections)) errors.push("sectionsは配列にしてください");
  if (stock.slug && `${stock.slug}.json` !== filename) errors.push(`ファイル名は${stock.slug}.jsonにしてください`);
  return errors;
}

const files = (await readdir(stocksDirectory)).filter((name) => name.endsWith(".json")).sort();
const stocks = [];
const seenTickers = new Set();
const seenSlugs = new Set();

for (const filename of files) {
  const stock = JSON.parse(await readFile(join(stocksDirectory, filename), "utf8"));
  const errors = validate(stock, filename);
  if (seenTickers.has(stock.ticker)) errors.push(`ticker ${stock.ticker}が重複しています`);
  if (seenSlugs.has(stock.slug)) errors.push(`slug ${stock.slug}が重複しています`);
  if (errors.length) throw new Error(`${filename}:\n- ${errors.join("\n- ")}`);
  seenTickers.add(stock.ticker);
  seenSlugs.add(stock.slug);
  stocks.push(stock);
}

const manifest = stocks
  .filter((stock) => stock.status === "published")
  .map(({ ticker, slug, name, market, sector, updated, isDemo = false, price, scenarios, summary }) => ({
    ticker, slug, name, market, sector, updated, isDemo, price, scenarios, summary,
  }))
  .sort((a, b) => b.updated.localeCompare(a.updated) || a.ticker.localeCompare(b.ticker));

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`${files.length}ファイルを検証し、${manifest.length}銘柄をmanifest.jsonへ出力しました。`);
