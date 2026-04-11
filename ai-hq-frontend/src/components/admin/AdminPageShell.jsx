import { RefreshCcw } from "lucide-react";

import SurfaceBanner from "../feedback/SurfaceBanner.jsx";
import { PageCanvas, PageHeader } from "../ui/AppShellPrimitives.jsx";

function HeaderRefreshButton({ surface, refreshLabel }) {
  if (!surface?.refresh) return null;

  return (
    <button
      type="button"
      onClick={surface.refresh}
      disabled={surface.loading || surface.saving}
      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-medium text-text transition hover:border-line-strong hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCcw className="h-4 w-4" />
      <span>{refreshLabel || "Refresh"}</span>
    </button>
  );
}

export default function AdminPageShell({
  eyebrow,
  title,
  description,
  surface,
  refreshLabel = "Refresh",
  unavailableMessage = "",
  actions = null,
  children,
}) {
  return (
    <PageCanvas className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <HeaderRefreshButton surface={surface} refreshLabel={refreshLabel} />
            {actions}
          </>
        }
      />

      <SurfaceBanner
        surface={surface}
        unavailableMessage={unavailableMessage}
        refreshLabel={refreshLabel}
      />

      {children}
    </PageCanvas>
  );
}
