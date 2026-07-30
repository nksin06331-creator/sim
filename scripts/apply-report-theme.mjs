import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stocksRoot = join(root, "stocks");
const stylesheetPath = "../../lab/assets/css/report-v5.css";
const stylesheetTag = `<link rel="stylesheet" href="${stylesheetPath}">`;

function addBodyClasses(html, pageKind) {
  return html.replace(/<body\b([^>]*)>/i, (tag, attributes) => {
    const required = ["sim-report", pageKind];
    const classMatch = attributes.match(/\bclass=(["'])(.*?)\1/i);

    if (classMatch) {
      const classes = classMatch[2].split(/\s+/).filter(Boolean);
      for (const name of required) {
        if (!classes.includes(name)) classes.push(name);
      }
      const replacement = `class=${classMatch[1]}${classes.join(" ")}${classMatch[1]}`;
      return tag.replace(classMatch[0], replacement);
    }

    return tag.replace(/>$/, ` class="${required.join(" ")}">`);
  });
}

function applyTheme(html, pageKind) {
  let themed = addBodyClasses(html, pageKind);
  if (!themed.includes(stylesheetPath)) {
    themed = themed.replace(/<\/head>/i, `${stylesheetTag}\n</head>`);
  }
  return themed;
}

const folders = (await readdir(stocksRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const changed = [];
for (const folder of folders) {
  for (const [fileName, pageKind] of [
    ["index.html", "sim-guide"],
    ["scenario.html", "sim-scenario"],
  ]) {
    const filePath = join(stocksRoot, folder, fileName);
    let before;
    try {
      before = await readFile(filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }

    const after = applyTheme(before, pageKind);
    const expectedClass = `class="sim-report ${pageKind}"`;
    if (!after.includes(stylesheetPath) || !after.includes(expectedClass)) {
      throw new Error(`テーマ設定を確認できません: stocks/${folder}/${fileName}`);
    }

    if (after !== before) {
      await writeFile(filePath, after, "utf8");
      changed.push(`stocks/${folder}/${fileName}`);
    }
  }
}

console.log(`${changed.length}ページにSiM Report UI v5を適用しました。`);
