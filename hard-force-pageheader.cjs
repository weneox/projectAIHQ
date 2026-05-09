const fs = require("fs");

const file = "ai-hq-frontend/src/components/ui/AppShellPrimitives.jsx";
let src = fs.readFileSync(file, "utf8");

const start = src.indexOf("export function PageHeader({");
const end = src.indexOf("\nexport function SectionHeader", start);

if (start === -1 || end === -1) {
  throw new Error("PageHeader block tapılmadı.");
}

const replacement = `export function PageHeader({
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

        <h1
          className="app-page-header-title font-display text-text"
          style={{
            fontSize: "35.84px",
            fontWeight: 620,
            lineHeight: 1.02,
            letterSpacing: "-0.055em",
            margin: 0,
          }}
        >
          {title}
        </h1>

        {description ? (
          <p
            className="app-page-header-description text-text-muted"
            style={{
              marginTop: "10px",
              maxWidth: "760px",
              fontSize: "14.5px",
              fontWeight: 520,
              lineHeight: "24px",
              letterSpacing: "-0.012em",
              marginBottom: 0,
            }}
          >
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="app-page-header-actions flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
`;

src = src.slice(0, start) + replacement + src.slice(end);

fs.writeFileSync(file, src, "utf8");
console.log("PageHeader inline style ilə Team ölçüsünə məcbur edildi.");
