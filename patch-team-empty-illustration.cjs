const fs = require("fs");

const file = "ai-hq-frontend/src/pages/Team.jsx";
let src = fs.readFileSync(file, "utf8");

src = src.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

if (!src.includes('import TeamEmptyIllustration from "../assets/channels/team.svg";')) {
  src = src.replace(
    'import { cx } from "../lib/cx.js";',
    'import TeamEmptyIllustration from "../assets/channels/team.svg";\nimport { cx } from "../lib/cx.js";'
  );
}

const oldBlock = `        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-line bg-surface-subtle text-text-muted">
          <Users className="h-5 w-5" strokeWidth={1.9} />
        </div>`;

const newBlock = `        {filtered ? (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-line bg-surface-subtle text-text-muted">
            <Users className="h-5 w-5" strokeWidth={1.9} />
          </div>
        ) : (
          <img
            src={TeamEmptyIllustration}
            alt=""
            aria-hidden="true"
            draggable="false"
            className="mx-auto h-auto w-[270px] max-w-full select-none"
          />
        )}`;

if (!src.includes(oldBlock)) {
  throw new Error("Team empty icon block tapılmadı.");
}

src = src.replace(oldBlock, newBlock);

fs.writeFileSync(file, src, "utf8");
console.log("Team empty state illustration əlavə edildi.");
