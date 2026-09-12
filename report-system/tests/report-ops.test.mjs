import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { deepMerge, repoRoot } from "../src/common.mjs";
import { renderGuide, renderScenario } from "../src/render.mjs";
import { validateReport } from "../src/validate.mjs";

const config = JSON.parse(await readFile(join(repoRoot, "report-system/config.json"), "utf8"));
const guideCss = await readFile(join(repoRoot, "report-system/assets/guide-v4.css"), "utf8");
const scenarioCss = await readFile(join(repoRoot, "report-system/assets/scenario-v4.css"), "utf8");

function section(topic, index, blocks = null) {
  return {
    id: `sec${index + 1}`,
    topic,
    icon: "●",
    title: `${topic}の確認`,
    subtitle: "安全運用テスト",
    summaryItems: ["重要点1", "重要点2", "重要点3"],
    blocks: blocks ?? [{
      type: "paragraphs",
      title: "概要",
      paragraphs: [
        "事実、推定、仮定を区別して掲載します。",
        "固定枠に入らない重要情報は追加セクションへ掲載します。"
      ]
    }]
  };
}

function source(index) {
  return {
    id: `source-${index}`,
    title: `一次情報 ${index}`,
    publisher: index <= 3 ? "Company IR" : "Market Data",
    url: `https://example.com/source-${index}`,
    sourceType: index <= 3 ? "company-ir" : "market-data",
    primary: index <= 3,
    publishedAt: "2026-07-30",
    accessedAt: "2026-07-31"
  };
}

function reportFixture() {
  const glossary = Array.from({ length: 8 }, (_, index) => ({
    term: `用語${index + 1}`,
    english: `Term ${index + 1}`,
    definition: "意味を説明します。",
    whyImportant: "事業価値へ影響します。",
    companyContext: "この銘柄での関係を説明します。"
  }));
  const topics = ["company", "industry", "products", "operations", "competition", "glossary", "catalysts"];
  const sections = topics.map((topic, index) => topic === "glossary"
    ? section(topic, index, [{ type: "terms", title: "専門用語", items: glossary }])
    : section(topic, index));
  const refs = ["source-1"];
  return {
    schemaVersion: 1,
    reportId: "DEMO",
    revision: "demo-1",
    status: "draft",
    renderMode: "structured",
    templateVersion: "sim-report-v1",
    update: {
      mode: "initial",
      baseRevision: null,
      reason: "構造化レポートの自動テスト",
      changedFields: ["*"]
    },
    meta: {
      companyName: "Demo Corporation",
      ticker: "DEMO",
      aliases: [],
      market: "US",
      exchange: "NASDAQ",
      currency: "USD",
      valuationDate: "2026-07-30",
      lastUpdated: "2026-07-31",
      sector: "テスト",
      industry: "テスト",
      fiscalYearLabel: "FY2026",
      marketDetails: {
        reportingStandard: "US-GAAP",
        secCik: null,
        adr: false
      }
    },
    overview: {
      tagline: "安全な構造化レポートの表示テストです。",
      heroTags: ["構造化", "安全装置", "自由追加"],
      heroStats: [
        { value: "$18", label: "現在株価", note: "分析基準値", tone: "normal", livePrice: true },
        { value: "$100M", label: "売上", note: "実績", tone: "up", livePrice: false },
        { value: "20%", label: "成長率", note: "実績", tone: "up", livePrice: false }
      ],
      businessSummary: "構造化データからレポートを生成します。"
    },
    guide: {
      sections,
      extraSections: [{
        id: "extra-lawsuit",
        topic: "custom-lawsuit",
        icon: "!",
        title: "訴訟リスク",
        subtitle: "固定枠に入らない情報",
        summaryItems: ["重要情報を削除しません。"],
        blocks: [{
          type: "custom",
          title: "追加情報",
          text: "想定外の重要情報も表示できます。",
          items: ["出典と影響を明記します。"]
        }]
      }]
    },
    scenario: {
      decision: {
        status: "Base付近",
        oneLine: "標準ケース付近で、次の決算を確認します。",
        score: 55,
        companyQuality: "事業は安定しています。",
        valuationView: "株価は標準前提を概ね織り込んでいます。"
      },
      valuation: {
        currentPrice: 18,
        currency: "USD",
        expectedValue: 22.5,
        expectedReturnPct: 25,
        method: "EPS × PER",
        currentPriceNote: "2026-07-30分析基準値"
      },
      scenarios: [
        {
          name: "Bear",
          price: 10,
          probability: 25,
          conditions: ["成長率が低下します。"],
          details: [{ label: "EPS", value: "$0.5" }, { label: "PER", value: "20倍" }]
        },
        {
          name: "Base",
          price: 20,
          probability: 50,
          conditions: ["会社計画を達成します。"],
          details: [{ label: "EPS", value: "$0.8" }, { label: "PER", value: "25倍" }]
        },
        {
          name: "Bull",
          price: 40,
          probability: 25,
          conditions: ["成長率と利益率が上振れます。"],
          details: [{ label: "EPS", value: "$1.0" }, { label: "PER", value: "40倍" }]
        }
      ],
      positioning: {
        bandPositionPct: 26.7,
        interpretation: "Bear〜Base帯です。",
        priceZones: []
      },
      marketReverse: {
        conclusion: "現値はBase利益に慎重な倍率を置いた水準です。"
      },
      entryContext: {
        recent20dChangePct: 5,
        moveTrigger: "決算",
        pricedInNote: "直近決算を受けて上昇しました。",
        catalysts: Array.from({ length: 3 }, (_, index) => ({
          title: `カタリスト${index + 1}`,
          timing: "2026年Q3",
          status: "window",
          importance: 5 - index,
          direction: "TWO_SIDED",
          successImpact: "売上前提が上がります。",
          failureImpact: "成長前提が下がります。",
          sourceRefs: refs
        }))
      },
      risk: {
        riskClass: "HIGH",
        items: Array.from({ length: 4 }, (_, index) => ({
          category: `分類${index + 1}`,
          title: `リスク${index + 1}`,
          description: "前提が崩れる可能性があります。",
          severity: 4,
          sourceRefs: refs
        }))
      },
      positives: ["売上成長", "利益率改善", "現金保有"],
      concerns: ["顧客集中", "倍率", "希薄化"],
      watchItems: [
        { title: "売上", description: "成長率を確認します。", signal: "up" },
        { title: "粗利", description: "利益率を確認します。", signal: "flat" },
        { title: "株数", description: "希薄化を確認します。", signal: "down" }
      ],
      calculation: {
        summary: "仮定のEPSとPERを掛けます。",
        columns: ["ケース", "EPS", "PER", "株価"],
        rows: [["Bear", "$0.5", "20倍", "$10"], ["Base", "$0.8", "25倍", "$20"], ["Bull", "$1.0", "40倍", "$40"]],
        notice: "仮定値であり将来を保証しません。",
        sensitivity: {
          columns: ["EPS＼PER", "20倍", "25倍", "40倍"],
          rows: [["$0.5", "$10", "$12.5", "$20"], ["$0.8", "$16", "$20", "$32"]],
          note: "EPSとPERが主要ドライバです。"
        }
      },
      assumptions: [
        { item: "現在株価", value: "$18", classification: "market-data", note: "分析基準値", sourceRefs: refs },
        { item: "Base EPS", value: "$0.8", classification: "assumption", note: "仮定", sourceRefs: [] }
      ],
      deepDive: [
        { title: "手法選定理由", content: "利益企業のためPERを使用します。", sourceRefs: [] },
        { title: "市場逆算", content: "現値から倍率を逆算します。", sourceRefs: [] },
        { title: "未確認事項", content: "正式日程は未発表です。", sourceRefs: [] }
      ],
      extraSections: [],
      disclaimer: "情報提供・教育目的であり、投資助言ではありません。"
    },
    sources: Array.from({ length: 6 }, (_, index) => source(index + 1)),
    coverageWaivers: [],
    validation: {
      status: "PASS",
      checks: [],
      humanReviewed: false
    }
  };
}

