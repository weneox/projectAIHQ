import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileJson,
  Layers3,
  X,
} from "lucide-react";
import {
  cn,
  displayValue,
  durationBetween,
  extractSummary,
  formatDate,
  pretty,
  statusMeta,
} from "./execution-ui.jsx";

const TABS = ["overview", "input", "output", "error"];

export default function ExecutionInspector({
  open,
  detail,
  detailErr,
  loading,
  tab,
  setTab,
  onClose,
}) {
  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value ?? ""));
    } catch {}
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#02050c]/58 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[1500px] overflow-hidden rounded-[34px] border border-white/10 bg-[#060d18]/94 shadow-[0_32px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_0%_0%,rgba(56,189,248,0.12),transparent_34%),radial-gradient(380px_circle_at_100%_0%,rgba(168,85,247,0.09),transparent_40%)]" />

            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-white/40">
                    Execution Inspector
                  </div>
                  <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-white break-words">
                    {displayValue(detail?.type, loading ? "Loading…" : "Execution")}
                  </div>
                  <div className="mt-1 text-sm text-white/48 break-all">
                    {detail?.id || "No execution selected"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {TABS.map((name) => (
                    <button
                      key={name}
                      onClick={() => setTab(name)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm font-medium transition",
                        tab === name
                          ? "border-white/16 bg-white/[0.10] text-white"
                          : "border-white/10 bg-white/[0.04] text-white/62 hover:text-white/88"
                      )}
                    >
                      {name}
                    </button>
                  ))}

                  <button
                    onClick={onClose}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/76 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[72vh] overflow-auto px-5 py-5">
                {loading ? (
                  <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/58">
                    Loading inspector surface…
                  </div>
                ) : detailErr ? (
                  <div className="rounded-[28px] border border-rose-400/16 bg-rose-400/[0.08] p-6 text-sm text-rose-100">
                    {detailErr}
                  </div>
                ) : !detail ? (
                  <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/58">
                    No detail available.
                  </div>
                ) : (
                  <>
                    {tab === "overview" && <OverviewTab detail={detail} onCopy={copyText} />}
                    {tab === "input" && (
                      <JsonTab
                        title="Input payload"
                        payload={detail.input}
                        onCopy={copyText}
                      />
                    )}
                    {tab === "output" && (
                      <JsonTab
                        title="Output payload"
                        payload={detail.output}
                        onCopy={copyText}
                      />
                    )}
                    {tab === "error" && <ErrorTab detail={detail} onCopy={copyText} />}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function OverviewTab({ detail, onCopy }) {
  const meta = statusMeta(detail.status);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", meta.badge)}>
              {meta.label}
            </span>
            <button
              onClick={() => onCopy(detail.id)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70 transition hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy ID
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric label="Created" value={formatDate(detail.created_at)} />
            <Metric label="Finished" value={formatDate(detail.finished_at)} />
            <Metric label="Duration" value={durationBetween(detail.created_at, detail.finished_at)} />
            <Metric label="Proposal" value={detail.proposal_id} mono />
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">
            Input surface
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {extractSummary(detail.input).length ? (
              extractSummary(detail.input).map((item) => (
                <Metric key={item.key} label={item.key} value={item.value} />
              ))
            ) : (
              <div className="text-sm text-white/56">No readable input summary.</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">
            Output surface
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {extractSummary(detail.output).length ? (
              extractSummary(detail.output).map((item) => (
                <Metric key={item.key} label={item.key} value={item.value} />
              ))
            ) : (
              <div className="text-sm text-white/56">No readable output summary.</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
            <Layers3 className="h-4 w-4" />
            Operator note
          </div>
          <div className="mt-4 text-sm leading-7 text-white/68">
            This inspector preserves raw payload access while keeping the experience premium
            and readable. Later we can add parsed stages, retry actions, progress traces,
            and richer runtime diagnostics.
          </div>
        </div>
      </div>
    </div>
  );
}

function JsonTab({ title, payload, onCopy }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">{title}</div>
        <button
          onClick={() => onCopy(pretty(payload))}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/72 transition hover:text-white"
        >
          <Copy className="h-4 w-4" />
          Copy JSON
        </button>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#030813]/90 p-3">
        <pre className="max-h-[54vh] overflow-auto rounded-[22px] border border-white/8 bg-black/20 p-4 text-xs leading-6 text-white/84 whitespace-pre-wrap break-words">
          {pretty(payload) || "—"}
        </pre>
      </div>
    </div>
  );
}

function ErrorTab({ detail, onCopy }) {
  const failed = String(detail.status || "").toLowerCase() === "failed";

  return (
    <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">
          Incident state
        </div>

        <div className="mt-5 flex items-center gap-3">
          {failed ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-rose-400/16 bg-rose-400/[0.08] text-rose-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-emerald-400/16 bg-emerald-400/[0.08] text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          )}

          <div>
            <div className="text-base font-medium text-white">
              {failed ? "Failure captured" : "No active incident"}
            </div>
            <div className="mt-1 text-sm text-white/54">
              {failed
                ? "Execution ended with an operational issue."
                : "This run does not currently expose an error state."}
            </div>
          </div>
        </div>

        <button
          onClick={() => onCopy(detail.error || "")}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/72 transition hover:text-white"
        >
          <Copy className="h-4 w-4" />
          Copy error
        </button>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#030813]/90 p-3">
        <div className="mb-3 flex items-center gap-2 px-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
          <FileJson className="h-4 w-4" />
          Error payload
        </div>
        <pre className="max-h-[54vh] overflow-auto rounded-[22px] border border-white/8 bg-black/20 p-4 text-xs leading-6 text-white/84 whitespace-pre-wrap break-words">
          {detail.error ? displayValue(detail.error) : "—"}
        </pre>
      </div>
    </div>
  );
}

function Metric({ label, value, mono = false }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">{label}</div>
      <div className={cn("mt-2 text-sm text-white/88 break-words", mono && "font-mono")}>
        {displayValue(value)}
      </div>
    </div>
  );
}