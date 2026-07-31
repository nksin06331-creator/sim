import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stocksRoot = join(root, "stocks");
const manifestPaths = [
  join(root, "data", "manifest.json"),
  join(root, "lab", "data", "manifest.json"),
];
const seedManifestPaths = [
  join(root, "data", "manifest-20260729-60.json"),
  join(root, "data", "manifest.json"),
];
const output = join(root, "_site");
const requiredStrings = ["ticker", "slug", "name", "market", "sector", "method", "status", "updated", "summary", "zone", "detailPath", "scenarioPath"];

function validate(meta, folder) {
  const errors = [];
  for (const key of requiredStrings) {
    if (typeof meta[key] !== "string" || !meta[key].trim()) errors.push(`${key}が未入力`);
  }
  if (meta.schemaVersion !== 1) errors.push("schemaVersionは1にしてください");
  if (!/^[A-Z0-9.-]+$/.test(meta.ticker ?? "")) errors.push("tickerは半角大文字で入力してください");
  if (!/^[a-z0-9-]+$/.test(meta.slug ?? "")) errors.push("slugは半角小文字で入力してください");
  if (!meta.price || !Number.isFinite(meta.price.current) || typeof meta.price.currency !== "string") errors.push("priceが不正です");
  for (const type of ["bear", "base", "bull"]) {
    if (!Number.isFinite(meta.scenarios?.[type])) errors.push(`scenarios.${type}は数値にしてください`);
  }
  return errors;
}

const folders = (await readdir(stocksRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const entriesByTicker = new Map();
for (const seedManifestPath of seedManifestPaths) {
  const seeded = JSON.parse(await readFile(seedManifestPath, "utf8"));
  if (!Array.isArray(seeded)) throw new Error(`${seedManifestPath}は配列にしてください`);
  for (const meta of seeded) {
    if (meta?.status === "published" && typeof meta.ticker === "string") entriesByTicker.set(meta.ticker, meta);
  }
}

const seen = new Set();
for (const folder of folders) {
  const metaFile = join(stocksRoot, folder, "meta.json");
  try { await access(metaFile); } catch { continue; }
  const meta = JSON.parse(await readFile(metaFile, "utf8"));
  const errors = validate(meta, folder);
  if (seen.has(meta.ticker)) errors.push(`ticker ${meta.ticker}が重複しています`);
  for (const path of [meta.detailPath, meta.scenarioPath, meta.catalystPath].filter(Boolean)) {
    try { await access(join(root, path)); } catch { errors.push(`${path}が存在しません`); }
  }
  if (errors.length) throw new Error(`${folder}/meta.json:\n- ${errors.join("\n- ")}`);
  seen.add(meta.ticker);
  if (meta.status === "published") entriesByTicker.set(meta.ticker, meta);
  else entriesByTicker.delete(meta.ticker);
}

const entries = [...entriesByTicker.values()];
for (const meta of entries) {
  const errors = validate(meta, meta.ticker);
  for (const path of [meta.detailPath, meta.scenarioPath, meta.catalystPath].filter(Boolean)) {
    try { await access(join(root, path)); } catch { errors.push(`${path}が存在しません`); }
  }
  if (errors.length) throw new Error(`${meta.ticker}:
- ${errors.join("\n- ")}`);
}
entries.sort((a, b) => b.updated.localeCompare(a.updated) || a.ticker.localeCompare(b.ticker));
for (const manifestPath of manifestPaths) {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ["index.html", "data", "stocks", "lab"]) {
  await cp(join(root, name), join(output, name), { recursive: true });
}
await writeFile(join(output, ".nojekyll"), "", "utf8");
console.log(`${entries.length}銘柄を検証し、GitHub Pages用サイトを生成しました。`);
