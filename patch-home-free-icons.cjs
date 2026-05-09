const fs = require("fs");

const file = "ai-hq-frontend/src/surfaces/home/ProductHomePage.jsx";
let src = fs.readFileSync(file, "utf8");

const optionalStart = src.indexOf("function OptionalActionRow({ item, onNavigate }) {");
const quickStart = src.indexOf("function QuickShortcut({ icon: Icon, title, description, path, onNavigate }) {");
const sectionStart = src.indexOf("function SectionTitle({ title, description }) {");

if (optionalStart === -1 || quickStart === -1 || sectionStart === -1) {
  throw new Error("OptionalActionRow / QuickShortcut / SectionTitle blokları tapılmadı.");
}

const newOptional = `function OptionalActionRow({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      className="group grid w-full gap-4 border-b border-line-soft px-4 py-3.5 text-left transition-colors duration-base ease-premium last:border-b-0 hover:bg-surface-subtle md:grid-cols-[minmax(0,1fr)_112px] md:items-center"
    >
      <div className="flex min-w-0 items-center gap-4">
        <Icon
          className="h-[28px] w-[28px] shrink-0 text-text"
          strokeWidth={1.9}
        />

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="truncate text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
              {item.title}
            </div>

            <StatusBadge tone={statusTone(item.status)}>{item.label}</StatusBadge>
          </div>

          <div className="mt-1 truncate text-[12.5px] font-medium text-text-muted">
            {item.description}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-start gap-1.5 text-[13px] font-semibold text-brand md:justify-end">
        <span>{item.action}</span>
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform duration-base ease-premium group-hover:translate-x-0.5"
          strokeWidth={2.15}
        />
      </div>
    </button>
  );
}

`;

const newQuick = `function QuickShortcut({ icon: Icon, title, description, path, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(path)}
      className="group flex items-center justify-between gap-3 rounded-md border border-line-soft bg-white px-4 py-3.5 text-left transition-[background-color,border-color] duration-base ease-premium hover:border-line hover:bg-surface-subtle"
    >
      <div className="flex min-w-0 items-center gap-4">
        <Icon
          className="h-[27px] w-[27px] shrink-0 text-text"
          strokeWidth={1.9}
        />

        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[12px] font-medium text-text-muted">
            {description}
          </div>
        </div>
      </div>

      <ArrowRight
        className="h-4 w-4 shrink-0 text-text-subtle transition-transform duration-base ease-premium group-hover:translate-x-0.5 group-hover:text-brand"
        strokeWidth={2.1}
      />
    </button>
  );
}

`;

src =
  src.slice(0, optionalStart) +
  newOptional +
  newQuick +
  src.slice(sectionStart);

fs.writeFileSync(file, src, "utf8");
console.log("Home iconları böyüdü və box/pil içindən çıxarıldı.");
