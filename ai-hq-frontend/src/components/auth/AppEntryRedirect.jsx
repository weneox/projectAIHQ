import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAppAuthContext, getAppBootstrapContext } from "../../lib/appSession.js";
import {
  PRODUCT_HOME_ROUTE,
  WORKSPACE_SELECTION_ROUTE,
  hasMultipleWorkspaceChoices,
  isLocalWorkspaceEntryEnabled,
  resolveAuthenticatedLanding,
} from "../../lib/appEntry.js";
import { isWelcomeIdentityComplete } from "../../lib/welcomeIdentity.js";
import AppBootSurface from "../loading/AppBootSurface.jsx";

export default function AppEntryRedirect() {
  const navigate = useNavigate();
  const localWorkspaceEntry = isLocalWorkspaceEntryEnabled();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (localWorkspaceEntry) {
        setFailed(false);
        navigate(PRODUCT_HOME_ROUTE, { replace: true });
        return;
      }

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

        if (!isWelcomeIdentityComplete({ auth, bootstrap })) {
          setFailed(false);
          navigate("/welcome", { replace: true });
          return;
        }

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
  }, [localWorkspaceEntry, navigate]);

  if (failed) {
    return (
      <AppBootSurface
        label="Səhifə açılmır"
        detail="Növbəti addımı indi yükləmək mümkün olmadı."
      />
    );
  }

  return null;
}
