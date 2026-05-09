const fs = require("fs");

const file = "ai-hq-frontend/src/index.css";
let src = fs.readFileSync(file, "utf8");

const marker = "/* Team-sized page header action buttons */";

const css = `
${marker}
.app-page-header .ui-button--md .ui-button__inner,
.app-page-header .ui-button--sm .ui-button__inner {
  height: 54px;
  padding-left: 24px;
  padding-right: 24px;
  font-size: 15px;
}

.app-page-header .ui-button--secondary,
.app-page-header .ui-button--outline {
  box-shadow: 0 12px 28px -26px rgba(15, 23, 42, 0.18);
}
`;

if (!src.includes(marker)) {
  src = src + css;
}

fs.writeFileSync(file, src, "utf8");
console.log("PageHeader action button ölçüləri Team ilə uyğunlaşdırıldı.");
