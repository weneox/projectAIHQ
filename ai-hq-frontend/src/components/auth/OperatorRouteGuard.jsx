import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import {
  getAppAuthContext,
  getAppSessionContext,
  peekAppAuthContext,
  peekAppSessionContext,
} from "../../lib/appSession.js";
import { isLocalWorkspaceEntryEnabled } from "../../lib/appEntry.js";
import AppBootSurface from "../loading/AppBootSurface.jsx";

const DEFAULT_ALLOWED_ROLES = new Set(["owner", "admin", "operator"]);

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function hasRequiredRole(role, allowedRoles = DEFAULT_ALLOWED_ROLES) {
  return allowedRoles.has(normalizeRole(role));
}

function pickAuthRole(auth = {}) {
  return normalizeRole(
    auth?.membership?.role ||
      auth?.workspace?.role ||
      auth?.user?.role ||
      auth?.role
  );
}

function deriveGuardState(auth = {}, session = {}, allowedRoles = DEFAULT_ALLOWED_ROLES) {
  const authenticated = !!(session?.auth?.authenticated ?? auth?.authenticated);
  const role = normalizeRole(session?.viewerRole) || pickAuthRole(auth);

  return {
    loading: false,
    authenticated,
    allowed: authenticated && hasRequiredRole(role, allowedRoles),
    unavailable: false,
  };
}

function AccessDeniedState({ title = "Operator access required", description }) {
  return (
    <section className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center justify-center px-4 py-8">
      <div className="w-full rounded-[28px] border border-amber-400/18 bg-[linear-gradient(180deg,rgba(23,15,8,0.96),rgba(14,10,8,0.98))] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-8">
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
            <ShieldAlert className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/70">
              Restricted surface
            </div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-white">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68 md:text-[15px]">
              {description ||
                "This workspace route is reserved for operational users. Your account can continue using the launch-core product, but this surface is not available with the current role."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/truth"
                className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/18 hover:bg-white/[0.10]"
              >
                Go to Business Truth
              </Link>
              <Link
                to="/inbox"
                className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-300/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/28 hover:bg-cyan-300/14"
              >
                Open Inbox
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function OperatorRouteGuard({
  children,
  title,
  description,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
}) {
  const location = useLocation();
  const localWorkspaceEntry = isLocalWorkspaceEntryEnabled();
  const [state, setState] = useState(() => {
    if (localWorkspaceEntry) {
      return {
        loading: false,
        authenticated: true,
        allowed: true,
        unavailable: false,
      };
    }

    const cachedAuth = peekAppAuthContext();
    const cachedSession = peekAppSessionContext();

    if (cachedAuth?.authenticated || cachedSession?.auth?.authenticated) {
      return deriveGuardState(cachedAuth, cachedSession, allowedRoles);
    }

    return {
      loading: true,
      authenticated: false,
      allowed: false,
      unavailable: false,
    };
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      if (localWorkspaceEntry) {
        setState({
          loading: false,
          authenticated: true,
          allowed: true,
          unavailable: false,
        });
        return;
      }

      const cachedAuth = peekAppAuthContext();
      const cachedSession = peekAppSessionContext();

      try {
        const auth = await getAppAuthContext();
        if (!alive) return;

        const authenticated = !!auth?.authenticated;
        if (!authenticated) {
          setState({
            loading: false,
            authenticated: false,
            allowed: false,
            unavailable: false,
          });
          return;
        }

        let role = pickAuthRole(auth);

        try {
          const session = await getAppSessionContext();
          if (!alive) return;
          role = normalizeRole(session?.viewerRole) || role;
        } catch {
          // Session context can fail independently; fall back to auth-derived role.
        }

        if (!alive) return;

        setState({
          ...deriveGuardState(auth, { viewerRole: role, auth }, allowedRoles),
        });
      } catch {
        if (!alive) return;

        const fallbackAuth = peekAppAuthContext() || cachedAuth;
        const fallbackSession = peekAppSessionContext() || cachedSession;

        if (fallbackAuth?.authenticated || fallbackSession?.auth?.authenticated) {
          setState(deriveGuardState(fallbackAuth, fallbackSession, allowedRoles));
          return;
        }

        setState({
          loading: false,
          authenticated: false,
          allowed: false,
          unavailable: true,
        });
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [allowedRoles, localWorkspaceEntry]);

  if (state.loading) {
    return (
      <AppBootSurface label="Preparing workspace" detail="Loading operator access" />
    );
  }

  if (state.unavailable) {
    return (
      <AppBootSurface
        label="Operator surface unavailable"
        detail="We could not verify operator access right now."
      />
    );
  }

  if (!state.authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!state.allowed) {
    return <AccessDeniedState title={title} description={description} />;
  }

  return children;
}