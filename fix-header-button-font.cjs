const fs = require("fs");

const file = "ai-hq-frontend/src/index.css";
let src = fs.readFileSync(file, "utf8");

const startMarker = "/* === page-header-button-size:start === */";
const endMarker = "/* === page-header-button-size:end === */";

const start = src.indexOf(startMarker);
const end = src.indexOf(endMarker);

if (start === -1 || end === -1) {
  throw new Error("page-header-button-size bloku tapılmadı.");
}

const replacement = `${startMarker}
.ui-button--header .ui-button__inner {
  min-height: 38px;
  height: 38px;
  padding-inline: 16px;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: var(--tracking-tight-sm);
  gap: 8px;
}

.ui-button--header .ui-button__icon svg {
  width: 15px;
  height: 15px;
}
${endMarker}`;

src = src.slice(0, start) + replacement + src.slice(end + endMarker.length);

fs.writeFileSync(file, src, "utf8");
console.log("Header button font dili düzəldildi.");
