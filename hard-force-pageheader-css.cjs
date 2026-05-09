const fs = require("fs");

const file = "ai-hq-frontend/src/index.css";
let src = fs.readFileSync(file, "utf8");

const marker = "/* HARD FORCE TEAM PAGE HEADER CONTRACT */";

const css = `
${marker}
.app-page-header-title {
  font-size: 35.84px !important;
  font-weight: 620 !important;
  line-height: 1.02 !important;
  letter-spacing: -0.055em !important;
  margin: 0 !important;
}

.app-page-header-description {
  margin-top: 10px !important;
  max-width: 760px !important;
  font-size: 14.5px !important;
  font-weight: 520 !important;
  line-height: 24px !important;
  letter-spacing: -0.012em !important;
  margin-bottom: 0 !important;
}

.app-page-header-actions .ui-button__inner {
  height: 54px !important;
  padding-left: 24px !important;
  padding-right: 24px !important;
  font-size: 15px !important;
}

.app-page-header-actions .ui-button {
  border-radius: var(--ui-radius-control-outer) !important;
}
`;

if (!src.includes(marker)) {
  src += css;
}

fs.writeFileSync(file, src, "utf8");
console.log("PageHeader CSS override yazıldı.");
