const fs = require("fs");

const file = "ai-hq-frontend/src/index.css";
let src = fs.readFileSync(file, "utf8");

function replaceBlock(startSelector, endSelector, replacement) {
  const start = src.indexOf(startSelector);
  const end = src.indexOf(endSelector, start);

  if (start === -1 || end === -1) {
    throw new Error(`${startSelector} bloku tapılmadı.`);
  }

  src = src.slice(0, start) + replacement.trimEnd() + "\n\n  " + src.slice(end);
}

replaceBlock(
  ".ui-button--primary {",
  ".ui-button--secondary,",
  `
.ui-button--primary {
  background: linear-gradient(
    180deg,
    rgb(var(--color-brand)),
    rgb(var(--color-brand-strong))
  );
  box-shadow: none;
}

.ui-button--primary .ui-button__inner {
  background: rgb(var(--color-brand));
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(15, 23, 42, 0.12);
}

.ui-button--primary:not(:disabled):hover {
  box-shadow: none;
}

.ui-button--primary:not(:disabled):hover .ui-button__inner,
.ui-button--primary:not(:disabled):active .ui-button__inner {
  background: rgb(var(--color-brand-strong));
}
`
);

replaceBlock(
  ".ui-button--secondary,",
  ".ui-button--ghost {",
  `
.ui-button--secondary,
.ui-button--outline {
  background: rgb(var(--color-line-strong));
  box-shadow: none;
}

.ui-button--secondary .ui-button__inner,
.ui-button--outline .ui-button__inner {
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    inset 0 -1px 0 rgba(15, 23, 42, 0.045);
}

.ui-button--secondary:not(:disabled):hover .ui-button__inner,
.ui-button--outline:not(:disabled):hover .ui-button__inner {
  background: rgb(var(--color-surface-muted));
}
`
);

replaceBlock(
  ".ui-button--soft {",
  ".ui-button--danger {",
  `
.ui-button--soft {
  background: rgba(var(--color-brand), 0.34);
  box-shadow: none;
}

.ui-button--soft .ui-button__inner {
  background: rgba(var(--color-brand), 0.08);
  color: rgb(var(--color-brand));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    inset 0 -1px 0 rgba(var(--color-brand), 0.05);
}

.ui-button--soft:not(:disabled):hover .ui-button__inner {
  background: rgba(var(--color-brand), 0.12);
}
`
);

replaceBlock(
  ".ui-button--danger {",
  "/* Fields */",
  `
.ui-button--danger {
  background: rgba(var(--color-danger), 0.55);
  box-shadow: none;
}

.ui-button--danger .ui-button__inner {
  background: rgb(var(--color-danger));
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -1px 0 rgba(15, 23, 42, 0.12);
}

.ui-button--danger:not(:disabled):hover .ui-button__inner {
  background: rgba(var(--color-danger), 0.94);
}
`
);

fs.writeFileSync(file, src, "utf8");
console.log("Global Button ailəsi: glow/kölgə silindi, premium qalın material kontur saxlandı.");
