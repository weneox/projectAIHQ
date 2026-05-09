const fs = require("fs");

const file = "ai-hq-frontend/src/components/ui/Button.jsx";
let src = fs.readFileSync(file, "utf8");

if (src.includes('header: "ui-button--header"')) {
  console.log("Button.jsx: header size artıq var.");
  process.exit(0);
}

src = src.replace(
  '  lg: "ui-button--lg",\n  hero: "ui-button--hero",',
  '  lg: "ui-button--lg",\n  header: "ui-button--header",\n  hero: "ui-button--hero",'
);

if (!src.includes('header: "ui-button--header"')) {
  throw new Error("Button.jsx SIZE_CLASS içində lg/hero yeri tapılmadı.");
}

fs.writeFileSync(file, src, "utf8");
console.log("Button.jsx: ui-button--header size əlavə edildi.");
