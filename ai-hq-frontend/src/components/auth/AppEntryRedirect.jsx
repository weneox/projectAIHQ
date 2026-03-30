import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAppBootstrap } from "../../api/app.js";
import {
  isForcedWorkspaceEntryEnabled,
  resolveAuthenticatedLanding,
} from "../../lib/appEntry.js";

export default function AppEntryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;

    if (isForcedWorkspaceEntryEnabled()) {
      navigate("/workspace", { replace: true });
      return () => {
        alive = false;
      };
    }

    getAppBootstrap()
      .then((bootstrap) => {
        if (!alive) return;
        navigate(resolveAuthenticatedLanding(bootstrap), { replace: true });
      })
      .catch(() => {
        if (!alive) return;
        navigate(
          isForcedWorkspaceEntryEnabled() ? "/workspace" : "/setup/studio",
          { replace: true }
        );
      });

    return () => {
      alive = false;
    };
  }, [navigate]);

  return null;
}
