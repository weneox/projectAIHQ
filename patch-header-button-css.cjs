const fs = require("fs");

const file = "ai-hq-frontend/src/index.css";
let src = fs.readFileSync(file, "utf8");

const marker = "/* === page-header-button-size:start === */";

const css = `
${marker}
.ui-button--header .ui-button__inner {
  min-height: 38px;
  height: 38px;
  padding-inline: 16px;
  font-size: 13px;
  font-weight: 650;
  gap: 8px;
}

.ui-button--header .ui-button__icon svg {
  width: 15px;
  height: 15px;
}
/* === page-header-button-size:end === */
`;

if (src.includes(marker)) {
  console.log("index.css: page header button size artıq var.");
  process.exit(0);
}

src = `${src.trimEnd()}\n\n${css}\n`;

fs.writeFileSync(file, src, "utf8");
console.log("index.css: ui-button--header ölçüsü əlavə edildi.");
