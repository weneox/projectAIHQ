const fs = require("fs");

const file = "ai-hq-frontend/src/index.css";
let src = fs.readFileSync(file, "utf8");

const marker = "/* === page-header-button-material:start === */";

const css = `
${marker}
.ui-button--header {
  padding: 1px;
  box-shadow: none;
  transform: none;
}

.ui-button--header:not(:disabled):hover {
  transform: none;
}

.ui-button--header.ui-button--primary {
  background: rgb(var(--color-brand-strong));
  box-shadow: none;
}

.ui-button--header.ui-button--primary .ui-button__inner {
  background: rgb(var(--color-brand));
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.ui-button--header.ui-button--primary:not(:disabled):hover {
  box-shadow: none;
}

.ui-button--header.ui-button--primary:not(:disabled):hover .ui-button__inner {
  background: rgb(var(--color-brand-strong));
}

.ui-button--header.ui-button--secondary,
.ui-button--header.ui-button--outline {
  background: rgb(var(--color-line-strong));
  box-shadow: none;
}

.ui-button--header.ui-button--secondary .ui-button__inner,
.ui-button--header.ui-button--outline .ui-button__inner {
  background: #ffffff;
  color: rgb(var(--color-text));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.ui-button--header.ui-button--secondary:not(:disabled):hover .ui-button__inner,
.ui-button--header.ui-button--outline:not(:disabled):hover .ui-button__inner {
  background: rgb(var(--color-surface-muted));
}
/* === page-header-button-material:end === */
`;

if (src.includes(marker)) {
  const endMarker = "/* === page-header-button-material:end === */";
  const start = src.indexOf(marker);
  const end = src.indexOf(endMarker, start);

  if (end === -1) {
    throw new Error("page-header-button-material end marker tapılmadı.");
  }

  src = src.slice(0, start) + css.trim() + src.slice(end + endMarker.length);
} else {
  src = `${src.trimEnd()}\n\n${css.trim()}\n`;
}

fs.writeFileSync(file, src, "utf8");
console.log("Header button shadow silindi, səliqəli material kontur saxlandı.");
