import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "../src/common.mjs";
import { catalystPathForPortalStock, renderCatalyst, validateCatalystReport } from "../src/catalyst.mjs";

const template = await readFile(join(repoRoot, "report-system/templates/catalyst-shell.html"), "utf8");
const portal = await readFile(join(repoRoot, "lab/assets/js/portal.js"), "utf8");

function outcome(label, priceChange, price, direction) {
  return {
    label,
    conditions: [`${label}の条件を確認`],
    quantifiable: true,
    price_change_pct_range: priceChange,
    price_range: price,
    direction,
    effect_on_assumptions: ["売上と倍率の前提を更新"],
    probability: null,
  };
}

function pricedIn() {
  return {
    quantifiable: true,
    percent_range: [30, 50],
    raw_implied_pct: 40,
    label: "半分前後",
    confidence: "MEDIUM",
    model: "イベント除外価値と完全成功価値の差から逆算",
    event_excluded_equity_value: 800,
    full_success_incremental_equity_value: 500,
    market_implied_success_probability: null,
    independent_success_probability: null,
    evidence_for: ["直近の相対騰落率はプラス"],
    evidence_against: ["同業比較の分散が大きい"],
    caveats: ["モデル前提に依存"],
  };
}

function fixture() {
  return {
    meta: {
      company_name: "Demo Corporation",
      ticker: "DEMO",
      exchange: "NASDAQ",
      currency: "USD",
      valuation_date: "2026-07-31",
      last_updated: "2026-07-31",
      source_cutoff: "2026-07-31T12:00:00Z",
      framework_version: "1.0",
      current_price_fallback: 100,
      current_price_as_of: "2026-07-31 12:00 UTC",
      benchmark: "NASDAQ Composite",
      diluted_shares: 10,
    },
    summary: {
      status: "SELECTIVE",
      one_line: "次の決算で受注と利益率を確認します。",
      next_catalyst_id: "c1",
      next_window: "2026年8月15日",
      overall_priced_in: pricedIn(),
      primary_risk: "期待先行と追加資金調達",
      surprise_up: "受注と粗利率が市場予想を上回ること",
      surprise_down: "日程遅延またはガイダンス引き下げ",
    },
    catalysts: [{
      id: "c1",
      title: "2026年Q2決算",
      category: "EARNINGS",
      status: "SCHEDULED",
      importance: 4,
      direction: "TWO_SIDED",
      date: {
        display_text: "2026年8月15日",
        start_date: "2026-08-15",
        end_date: "2026-08-15",
        precision: "EXACT",
        basis: "CONFIRMED",
        confidence: "HIGH",
        timezone: "America/New_York",
        source_ids: ["s1"],
      },
      plain_language: "売上成長と利益率の進み具合を確認します。",
      detail: "受注の売上転換と粗利率が企業価値へ伝わります。",
      mechanism: ["受注", "売上", "粗利", "企業価値"],
      outcomes: [
        outcome("SUCCESS", [20, 30], [120, 130], "UP"),
        outcome("INLINE", [-5, 5], [95, 105], "FLAT"),
        outcome("FAILURE", [-30, -20], [70, 80], "DOWN"),
      ],
      impact_method: "企業価値モデルの再計算",
      impact_horizon: "発表後数日から2四半期",
      impact_confidence: "MEDIUM",
      priced_in: pricedIn(),
      leading_indicators: ["受注残", "粗利率"],
      dependencies: [],
      dependency_group: null,
      sell_the_news_risk: "直前の上昇が大きい場合は注意",
      financing_risk: "現金と営業CFを同時に確認",
      update_triggers: ["決算発表", "ガイダンス変更"],
      source_ids: ["s1"],
      extra_items: [{
        label: "この銘柄固有の確認事項",
        value: "主要顧客の検収条件",
        source_ids: ["s1"],
      }],
    }],
    dependency_groups: [],
    watch_items: [{
      item: "受注残",
      why_it_matters: "将来売上の先行指標",
      frequency: "四半期",
      update_trigger: "前四半期比10%以上の変化",
      catalyst_ids: ["c1"],
    }],
    assumptions: [{
      item: "分析基準株価",
      value: 100,
      classification: "CONFIRMED",
      as_of: "2026-07-31",
      source_ids: ["s1"],
      note: "終値",
    }],
    extra_sections: [{
      id: "company-specific",
      title: "この銘柄固有の重要情報",
      summary: "固定欄に入らない情報も削除しません。",
      items: [{ label: "検収条件", value: "顧客の受入試験完了が必要" }],
      source_ids: ["s1"],
    }],
    sources: [{
      id: "s1",
      title: "Investor Relations",
      publisher: "Demo Corporation",
      url: "https://example.com/ir",
      published_at: "2026-07-30",
      accessed_at: "2026-07-31",
      source_type: "IR",
      is_primary: true,
      supports_catalyst_ids: ["c1"],
    }],
    validation_summary: {
      status: "PASS",
      fail_count: 0,
      warn_count: 0,
      messages: [],
    },
    update_history: [{ updated_at: "2026-07-31", change: "初版作成" }],
    disclaimer: "情報提供・教育目的であり、投資助言ではありません。",
  };
}

test("valid catalyst JSON renders the optional third page", () => {
  const report = fixture();
  const validation = validateCatalystReport(report);
  assert.equal(validation.failCount, 0);
  const html = renderCatalyst(report, template, validation);
  assert.match(html, /今後のカタリスト/);
  assert.match(html, /href="DEMO\.html"/);
  assert.match(html, /この銘柄固有の重要情報/);
  assert.match(html, /data-stock-ticker="DEMO"/);
  assert.doesNotMatch(html, /\{\{[A-Z0-9_]+\}\}/);
});

test("catalyst validator blocks inconsistent price arithmetic", () => {
  const report = fixture();
  report.catalysts[0].outcomes[0].price_range = [200, 300];
  const validation = validateCatalystReport(report);
  assert.equal(validation.status, "FAIL");
  assert(validation.checks.some((item) => item.id === "O04_c1_SUCCESS" && item.status === "FAIL"));
});

test("catalyst validator blocks investment advice language", () => {
  const report = fixture();
  report.summary.one_line = "必ず上がるので買うべきです。";
  const validation = validateCatalystReport(report);
  assert.equal(validation.status, "FAIL");
  assert(validation.checks.some((item) => item.id === "TXT01_NO_ADVICE" && item.status === "FAIL"));
});

test("portal uses the catalyst HTML path supplied by stock metadata", () => {
  assert.match(portal, /stock\.catalystPath/);
  assert.doesNotMatch(portal, /loadCatalystPaths/);
  assert.doesNotMatch(portal, /catalystManifestUrl/);
  assert.match(portal, /今後のカタリストをみる/);
});

test("Japan stock catalyst keeps the existing company-name folder", () => {
  const path = catalystPathForPortalStock({ detailPath: "stocks/JX金属/index.html" }, "5016");
  assert.equal(path, "stocks/JX金属/catalysts.html");
});
