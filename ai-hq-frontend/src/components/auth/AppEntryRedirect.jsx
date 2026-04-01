import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAppBootstrapContext } from "../../lib/appSession.js";
import {
  isLocalWorkspaceEntryEnabled,
  resolveAuthenticatedLanding,
} from "../../lib/appEntry.js";
import AppBootSurface from "../loading/AppBootSurface.jsx";

export default function AppEntryRedirect() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;

    if (isLocalWorkspaceEntryEnabled()) {
      navigate("/workspace", { replace: true });
      return () => {
        alive = false;
      };
    }

    getAppBootstrapContext()
      .then((bootstrap) => {
        if (!alive) return;
        setFailed(false);
        navigate(resolveAuthenticatedLanding(bootstrap), { replace: true });
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
      });

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
