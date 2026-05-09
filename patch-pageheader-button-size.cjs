const fs = require("fs");

const file = "ai-hq-frontend/src/components/ui/AppShellPrimitives.jsx";
let src = fs.readFileSync(file, "utf8");

if (!src.includes("function normalizePageHeaderActionNode")) {
  throw new Error("normalizePageHeaderActionNode tapılmadı. AppShellPrimitives.jsx-də yeni PageHeader helperləri yoxdur.");
}

if (src.includes('size: "header"')) {
  console.log("AppShellPrimitives.jsx: PageHeader button size artıq header-dir.");
  process.exit(0);
}

src = src.replace(
  '      size: "sm",',
  '      size: "header",'
);

if (!src.includes('size: "header"')) {
  throw new Error('size: "sm" tapılmadı, dəyişmə alınmadı.');
}

fs.writeFileSync(file, src, "utf8");
console.log("AppShellPrimitives.jsx: PageHeader buttonları size='header' edildi.");
