import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  isLocalWorkspaceEntryEnabled,
  isWorkspaceSelectionPath,
} from "../../lib/appEntry.js";
import {
  getAppAuthContext,
  peekAppAuthContext,
  peekAppSessionContext,
} from "../../lib/appSession.js";
import AppBootSurface from "../loading/AppBootSurface.jsx";

function hasCachedAuthenticatedSession() {
  const cachedAuth = peekAppAuthContext();
  const cachedSession = peekAppSessionContext();

  return Boolean(cachedAuth?.authenticated || cachedSession?.auth?.authenticated);
}

function deriveInitialGuardState({ localWorkspaceEntry = false } = {}) {
  if (localWorkspaceEntry || hasCachedAuthenticatedSession()) {
    return {
      loading: false,
      ok: true,
      redirectTo: "",
      failed: false,
    };
  }

  return {
    loading: true,
    ok: false,
    redirectTo: "",
    failed: false,
  };
}

function deriveResolvedGuardState(auth = {}) {
  if (auth?.transientFailure || auth?.unavailable || auth?.resolved === false) {
    return {
      loading: false,
      ok: false,
      redirectTo: "",
      failed: true,
    };
  }

  if (!auth?.authenticated) {
    return {
      loading: false,
      ok: false,
      redirectTo: "",
      failed: false,
    };
  }

  return {
    loading: false,
    ok: true,
    redirectTo: "",
    failed: false,
  };
}

export default function UserRouteGuard({ children }) {
  const location = useLocation();
  const localWorkspaceEntry = isLocalWorkspaceEntryEnabled();
  const onWorkspaceSelection = isWorkspaceSelectionPath(location.pathname);

  const [state, setState] = useState(() =>
    deriveInitialGuardState({ localWorkspaceEntry })
  );

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
        const auth = await getAppAuthContext();
        if (!alive) return;

        const nextState = deriveResolvedGuardState(auth);

        if (onWorkspaceSelection && nextState.ok) {
          setState({
            loading: false,
            ok: true,
            redirectTo: "",
            failed: false,
          });
          return;
        }

        setState(nextState);
      } catch {
        if (!alive) return;

        if (hasCachedAuthenticatedSession()) {
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
    return null;
  }

  if (state.failed) {
    return (
      <AppBootSurface
        label="Səhifə açılmır"
        detail="Girişi indi yoxlamaq mümkün olmadı."
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
