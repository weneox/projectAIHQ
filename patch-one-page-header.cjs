const fs = require("fs");

const file = process.argv[2];

if (!file) {
  throw new Error("File path verilməyib.");
}

let src = fs.readFileSync(file, "utf8");

const HEADER = {
  wrapper:
    "flex flex-col gap-4 border-b border-line-soft pb-5 md:flex-row md:items-end md:justify-between",
  titleWrap: "max-w-[860px]",
  title:
    "font-display text-[1.95rem] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[2.24rem]",
  description:
    "mt-2.5 max-w-[760px] text-[14.5px] font-medium leading-6 tracking-[var(--tracking-tight-sm)] text-text-muted",
  actions: "flex shrink-0 flex-wrap items-center gap-2",
};

function findSelfClosingTagEnd(text, startIndex) {
  let braceDepth = 0;
  let quote = "";
  let escaped = false;

  for (let i = startIndex; i < text.length - 1; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") braceDepth++;
    if (char === "}") braceDepth--;

    if (braceDepth === 0 && char === "/" && next === ">") return i + 2;
  }

  return -1;
}

function readProp(tag, name) {
  const re = new RegExp("\\b" + name + "\\s*=");
  const match = tag.match(re);
  if (!match) return null;

  let i = match.index + match[0].length;
  while (/\s/.test(tag[i])) i++;

  const first = tag[i];

  if (first === '"' || first === "'") {
    const quote = first;
    let j = i + 1;
    let escaped = false;

    while (j < tag.length) {
      const char = tag[j];

      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) break;

      j++;
    }

    return {
      raw: tag.slice(i + 1, j),
      child: tag.slice(i + 1, j),
    };
  }

  if (first === "{") {
    let depth = 0;
    let quote = "";
    let escaped = false;

    for (let j = i; j < tag.length; j++) {
      const char = tag[j];

      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = "";
        continue;
      }

      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }

      if (char === "{") depth++;
      if (char === "}") depth--;

      if (depth === 0) {
        const raw = tag.slice(i + 1, j).trim();

        const child =
          (raw.startsWith('"') && raw.endsWith('"')) ||
          (raw.startsWith("'") && raw.endsWith("'"))
            ? raw.slice(1, -1)
            : `{${raw}}`;

        return { raw, child };
      }
    }
  }

  return null;
}

function stripButtonSizes(value = "") {
  return value
    .replace(/\n\s+size="sm"/g, "")
    .replace(/\n\s+size="md"/g, "")
    .replace(/\n\s+size="lg"/g, "")
    .replace(/\n\s+size="xl"/g, "");
}

function normalizeActions(raw = "") {
  let value = String(raw || "").trim();

  if (value.startsWith("(") && value.endsWith(")")) {
    value = value.slice(1, -1).trim();
  }

  value = stripButtonSizes(value);

  return value;
}

function cleanImports(text) {
  return text
    .replace(/,\s*PageHeader/g, "")
    .replace(/PageHeader,\s*/g, "")
    .replace(/\{\s*,/g, "{")
    .replace(/,\s*\}/g, "}");
}

let changed = 0;

while (src.includes("<PageHeader")) {
  const start = src.indexOf("<PageHeader");
  const end = findSelfClosingTagEnd(src, start);

  if (end === -1) {
    throw new Error(`${file}: PageHeader sonu tapılmadı.`);
  }

  const tag = src.slice(start, end);

  const title = readProp(tag, "title");
  const description = readProp(tag, "description");
  const actions = readProp(tag, "actions");

  if (!title) {
    throw new Error(`${file}: PageHeader title tapılmadı.`);
  }

  const actionsChild = actions?.raw ? normalizeActions(actions.raw) : "";

  const replacement = `<div className="${HEADER.wrapper}">
        <div className="${HEADER.titleWrap}">
          <h1 className="${HEADER.title}">
            ${title.child}
          </h1>

          ${
            description
              ? `<p className="${HEADER.description}">
            ${description.child}
          </p>`
              : ""
          }
        </div>

        ${
          actionsChild
            ? `<div className="${HEADER.actions}">
          ${actionsChild}
        </div>`
            : ""
        }
      </div>`;

  src = src.slice(0, start) + replacement + src.slice(end);
  changed++;
}

src = cleanImports(src);

fs.writeFileSync(file, src, "utf8");

console.log(`${file}: ${changed ? "header dəyişdi" : "PageHeader tapılmadı / skip"}`);
