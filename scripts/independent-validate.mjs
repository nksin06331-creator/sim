import { readFile, writeFile } from "node:fs/promises";

export const ATTESTATION_MARKER = "SIM_INDEPENDENT_VALIDATION_V1";
export const REQUIRED_CHECK_IDS = [
  "IDENTITY",
  "PRIMARY_SOURCES",
  "LATEST_DISCLOSURES",
  "VALUATION_LOGIC",
  "DILUTION_RUNWAY",
  "INFORMATION_REGRESSION",
  "CATALYSTS_RISKS",
  "PROMPT_INJECTION",
];

export function parseAttestation(body) {
  const escaped = ATTESTATION_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(body ?? "").match(new RegExp(`<!--\\s*${escaped}\\s*([\\s\\S]*?)-->`));
  if (!match) throw new Error("independent validation attestation marker is missing");
  return JSON.parse(match[1].trim());
}

export function validateReviewAttestation({ report, event }) {
  const review = event?.review;
  const pullRequest = event?.pull_request;
  const candidateSha = pullRequest?.head?.sha;
  if (!review || !pullRequest) throw new Error("pull_request_review event is required");
  if (!['commented', 'approved'].includes(String(review.state ?? "").toLowerCase())) throw new Error("review must be submitted as COMMENT or APPROVE");
  if (!['OWNER', 'MEMBER', 'COLLABORATOR'].includes(review.author_association)) throw new Error("review author is not an authorized repository collaborator");
  if (!/^[0-9a-f]{40}$/i.test(candidateSha ?? "")) throw new Error("candidate commit SHA is invalid");
  if (review.commit_id !== candidateSha) throw new Error("review is not anchored to the current candidate commit");

  const attestation = parseAttestation(review.body);
  if (attestation.schemaVersion !== 1) throw new Error("attestation schemaVersion must be 1");
  if (attestation.verifier !== "chatgpt-independent") throw new Error("attestation verifier is invalid");
  if (attestation.status !== "PASS" || attestation.fail_count !== 0 || attestation.warn_count !== 0) throw new Error("independent validation must PASS with zero failures and warnings");
  if (attestation.revision !== report.revision) throw new Error("attestation revision does not match report revision");
  if (attestation.commit_sha !== candidateSha) throw new Error("attestation commit SHA does not match candidate commit");
  if (typeof attestation.summary !== "string" || !attestation.summary.trim()) throw new Error("attestation summary is required");

  const checks = new Map((attestation.checks ?? []).map((item) => [item?.id, item?.status]));
  const missing = REQUIRED_CHECK_IDS.filter((id) => checks.get(id) !== "PASS");
  if (missing.length) throw new Error(`required independent checks are not PASS: ${missing.join(", ")}`);

  return {
    schemaVersion: 1,
    source: "github_pr_review",
    verifier: attestation.verifier,
    status: "PASS",
    fail_count: 0,
    warn_count: 0,
    revision: report.revision,
    commit_sha: candidateSha,
    summary: attestation.summary.trim(),
    checks: attestation.checks,
    findings: Array.isArray(attestation.findings) ? attestation.findings : [],
    review_id: review.id,
    review_user: review.user?.login ?? null,
    reviewed_at: review.submitted_at ?? null,
  };
}

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) throw new Error("usage: independent-validate REPORT_JSON OUTPUT_JSON");
  const report = JSON.parse(await readFile(inputPath, "utf8"));
  let result;
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) throw new Error("GITHUB_EVENT_PATH is unavailable");
    const event = JSON.parse(await readFile(eventPath, "utf8"));
    result = validateReviewAttestation({ report, event });
  } catch (error) {
    result = {
      schemaVersion: 1,
      source: "github_pr_review",
      status: "AUTO_HOLD",
      fail_count: 1,
      warn_count: 0,
      revision: report.revision,
      commit_sha: process.env.CANDIDATE_COMMIT_SHA ?? null,
      summary: error instanceof Error ? error.message : String(error),
    };
    process.exitCode = 2;
  }
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) await main();
