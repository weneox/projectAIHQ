import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAppAuthContext, getAppBootstrapContext } from "../../lib/appSession.js";
import {
  WORKSPACE_SELECTION_ROUTE,
  hasMultipleWorkspaceChoices,
  resolveAuthenticatedLanding,
} from "../../lib/appEntry.js";
import AppBootSurface from "../loading/AppBootSurface.jsx";

export default function AppEntryRedirect() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const auth = await getAppAuthContext();
        if (!alive) return;

        if (!auth?.authenticated) {
          navigate("/login", { replace: true });
          return;
        }

        if (hasMultipleWorkspaceChoices(auth)) {
          setFailed(false);
          navigate(WORKSPACE_SELECTION_ROUTE, { replace: true });
          return;
        }

        const bootstrap = await getAppBootstrapContext();
        if (!alive) return;

        setFailed(false);
        navigate(resolveAuthenticatedLanding({ auth, bootstrap }), {
          replace: true,
        });
      } catch {
        if (!alive) return;
        setFailed(true);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [navigate]);

  if (failed) {
    return (
      <AppBootSurface
        label="Workspace unavailable"
        detail="We could not load your workspace entry right now."
      />
    );
  }

  return null;
}
