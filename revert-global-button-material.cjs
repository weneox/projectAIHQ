const fs = require("fs");

const file = "ai-hq-frontend/src/index.css";
let src = fs.readFileSync(file, "utf8");

function replaceBetween(startText, endText, replacement) {
  const start = src.indexOf(startText);
  const end = src.indexOf(endText, start);

  if (start === -1 || end === -1) {
    throw new Error(`${startText} -> ${endText} aralığı tapılmadı.`);
  }

  src = src.slice(0, start) + replacement.trimEnd() + "\n\n  " + src.slice(end);
}

replaceBetween(
  ".ui-button--primary {",
  ".ui-button--secondary,",
  `
.ui-button--primary {
  background: rgba(46, 96, 255, 0.28);
  box-shadow: var(--shadow-button-brand);
}

.ui-button--primary .ui-button__inner {
  background: rgb(var(--color-brand));
  color: #fff;
}

.ui-button--primary:not(:disabled):hover {
  box-shadow: var(--shadow-button-brand-hover);
}

.ui-button--primary:not(:disabled):hover .ui-button__inner,
.ui-button--primary:not(:disabled):active .ui-button__inner {
  background: rgb(var(--color-brand-strong));
}
`
);

replaceBetween(
  ".ui-button--secondary,",
  ".ui-button--ghost {",
  `
.ui-button--secondary,
.ui-button--outline {
  background: rgb(var(--color-line-strong));
  box-shadow: 0 12px 28px -26px rgba(15, 23, 42, 0.18);
}

.ui-button--secondary .ui-button__inner,
.ui-button--outline .ui-button__inner {
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text));
}

.ui-button--secondary:not(:disabled):hover .ui-button__inner,
.ui-button--outline:not(:disabled):hover .ui-button__inner {
  background: rgb(var(--color-surface-muted));
}
`
);

replaceBetween(
  ".ui-button--soft {",
  ".ui-button--danger {",
  `
.ui-button--soft {
  background: rgba(var(--color-brand), 0.18);
  box-shadow: 0 12px 28px -26px rgba(46, 96, 255, 0.22);
}

.ui-button--soft .ui-button__inner {
  background: rgba(var(--color-brand), 0.08);
  color: rgb(var(--color-brand));
}

.ui-button--soft:not(:disabled):hover .ui-button__inner {
  background: rgba(var(--color-brand), 0.12);
}
`
);

replaceBetween(
  ".ui-button--danger {",
  "/* Fields */",
  `
.ui-button--danger {
  background: rgba(var(--color-danger), 0.24);
  box-shadow: 0 14px 32px -24px rgba(190, 24, 93, 0.28);
}

.ui-button--danger .ui-button__inner {
  background: rgb(var(--color-danger));
  color: #fff;
}

.ui-button--danger:not(:disabled):hover .ui-button__inner {
  background: rgba(var(--color-danger), 0.94);
}
`
);

fs.writeFileSync(file, src, "utf8");
console.log("Son qlobal button material patchi geri qaytarıldı.");
