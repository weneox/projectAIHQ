const fs = require("fs");

const file = "ai-hq-frontend/src/pages/ChannelCatalog.jsx";
let src = fs.readFileSync(file, "utf8");

src = src.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

src = src.replace(
  /title\s*=\s*"Channel marketplace"/g,
  'title="Channel catalog"'
);

src = src.replace(
  /title\s*=\s*"Launch channels"/g,
  'title="Channel catalog"'
);

if (!src.includes('title="Channel catalog"')) {
  throw new Error("Channel catalog title yazılmadı.");
}

fs.writeFileSync(file, src, "utf8");
console.log("ChannelCatalog.jsx title Channel catalog edildi.");
