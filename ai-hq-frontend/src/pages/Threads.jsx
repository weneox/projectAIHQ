import { FlaskConical } from "lucide-react";
import Card from "../components/ui/Card.jsx";

export default function Threads() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full border border-amber-300/20 bg-amber-300/10 p-2 text-amber-200">
          <FlaskConical className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300/70">
            Internal demo route
          </div>
          <div className="mt-2 text-sm font-semibold">Threads</div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            This route is not part of the default product navigation. It remains reachable only as
            an internal/demo placeholder for future agent chat logs, search, and export.
          </div>
        </div>
      </div>
    </Card>
  );
}
