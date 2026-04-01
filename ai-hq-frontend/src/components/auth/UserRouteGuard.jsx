import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isLocalWorkspaceEntryEnabled } from "../../lib/appEntry.js";
import { getAppSessionContext } from "../../lib/appSession.js";
import AppBootSurface from "../loading/AppBootSurface.jsx";

function isSetupPath(pathname = "") {
  return pathname === "/setup" || pathname.startsWith("/setup/");
}

function normalizeSetupRoute(target = "") {
  const value = String(target || "").trim();

  if (!value) return "/setup/studio";
  if (value === "/setup") return "/setup/studio";
  if (value.startsWith("/setup/")) return "/setup/studio";

  return value;
}

export default function UserRouteGuard({ children }) {
  const location = useLocation();
  const localWorkspaceEntry = isLocalWorkspaceEntryEnabled();

  const [state, setState] = useState({
    loading: true,
    ok: false,
    redirectTo: "",
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      if (localWorkspaceEntry) {
        setState({
          loading: false,
          ok: true,
          redirectTo: isSetupPath(location.pathname) ? "/workspace" : "",
        });
        return;
      }

      try {
        const session = await getAppSessionContext();
        const auth = session?.auth || {};
        if (!alive) return;

        if (!auth?.authenticated) {
          setState({
            loading: false,
            ok: false,
            redirectTo: "",
          });
          return;
        }

        const onSetup = isSetupPath(location.pathname);
        const redirectTo =
          location.pathname === "/setup" ||
          (onSetup && location.pathname !== normalizeSetupRoute(location.pathname))
            ? "/setup/studio"
            : "";

        if (!alive) return;

        setState({
          loading: false,
          ok: true,
          redirectTo,
        });
      } catch {
        if (!alive) return;

        setState({
          loading: false,
          ok: false,
          redirectTo: "",
        });
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [localWorkspaceEntry, location.pathname]);

  if (state.loading) {
    return <AppBootSurface label="Preparing workspace" detail="Syncing operator context" />;
  }

  if (!state.ok) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (state.redirectTo && state.redirectTo !== location.pathname) {
    return <Navigate to={state.redirectTo} replace />;
  }

  return children;
}
