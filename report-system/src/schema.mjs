import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { repoRoot } from "./common.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const schemaFiles = {
  report: "report.schema.json",
  patch: "report-patch.schema.json",
  catalyst: "catalyst-report.schema.json",
};

const validators = Object.fromEntries(await Promise.all(
  Object.entries(schemaFiles).map(async ([kind, file]) => {
    const path = join(repoRoot, "report-system", "schemas", file);
    const schema = JSON.parse(await readFile(path, "utf8"));
    return [kind, ajv.compile(schema)];
  }),
));

function errorMessage(error) {
  const location = error.instancePath || "/";
  const suffix = error.params?.missingProperty ? ` (${error.params.missingProperty})` : "";
  return `${location}: ${error.message ?? "schema violation"}${suffix}`;
}

export function validateSchema(kind, value) {
  const validator = validators[kind];
  if (!validator) throw new Error(`未知のSchema種別です: ${kind}`);
  const valid = validator(value);
  return {
    valid: Boolean(valid),
    errors: valid ? [] : (validator.errors ?? []).map(errorMessage),
  };
}
