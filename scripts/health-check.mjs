import { readFile } from "node:fs/promises";

const base = (process.env.SIM_SITE_URL || "https://nksin06331-creator.github.io/sim").replace(/\/$/, "");
const manifest = JSON.parse(await readFile("data/manifest.json", "utf8"));
const failures = [];
for (const stock of manifest) {
  for (const path of [stock.detailPath, stock.scenarioPath]) {
    const response = await fetch(`${base}/${path}`, { redirect: "follow" });
    if (response.status !== 200) failures.push(`${path}: HTTP ${response.status}`);
  }
  if (stock.sourceRevision) {
    const metaResponse = await fetch(`${base}/stocks/${stock.detailPath.split("/")[1]}/meta.json`);
    if (metaResponse.status !== 200) failures.push(`${stock.ticker}: meta HTTP ${metaResponse.status}`);
    else if ((await metaResponse.json()).sourceRevision !== stock.sourceRevision) failures.push(`${stock.ticker}: revision mismatch`);
  }
}
if (failures.length) {
  console.error(`POST_PUBLISH_HEALTH_FAIL\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`POST_PUBLISH_HEALTH_PASS ${manifest.length} stocks`);
