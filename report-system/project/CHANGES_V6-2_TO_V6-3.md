# SiM MARKET LAB — v6.2 → v6.3 変更点まとめ

ChatGPTプロジェクトへの再添付用。各ファイルの before/after を網羅。

---

## 1. `04-SIM_REPORT_PROJECT_MASTER_V6-3.md`（旧: V6-2.md）

### バリデーション・公開判定ロジック

| 項目 | v6.2（旧） | v6.3（新） |
|------|-----------|-----------|
| 警告カテゴリ | WARN（単一） | FAIL / BLOCKING_WARN / INFO_WARN（3段階） |
| 公開条件 | `WARN=0` | `FAIL=0 AND BLOCKING_WARN=0`（INFO_WARNは公開可） |
| 推定日付 | WARN（公開ブロック） | INFO_WARN（公開可・注意帯表示） |
| アナリストカバレッジなし | WARN | INFO_WARN |
| 情報源が少ない | WARN | INFO_WARN |
| 急激な株価変動 | WARN | INFO_WARN |
| 独立AI検証ステップ | 必須（3段階: AI生成→独立検証→機械チェック） | 2段階のみ（AI生成チェック + GitHub機械チェック） |

### 定量化優先順位（新規追加）

v6.3では「定量不能」を宣言する前に8つの優先度を順に試すことを義務化：

1. 一次情報源（確定値）
2. 会社ガイダンス（COMPANY_GUIDANCE）
3. アナリストコンセンサス（CONSENSUS）
4. **同一企業の過去類似事例（HISTORICAL_RANGE）← 新規追加**
5. ピア比較（同業他社事例）
6. モデル推定（MODEL_ESTIMATE）
7. 広いレンジ＋信頼度明示
8. 定量不能（UNKNOWN）← 最終手段のみ

定量不能を使う場合は必須：①理由、②代替定性評価、③定量化を可能にする条件、④再評価トリガー

### HTML構成

| 項目 | v6.2（旧） | v6.3（新） |
|------|-----------|-----------|
| 出力ファイル数 | 3ファイル（index.html, TICKER.html, catalysts.html） | **1ファイル（stocks/TICKER/index.html）** |
| ナビゲーション | `<a href="TICKER.html">結論</a>` 等 | `<button data-view-btn="guide">` 等（URLなし） |
| ページ内リンク | `<a href="#section">` | `<button data-scroll-target="sec1">` + scrollIntoView |
| 「銘柄一覧へ」リンク | `<a href="../../index.html">← 銘柄一覧へ</a>` | **削除** |
| ブラウザ履歴 | タブ切替ごとに積み重なる | 変化なし（pushState禁止） |
| 旧URL互換 | - | redirect_TICKER.html / redirect_catalysts.html（location.replace） |

### 更新モード

| v6.2（旧） | v6.3（新） |
|-----------|-----------|
| initial / full-refresh / patch / correction / corporate-action / **price-only** | initial / full-refresh / patch / correction / corporate-action（**price-only削除**） |

price-onlyを廃止した理由：現在株価は prices.json で独立管理するため、report.json自体は更新不要。

### カタリスト・レポート公開の分離

v6.2ではカタリストのBLOCKING_WARNが企業ガイド＋シナリオの公開も止めていた。
v6.3では完全分離：
- 企業ガイド＋シナリオの公開条件 = 自身のFAIL=0 AND BLOCKING_WARN=0
- カタリストのBLOCKING_WARN → カタリストタブのみ「準備中」表示。他タブは公開継続
- NO_CONFIRMED_CATALYST = 正常状態（警告ではない）

### coverageWaivers

| 項目 | v6.2（旧） | v6.3（新） |
|------|-----------|-----------|
| 免除の種類 | 区別なし（全てブロッキング扱い） | waiver_type: "acceptable"（INFO_WARN・公開可） / "blocking"（公開禁止） |

### 情報削除ルール

v6.2では情報量が減る更新がFAILになる場合があった。
v6.3では、削除理由をupdateHistoryに記録すればFAILにならない。

### パッチ競合管理

