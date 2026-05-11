const fs = require("fs");
const path = require("path");

const root = process.cwd();

function patch(rel, edits) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, "utf8");

  for (const edit of edits) {
    const before = src;
    src = src.replace(edit.find, edit.replace);
    if (before === src && edit.required !== false) {
      throw new Error(`${rel}: ${edit.name} tapılmadı`);
    }
  }

  fs.writeFileSync(file, src, "utf8");
  console.log(`patched ${rel}`);
}

patch("ai-hq-frontend/src/pages/ChannelCatalog.jsx", [
  {
    name: "modal width",
    find: /className="relative w-full max-w-\[[0-9]+px\]"/g,
    replace: 'className="relative w-full max-w-[720px]"',
  },
  {
    name: "modal height",
    find: /className="h-\[min\([^)]+,calc\(100vh-[^)]+\)\)\] overflow-hidden rounded-md border border-white\/70 bg-surface shadow-\[[^\"]+\]"/g,
    replace:
      'className="h-[min(560px,calc(100vh-120px))] overflow-hidden rounded-md border border-white/70 bg-surface shadow-[0_34px_90px_-54px_rgba(15,23,42,0.86)]"',
  },
]);

patch("ai-hq-frontend/src/components/channels/ChannelDetailDrawer.jsx", [
  {
    name: "header compact",
    find: /className="shrink-0 border-b border-line-soft bg-surface px-7 py-5"/g,
    replace: 'className="shrink-0 border-b border-line-soft bg-surface px-5 py-4"',
    required: false,
  },
  {
    name: "body compact",
    find: /className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-surface-muted px-7 py-6"/g,
    replace: 'className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-surface-muted px-5 py-4"',
    required: false,
  },
  {
    name: "body max width",
    find: /className="mx-auto max-w-\[[0-9]+px\] space-y-4"/g,
    replace: 'className="mx-auto max-w-[680px] space-y-3"',
    required: false,
  },
  {
    name: "footer compact",
    find: /className="shrink-0 border-t border-line-soft bg-white px-7 py-4"/g,
    replace: 'className="shrink-0 border-t border-line-soft bg-white px-5 py-3"',
    required: false,
  },
  {
    name: "footer max width",
    find: /className="mx-auto max-w-\[[0-9]+px\]"/g,
    replace: 'className="mx-auto max-w-[680px]"',
    required: false,
  },
  {
    name: "remove duplicate inbox button",
    find: /\s*\{connected \? \(\s*<Button[\s\S]*?leftIcon=\{<Inbox className="h-4 w-4" strokeWidth=\{2\.1\} \/>\}\s*>\s*Inbox\s*<\/Button>\s*\) : null\}\n/g,
    replace: "\n",
    required: false,
  },
  {
    name: "footer two columns",
    find: /className="grid gap-2 sm:grid-cols-\[minmax\(0,1fr\)_auto_auto\]"/g,
    replace: 'className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"',
    required: false,
  },
  {
    name: "remove inbox flow card",
    find: /\s*<Card padded="md">\s*<div className="flex items-start justify-between gap-5">[\s\S]*?<h3 className="text-\[18px\] font-semibold tracking-\[var\(--tracking-tight-lg\)\] text-text">\s*Inbox flow\s*<\/h3>[\s\S]*?<\/Card>/g,
    replace: "",
    required: false,
  },
]);

console.log("channel drawer overflow fix done");
