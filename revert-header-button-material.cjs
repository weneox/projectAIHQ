const fs = require("fs");

const file = "ai-hq-frontend/src/index.css";
let src = fs.readFileSync(file, "utf8");

const startMarker = "/* === page-header-button-material:start === */";
const endMarker = "/* === page-header-button-material:end === */";

const start = src.indexOf(startMarker);
const end = src.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  console.log("page-header-button-material bloku tapılmadı, silinəcək heç nə yoxdur.");
  process.exit(0);
}

src = src.slice(0, start).trimEnd() + "\n\n" + src.slice(end + endMarker.length).trimStart();

fs.writeFileSync(file, src, "utf8");
console.log("Pis header button material override geri qaytarıldı.");
