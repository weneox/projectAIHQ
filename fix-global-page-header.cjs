const fs = require("fs");

const file = "ai-hq-frontend/src/components/ui/AppShellPrimitives.jsx";
let src = fs.readFileSync(file, "utf8");

const start = src.indexOf("export function PageHeader({");
const end = src.indexOf("\nexport function SectionHeader", start);

if (start === -1 || end === -1) {
  throw new Error("PageHeader function block tapılmadı.");
}

const next = `export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}) {
  return (
    <div
      className={cx(
        "app-page-header flex flex-col gap-4 border-b border-line-soft pb-5 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="max-w-[860px]">
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            {eyebrow}
          </div>
        ) : null}

        <h1 className="font-display text-[1.95rem] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[2.24rem]">
          {title}
        </h1>

        {description ? (
          <p className="mt-2.5 max-w-[760px] text-[14.5px] font-medium leading-6 tracking-[var(--tracking-tight-sm)] text-text-muted">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
`;

src = src.slice(0, start) + next + src.slice(end);

fs.writeFileSync(file, src, "utf8");
console.log("AppShellPrimitives PageHeader Team header ölçüsünə salındı.");
