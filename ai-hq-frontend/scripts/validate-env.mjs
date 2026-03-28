import { formatValidationFailure } from "../../scripts/env-validation-utils.mjs";
import { printFrontendEnvReport } from "../src/env/validation.js";

const report = printFrontendEnvReport(console);

if (!report.ok) {
  console.error(formatValidationFailure("ai-hq-frontend", report));
  process.exit(1);
}
