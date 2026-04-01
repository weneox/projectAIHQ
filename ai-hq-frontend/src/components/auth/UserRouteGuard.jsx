import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  getCanonicalWorkspaceContract,
  isLocalWorkspaceEntryEnabled,
  isWorkspaceSelectionPath,
} from "../../lib/appEntry.js";
import { getAppAuthContext, getAppBootstrapContext } from "../../lib/appSession.js";
import AppBootSurface from "../loading/AppBootSurface.jsx";

function isSetupPath(pathname = "") {
  return pathname === "/setup" || pathname.startsWith("/setup/");
}

export default function UserRouteGuard({ children }) {
  const location = useLocation();
  const localWorkspaceEntry = isLocalWorkspaceEntryEnabled();
  const onWorkspaceSelection = isWorkspaceSelectionPath(location.pathname);

  const [state, setState] = useState({
    loading: true,
    ok: false,
    redirectTo: "",
    failed: false,
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      if (localWorkspaceEntry) {
        setState({
          loading: false,
          ok: true,
          redirectTo: isSetupPath(location.pathname) ? "/workspace" : "",
          failed: false,
        });
        return;
      }

      try {
        const auth = await getAppAuthContext();
        if (!alive) return;

        if (!auth?.authenticated) {
          setState({
            loading: false,
            ok: false,
            redirectTo: "",
            failed: false,
          });
          return;
        }

        if (onWorkspaceSelection) {
          setState({
            loading: false,
            ok: true,
            redirectTo: "",
            failed: false,
          });
          return;
        }

        const bootstrap = await getAppBootstrapContext();
        if (!alive) return;

        const workspace = getCanonicalWorkspaceContract(bootstrap);
        const setupCompleted = workspace.workspaceReady;
        const setupRoute = workspace.nextSetupRoute || "/setup/studio";

        const onSetup = isSetupPath(location.pathname);
        let redirectTo = "";

        if (!setupCompleted && !onSetup) {
          redirectTo = setupRoute;
        } else if (setupCompleted && onSetup) {
          redirectTo = "/workspace";
        } else if (
          location.pathname === "/setup" ||
          (onSetup && location.pathname !== setupRoute)
        ) {
          redirectTo = setupRoute;
        }

        if (!alive) return;

        setState({
          loading: false,
          ok: true,
          redirectTo,
          failed: false,
        });
      } catch {
        if (!alive) return;

        setState({
          loading: false,
          ok: false,
          redirectTo: "",
          failed: true,
        });
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [localWorkspaceEntry, location.pathname, onWorkspaceSelection]);

  if (state.loading) {
    return (
      <AppBootSurface
        label="Preparing workspace"
        detail="Syncing operator context"
      />
    );
  }

  if (state.failed) {
    return (
      <AppBootSurface
        label="Workspace unavailable"
        detail="We could not verify your session right now."
      />
    );
  }

  if (!state.ok) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (state.redirectTo && state.redirectTo !== location.pathname) {
    return <Navigate to={state.redirectTo} replace />;
  }

  return children;
}