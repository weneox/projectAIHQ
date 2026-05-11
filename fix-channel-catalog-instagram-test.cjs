const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "ai-hq-frontend/src/test/pages/ChannelCatalog.test.jsx");
let src = fs.readFileSync(file, "utf8");

src = src.replace(
  `    expect(document.body).toHaveTextContent(
      /Inbound DMs can resolve against tenant runtime/i
    );`,
  `    expect(document.body).toHaveTextContent(/Messages are connected to Inbox/i);`
);

src = src.replace(
  `  it("opens the Instagram modal with live tenant status", async () => {`,
  `  it("opens the Instagram drawer with customer-facing connection status", async () => {`
);

fs.writeFileSync(file, src, "utf8");
console.log("updated ChannelCatalog Instagram drawer test");
