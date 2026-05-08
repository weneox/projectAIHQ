export default function AppPaginationFooter({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  filtered = false,
  minWidthClass = "",
  onPageChange,
}) {
  const from = totalItems ? (currentPage - 1) * pageSize + 1 : 0;
  const to = Math.min(totalItems, currentPage * pageSize);

  return (
    <div
      className={[
        "flex items-center justify-between border-t border-line-soft px-4 py-2.5",
        minWidthClass,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="text-[12px] font-medium text-text-muted">
        Showing <span className="font-semibold text-text">{from}</span>-
        <span className="font-semibold text-text">{to}</span> of{" "}
        <span className="font-semibold text-text">{totalItems}</span>
        {filtered ? <span className="text-text-subtle"> filtered</span> : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-[12px] font-semibold text-text transition-colors duration-base ease-premium hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-45"
        >
          Previous
        </button>

        <div className="inline-flex h-8 min-w-[54px] items-center justify-center rounded-md border border-line-soft bg-surface-subtle px-2 text-[12px] font-semibold text-text-muted">
          {currentPage} / {totalPages}
        </div>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-[12px] font-semibold text-text transition-colors duration-base ease-premium hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-45"
        >
          Next
        </button>
      </div>
    </div>
  );
}