| 項目 | v6.2（旧） | v6.3（新） |
|------|-----------|-----------|
| 競合チェックキー | baseContentSha256 | **baseRevision**（既存フィールドを正式化） |
| 補助情報 | なし | gitCommitSha（オプション） |

---

## 2. `report.schema.json`（v1.0 → v1.1）

| フィールド | v1.0（旧） | v1.1（新） |
|-----------|-----------|-----------|
| `status` enum | `["draft","review","published","archived"]` | `["draft","published","archived"]`（review削除） |
| `update.mode` enum | `[…,"price-only"]` | price-only削除 |
| `validation.status` | `["PASS","WARN","FAIL"]` | `["PASS","INFO_WARN","BLOCKING_WARN","FAIL"]` |
| `validation.warn_count` | あり | `blocking_warn_count` + `info_warn_count` に分割 |
| `validation.infoWarnMessages` | なし | 追加（INFO_WARNメッセージ一覧） |
| `coverageWaivers[].waiver_type` | なし | 追加: `["acceptable","blocking"]` |
| `assumption.classification` | `["confirmed","company-guidance","consensus","model-estimate","unknown"]` | `"historical-range"` 追加 |
| `updateHistory` | なし（トップレベル） | 追加（情報削除記録のため） |
| `catalyst.direction` | なし | 追加 |
| patch/correction/corporate-actionでのbaseRevision | 任意 | **必須**（conditionalで強制） |

---

## 3. `report-patch.schema.json`（v1.0 → v1.1）

| フィールド | v1.0（旧） | v1.1（新） |
|-----------|-----------|-----------|
| `required` | baseRevisionなし（任意だった） | **baseRevision必須化** |
| `gitCommitSha` | なし | 追加（string\|null、オプション） |
| `patchMode` | なし | 追加: `["patch","correction","corporate-action"]` |
| `deletedInfo` | なし | 追加（情報削除時の理由記録） |
| `appliedAt` / `appliedRevision` | なし | 追加（GitHub側が記入、AI生成時は不要） |
| `baseContentSha256` | （そもそも存在しなかった） | 存在しない（確認済み） |

---

## 4. `catalyst-report.schema.json`（v1.0 → v1.1）

| 項目 | v1.0（旧） | v1.1（新） |
|------|-----------|-----------|
| `framework_version` | `"1.0"` | `"1.1"` |
| `event_type` | なし | 追加: `QUANTITATIVE / SEMI_QUANTITATIVE / QUALITATIVE` |
| `evidenceClass` | CONFIRMED/COMPANY_GUIDANCE/CONSENSUS/MODEL_ESTIMATE/UNKNOWN | **HISTORICAL_RANGE** 追加 |
| `catalyst.required` | 多数（17フィールド） | 縮小（12フィールド：id,title,event_type,category,status,importance,direction,date,plain_language,why_it_matters,update_triggers,source_ids） |
| `outcomes` | required、minItems:3 | **optional（minItemsなし）** |
| `outcome.label` | enum: SUCCESS/INLINE/FAILURE | **自由文字列（free string）** |
| `outcome.quantification_basis` | なし | 追加（定量根拠） |
| `outcome.unquantifiable_reason` | なし | 追加（定量不能理由） |
| `outcome.qualitative_assessment` | なし | 追加（代替定性評価） |
| `outcome.revaluation_trigger` | なし | 追加（再評価トリガー） |
| `pricedIn.required` | 多数（label,percent_range,model,confidence等） | `[quantifiable,label,confidence]`のみ |
| `pricedIn.percent_range` | required | optional |
| `pricedIn.model` | required | optional |
| `pricedIn` stage labels | 数値のみ | LOW/LOW_TO_MEDIUM/MEDIUM/MEDIUM_TO_HIGH/HIGH/UNKNOWN |
| `priced_in.unquantifiable_reason` | なし | 追加 |
| `validation_summary.warn_count` | あり | `fail_count` + `blocking_warn_count` + `info_warn_count` に分割 |
| `validation_summary.messages` | 文字列配列 | オブジェクト配列（level付き） |
| `quantification_priority` | なし | 追加（int 1-8） |
| カテゴリenum | 既存のみ | **EVENT** 追加 |

