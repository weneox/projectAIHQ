const fs = require("fs");

function patch(file, patches) {
  let src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

  for (const [from, to] of patches) {
    if (src.includes(from)) {
      src = src.replaceAll(from, to);
    }
  }

  fs.writeFileSync(file, src, "utf8");
  console.log(`${file}: OK`);
}

patch("ai-hq-frontend/src/pages/ChannelCatalog.jsx", [
  ["Channel marketplace", "Channel catalog"],
]);

patch("ai-hq-frontend/src/test/pages/ChannelCatalog.test.jsx", [
  ["^channel marketplace$", "^channel catalog$"],
  ["Channel marketplace", "Channel catalog"],
  ["channel marketplace", "channel catalog"],
  ["launch channels", "channel catalog"],
]);

console.log("Channel title catalog olaraq dəyişdirildi.");
