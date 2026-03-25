function s(v, d = "") {
  return String(v ?? d).trim();
}

export default function FinalizeFooter({
  savingBusiness,
  blockingMessage = "",
  onClose,
  onSubmit,
}) {
  const blocked = !!s(blockingMessage);

  return (
    <div className="relative z-10 border-t border-slate-200/80 bg-[rgba(250,250,250,0.9)] px-5 py-4 backdrop-blur-[16px] sm:px-6">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm leading-6 text-slate-500">
          {blocked
            ? blockingMessage
            : "Finalize only after the proposed truth and the observed evidence both look correct."}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={savingBusiness}
            className="inline-flex h-11 items-center justify-center rounded-full bg-white/86 px-5 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900 disabled:opacity-60"
          >
            Close
          </button>

          <button
            type="submit"
            onClick={onSubmit}
            disabled={savingBusiness || blocked}
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingBusiness ? "Finalizing..." : "Finalize reviewed truth"}
          </button>
        </div>
      </div>
    </div>
  );
}
