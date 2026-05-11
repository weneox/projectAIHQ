const fs = require("fs");
const path = require("path");

const root = process.cwd();
const file = path.join(root, "ai-hq-backend/src/services/businessTruthAnswer/retrieval.js");

let src = fs.readFileSync(file, "utf8");

const oldBlock = `function pushCandidate(target, candidate = {}) {
  const title = cleanText(candidate.title || candidate.name || candidate.label);
  const text = cleanText(
    candidate.text || candidate.description || candidate.summary || candidate.value
  );

  if (!title && !text) return;

  target.push({
    id: cleanText(candidate.id || candidate.key || title || text).slice(0, 180),
    type: cleanText(candidate.type || "fact"),
    title,
    text: text || title,
    source: cleanText(candidate.source || "approved_truth"),
  });
}`;

const newBlock = `function pushCandidate(target, candidate = {}) {
  const title = cleanText(candidate.title || candidate.name || candidate.label);
  const text = cleanText(
    candidate.text || candidate.description || candidate.summary || candidate.value
  );

  // Do not index generic title-only placeholders such as "Business summary",
  // "Phone", "Email", or "Pricing" when no approved value exists.
  // Those pollute embedding retrieval and can outrank real approved facts.
  if (!text) return;

  target.push({
    id: cleanText(candidate.id || candidate.key || title || text).slice(0, 180),
    type: cleanText(candidate.type || "fact"),
    title,
    text,
    source: cleanText(candidate.source || "approved_truth"),
  });
}`;

if (!src.includes(oldBlock)) {
  throw new Error("pushCandidate block not found");
}

src = src.replace(oldBlock, newBlock);
fs.writeFileSync(file, src, "utf8");

console.log("fixed retrieval corpus to skip empty title-only placeholders");
