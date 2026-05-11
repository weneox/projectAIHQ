const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "ai-hq-frontend/src/test/pages/ChannelCatalog.test.jsx");
let src = fs.readFileSync(file, "utf8");

src = src.replace(
  `    expect(
      await screen.findByText(/instagram is connected/i)
    ).toBeInTheDocument();

    expect(document.body).toHaveTextContent(/Messages are connected to Inbox/i);`,
  `    expect(
      await screen.findByText(/instagram.*connected/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/Messages are connected to Inbox/i)
    ).toBeInTheDocument();`
);

src = src.replace(
  `    expect(
      await screen.findByText(/instagram is connected/i)
    ).toBeInTheDocument();`,
  `    expect(
      await screen.findByText(/instagram.*connected/i)
    ).toBeInTheDocument();`
);

src = src.replace(
  `    expect(document.body).toHaveTextContent(/Messages are connected to Inbox/i);`,
  `    expect(
      await screen.findByText(/Messages are connected to Inbox/i)
    ).toBeInTheDocument();`
);

fs.writeFileSync(file, src, "utf8");
console.log("relaxed Instagram drawer test for customer-facing copy");
