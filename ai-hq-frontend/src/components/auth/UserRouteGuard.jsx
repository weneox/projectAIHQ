import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  isLocalWorkspaceEntryEnabled,
  isWorkspaceSelectionPath,
} from "../../lib/appEntry.js";
import { getAppAuthContext } from "../../lib/appSession.js";
import AppBootSurface from "../loading/AppBootSurface.jsx";

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
          redirectTo: "",
          failed: false,
        });
        return;
      }

      try {
        const auth = await getAppAuthContext({ force: true });
        if (!alive) return;

        if (auth?.transientFailure || auth?.unavailable || auth?.resolved === false) {
          setState({
            loading: false,
            ok: false,
            redirectTo: "",
            failed: true,
          });
          return;
        }

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

        setState({
          loading: false,
          ok: true,
          redirectTo: "",
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
  }, [localWorkspaceEntry, onWorkspaceSelection]);

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