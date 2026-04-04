import Button from "../ui/Button.jsx";
import SurfaceBanner from "../feedback/SurfaceBanner.jsx";
import { PageCanvas, PageHeader } from "../ui/AppShellPrimitives.jsx";

export default function AdminPageShell({
  eyebrow = "",
  title,
  description = "",
  surface,
  refreshLabel = "Refresh",
  unavailableMessage = "",
  actions = null,
  children,
}) {
  return (
    <PageCanvas className="space-y-6">
      <PageHeader
        eyebrow={eyebrow || "Operations"}
        title={title}
        description={description}
        actions={
          <>
            {actions}
            {surface?.refresh ? (
              <Button
                variant="secondary"
                onClick={surface.refresh}
                disabled={surface.loading || surface.saving}
                className="h-10 px-4"
              >
                {refreshLabel}
              </Button>
            ) : null}
          </>
        }
      />

      <section>
        <SurfaceBanner
          surface={surface}
          unavailableMessage={unavailableMessage}
          refreshLabel={refreshLabel}
        />
      </section>

      {children}
    </PageCanvas>
  );
}
