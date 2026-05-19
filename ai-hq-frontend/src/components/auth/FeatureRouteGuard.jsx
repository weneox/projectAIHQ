import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { isLocalWorkspaceEntryEnabled } from "../../lib/appEntry.js";
import {
  getAppBootstrapContext,
  peekAppBootstrapContext,
} from "../../lib/appSession.js";
import { isBootstrapFeatureEnabled } from "../../lib/featureFlags.js";
import AppBootSurface from "../loading/AppBootSurface.jsx";

function hasFeaturePayload(bootstrap = {}) {
  return Boolean(
    bootstrap?.features &&
      typeof bootstrap.features === "object" &&
      !Array.isArray(bootstrap.features)
  );
}

function deriveFeatureState(bootstrap, featurePath) {
  if (!hasFeaturePayload(bootstrap)) {
    return {
      loading: false,
      allowed: bootstrap?.ok !== false,
      unavailable: bootstrap?.ok === false,
    };
  }

  return {
    loading: false,
    allowed: isBootstrapFeatureEnabled(bootstrap, featurePath),
    unavailable: false,
  };
}

export default function FeatureRouteGuard({
  children,
  featurePath,
  fallbackTo = "/home",
}) {
  const location = useLocation();
  const localWorkspaceEntry = isLocalWorkspaceEntryEnabled();
  const [state, setState] = useState(() => {
    if (localWorkspaceEntry) {
      return { loading: false, allowed: true, unavailable: false };
    }

    const cachedBootstrap = peekAppBootstrapContext();
    if (cachedBootstrap) {
      return deriveFeatureState(cachedBootstrap, featurePath);
    }

    return { loading: true, allowed: false, unavailable: false };
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      if (localWorkspaceEntry) {
        setState({ loading: false, allowed: true, unavailable: false });
        return;
      }

      const bootstrap = await getAppBootstrapContext();
      if (!alive) return;

      setState(deriveFeatureState(bootstrap, featurePath));
    }

    run();

    return () => {
      alive = false;
    };
  }, [featurePath, localWorkspaceEntry]);

  if (state.loading) return null;

  if (state.unavailable) {
    return (
      <AppBootSurface
        label="Sehife acilmir"
        detail="Bu bolmenin statusunu indi yoxlamaq mumkun olmadi."
      />
    );
  }

  if (!state.allowed) {
    return <Navigate to={fallbackTo} replace state={{ from: location }} />;
  }

  return children;
}
