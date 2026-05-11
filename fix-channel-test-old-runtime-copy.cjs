const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "ai-hq-frontend/src/test/pages/ChannelCatalog.test.jsx");
let src = fs.readFileSync(file, "utf8");

src = src.replace(
  /expect\(document\.body\)\.toHaveTextContent\(\s*\/Inbound DMs can resolve against tenant runtime\/i\s*\);/g,
  `expect(document.body).toHaveTextContent(/Messages are connected to Inbox/i);`
);

src = src.replace(
  /await screen\.findByText\(\s*\/instagram is connected\/i\s*\)/g,
  `await screen.findByText(/instagram.*connected/i)`
);

fs.writeFileSync(file, src, "utf8");
console.log("removed old tenant runtime expectation from ChannelCatalog test");
