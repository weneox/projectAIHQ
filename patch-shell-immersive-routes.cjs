const fs = require("fs");

const file = "ai-hq-frontend/src/components/layout/Shell.jsx";
let src = fs.readFileSync(file, "utf8");

const oldLine = '  if (path.startsWith("/inbox") || path.startsWith("/customers") || path.startsWith("/leads") || path.startsWith("/reports") || path.startsWith("/channels") || path.startsWith("/launch") || path.startsWith("/welcome") || path.startsWith("/truth") || path.startsWith("/team")) return "immersive";';

const newLine = '  if (path.startsWith("/home") || path.startsWith("/inbox") || path.startsWith("/customers") || path.startsWith("/leads") || path.startsWith("/reports") || path.startsWith("/channels") || path.startsWith("/knowledge") || path.startsWith("/settings") || path.startsWith("/launch") || path.startsWith("/welcome") || path.startsWith("/truth") || path.startsWith("/team")) return "immersive";';

if (!src.includes(oldLine)) {
  throw new Error("resolveShellMode immersive line tapılmadı.");
}

src = src.replace(oldLine, newLine);

fs.writeFileSync(file, src, "utf8");
console.log("Home, Knowledge, Settings də Team kimi immersive container ölçüsünə keçirildi.");