test("structured US report validates and renders both pages", async () => {
  const report = reportFixture();
  const validation = await validateReport(report, config);
  assert.equal(validation.failCount, 0);
  const guide = await renderGuide(report, guideCss);
  const scenario = await renderScenario(report, scenarioCss);
  assert.match(guide, /data-live-price/);
  assert.match(guide, /訴訟リスク/);
  assert.match(scenario, /Bear/);
  assert.match(scenario, /主要出典/);
  assert.doesNotMatch(guide, /\{\{[A-Z0-9_]+\}\}/);
  assert.doesNotMatch(scenario, /\{\{[A-Z0-9_]+\}\}/);
});

test("structured JP report requires and accepts Japan-specific fields", async () => {
  const report = reportFixture();
  report.reportId = "6857";
  report.meta = {
    ...report.meta,
    ticker: "6857",
    market: "JP",
    exchange: "東証プライム",
    currency: "JPY",
    fiscalYearLabel: "FY3/27",
    marketDetails: {
      reportingStandard: "IFRS",
      securitiesCode: "6857",
      listingSegment: "東証プライム",
      fiscalYearEndMonth: 3
    }
  };
  report.scenario.valuation.currency = "JPY";
  const validation = await validateReport(report, config);
  assert.equal(validation.failCount, 0);
  assert.equal(validation.checks.find((check) => check.id === "M02_JP_FIELDS").status, "PASS");
});

test("probability mismatch and unsafe content fail validation", async () => {
  const report = reportFixture();
  report.scenario.scenarios[0].probability = 20;
  report.guide.sections[0].title = "<script>alert(1)</script>";
  const validation = await validateReport(report, config);
  assert.equal(validation.status, "FAIL");
  assert.equal(validation.checks.find((check) => check.id === "V02_PROBABILITY").status, "FAIL");
  assert.equal(validation.checks.find((check) => check.id === "SEC01_INJECTION").status, "FAIL");
});

test("deep merge preserves fields outside a patch", () => {
  const report = reportFixture();
  const merged = deepMerge(report, { meta: { lastUpdated: "2026-08-01" } });
  assert.equal(merged.meta.lastUpdated, "2026-08-01");
  assert.equal(merged.meta.companyName, report.meta.companyName);
  assert.equal(merged.guide.sections.length, report.guide.sections.length);
});