---

## 5. HTMLテンプレート（3ファイル → 1ファイル）

### 廃止・置換ファイル

| 旧ファイル | v6.3の扱い |
|-----------|-----------|
| `template_stock_guide_v4_1_unified.html` | 廃止（v5に統合） |
| `template_scenario_v4_1_unified.html` | 廃止（v5に統合） |
| `template_catalyst_v1_1_unified.html` | 廃止（v5に統合） |

### 新規ファイル

| ファイル名 | 用途 |
|-----------|------|
| `template_report_unified_v5.html` | 1銘柄1ファイル統合テンプレート。企業ガイド・結論・カタリスト全て含む |
| `redirect_TICKER.html` | TICKER.html → index.html リダイレクト専用（サイト内リンク禁止） |
| `redirect_catalysts.html` | catalysts.html → index.html リダイレクト専用（サイト内リンク禁止） |

### リンク方式の変更

| 種別 | v6.2（旧） | v6.3（新） |
|------|-----------|-----------|
| タブ切替 | `<a href="TICKER.html">` 等 | `<button data-view-btn="scenario">` + JS |
| ページ内リンク | `<a href="#section">` | `<button data-scroll-target="sec1">` + scrollIntoView |
| 銘柄一覧 | `<a href="../../index.html">← 銘柄一覧へ</a>` | **削除** |
| 外部URL | `<a href="https://...">` | そのまま（変更なし） |

---

## 6. `template-bindings.json`（v4 → v5）

| 項目 | v4（旧） | v5（新） |
|------|---------|---------|
| 対象テンプレート | 3ファイル別々 | `template_report_unified_v5.html`（1ファイル） |
| outputPath | `stocks/{{TICKER}}/index.html` 等3ファイル | `stocks/{{TICKER}}/index.html`のみ |
| redirectFiles | なし | `{{TICKER}}.html` / `catalysts.html`（リダイレクト専用） |
| catalyst_optional | なし | **true**（カタリスト未完成でも公開可） |
| catalystHandling | なし | when_missing / when_blocking_warn / when_info_warn / when_no_confirmed_catalyst |
| requireNoListToIndexLink | なし | **true**（銘柄一覧リンク禁止チェック） |
| computed.infoWarnBand | なし | INFO_WARN注意帯のHTML自動生成 |
| computed.noCatalystNotice | なし | NO_CONFIRMED_CATALYST通知のHTML自動生成 |

---

## 7. GitHubスクリプトへの修正要件

v6.3の仕様変更に合わせてGitHub CI/CDスクリプトを変更する必要がある項目：

1. **バリデーション出力**：`warn_count` → `fail_count` / `blocking_warn_count` / `info_warn_count` に分割
2. **公開条件チェック**：`WARN=0` → `FAIL=0 AND BLOCKING_WARN=0`（INFO_WARNは公開可）
3. **HTML生成**：3ファイル → 1ファイル生成（stocks/TICKER/index.html）
4. **リダイレクトファイル生成**：TICKER.html / catalysts.html をlocation.replace型で生成
5. **銘柄一覧リンクチェック削除**：`href="../../index.html"` の存在チェックを削除
6. **カタリスト・レポートの独立公開**：カタリストのBLOCKING_WARNがあってもレポート本体は公開継続
7. **patchのbaseRevision検証**：patchMode使用時にbaseRevisionが正本のrevisionと一致するか確認
8. **情報削除の許可**：deletedInfoがあればFAILにしない

---

## 8. 維持した安全ルール（v6.2から変更なし）

以下のルールはv6.3でも変更なし：

- プレースホルダー未置換のままの公開禁止（FAIL）
- 危険なHTML（javascript: URL等）の禁止（FAIL）
- Bear確率 + Base確率 + Bull確率 = 100% の検証
- Bear < Base < Bull の単調性検証
- 通貨の一貫性チェック
- 出典IDの参照整合性チェック
- XSS防止（HTMLエスケープ）の徹底
- 免責事項の必須記載

---

*v6.3 変更点まとめ / SiM MARKET LAB / 作成: 2026-08-01*
