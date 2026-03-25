import { RefreshCw } from "lucide-react";

function Button({ children, onClick, tone = "default", disabled = false, icon: Icon }) {
  const toneMap = {
    default:
      "border-white/10 bg-white/[0.04] text-white/76 hover:border-white/16 hover:bg-white/[0.06] hover:text-white",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-medium transition",
        toneMap[tone] || toneMap.default,
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

export default function InboxToolbar({
  operatorName,
  setOperatorName,
  wsState,
  dbDisabled,
  onRefresh,
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-[30px] font-semibold tracking-[-0.05em] text-white">
          Inbox
        </div>
        <div className="mt-2 text-sm text-white/46">
          DM, operator handoff və AI reply axını üçün enterprise inbox paneli.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/72">
          Operator:
          <input
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            className="ml-2 w-[100px] bg-transparent text-white outline-none placeholder:text-white/25"
            placeholder="Name"
          />
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-white/60">
          WS: {wsState}
        </div>

        {dbDisabled ? (
          <div className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-amber-100">
            DB disabled
          </div>
        ) : null}

        <Button onClick={onRefresh} icon={RefreshCw}>
          Refresh
        </Button>
      </div>
    </div>
  );
}