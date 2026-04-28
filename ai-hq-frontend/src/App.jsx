import { Suspense, lazy, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import Shell from "./components/layout/Shell.jsx";
import AdminShell from "./components/admin/AdminShell.jsx";
import AdminRouteGuard from "./components/admin/AdminRouteGuard.jsx";
import OperatorRouteGuard from "./components/auth/OperatorRouteGuard.jsx";
import UserRouteGuard from "./components/auth/UserRouteGuard.jsx";
import AppEntryRedirect from "./components/auth/AppEntryRedirect.jsx";
import Login from "./pages/Login.jsx";
import { INTERNAL_ONLY_APP_ROUTES } from "./lib/appEntry.js";
import {
  getAppAuthContext,
  peekAppAuthContext,
} from "./lib/appSession.js";

const Inbox = lazy(() => import("./pages/Inbox.jsx"));
const ProductHomePage = lazy(() => import("./surfaces/home/ProductHomePage.jsx"));
const Welcome = lazy(() => import("./pages/Welcome.jsx"));
const VerifyEmail = lazy(() => import("./pages/Auth/VerifyEmailPage.jsx"));
const PublicWebsiteWidget = lazy(() => import("./pages/PublicWebsiteWidget.jsx"));
const TruthViewerPage = lazy(() => import("./pages/Truth/TruthViewerPage.jsx"));
const ChannelCatalog = lazy(() => import("./pages/ChannelCatalog.jsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.jsx"));
const AdminTenants = lazy(() => import("./pages/AdminTenants.jsx"));
const AdminTeam = lazy(() => import("./pages/AdminTeam.jsx"));
const AdminSecrets = lazy(() => import("./pages/AdminSecrets.jsx"));
const SelectWorkspace = lazy(() => import("./pages/SelectWorkspace.jsx"));

const LEGACY_LAUNCH_FREEZE_ROUTES = [
  "workspace",
  "leads",
  "comments",
  "voice",
  "publish",
  "proposals",
  "executions",
  "incidents",
];

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-shell-content px-1 py-2" aria-hidden="true">
      <div className="space-y-3">
        <div className="h-4 w-36 animate-pulse rounded-full bg-[rgba(15,23,42,0.055)]" />
        <div className="h-20 animate-pulse rounded-panel border border-line-soft bg-surface-subtle" />
      </div>
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function deriveGuestInitialState() {
  const cachedAuth = peekAppAuthContext();

  if (cachedAuth?.authenticated) {
    return {
      allowGuest: false,
      redirectAuthenticated: true,
    };
  }

  return {
    allowGuest: true,
    redirectAuthenticated: false,
  };
}

function GuestRouteGuard({ children }) {
  const [state, setState] = useState(deriveGuestInitialState);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const auth = await getAppAuthContext();
        if (!alive) return;

        if (auth?.authenticated) {
          setState({
            allowGuest: false,
            redirectAuthenticated: true,
          });
          return;
        }

        setState({
          allowGuest: true,
          redirectAuthenticated: false,
        });
      } catch {
        if (!alive) return;

        setState({
          allowGuest: true,
          redirectAuthenticated: false,
        });
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, []);

  if (state.redirectAuthenticated || !state.allowGuest) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function renderInternalRouteRedirects() {
  return (
    <>
      {INTERNAL_ONLY_APP_ROUTES.map((path) => (
        <Route
          key={path}
          path={path.slice(1)}
          element={<Navigate to="/home" replace />}
        />
      ))}
    </>
  );
}

function renderLegacyLaunchFreezeRedirects() {
  return (
    <>
      {LEGACY_LAUNCH_FREEZE_ROUTES.flatMap((path) => [
        <Route
          key={path}
          path={path}
          element={<Navigate to="/home" replace />}
        />,
        <Route
          key={`${path}-wildcard`}
          path={`${path}/*`}
          element={<Navigate to="/home" replace />}
        />,
      ])}
    </>
  );
}

export default function App() {
  const rootEntryElement = (
    <UserRouteGuard>
      <AppEntryRedirect />
    </UserRouteGuard>
  );

  const selectWorkspaceEntryElement = (
    <UserRouteGuard>{withSuspense(<SelectWorkspace />)}</UserRouteGuard>
  );

  const loginEntryElement = (
    <GuestRouteGuard>
      <Login />
    </GuestRouteGuard>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={loginEntryElement} />
        <Route path="/signup" element={loginEntryElement} />
        <Route path="/verify-email" element={withSuspense(<VerifyEmail />)} />
        <Route
          path="/widget/website-chat"
          element={withSuspense(<PublicWebsiteWidget />)}
        />

        <Route path="/admin/login" element={withSuspense(<AdminLogin />)} />

        <Route
          path="/admin"
          element={
            <AdminRouteGuard>
              <AdminShell />
            </AdminRouteGuard>
          }
        >
          <Route index element={<Navigate to="/admin/tenants" replace />} />
          <Route path="tenants" element={withSuspense(<AdminTenants />)} />
          <Route path="team" element={withSuspense(<AdminTeam />)} />
          <Route path="secrets" element={withSuspense(<AdminSecrets />)} />
        </Route>

        <Route path="/select-workspace" element={selectWorkspaceEntryElement} />
        <Route path="/" element={rootEntryElement} />

        <Route
          path="/"
          element={
            <UserRouteGuard>
              <Shell />
            </UserRouteGuard>
          }
        >
          <Route path="home" element={withSuspense(<ProductHomePage />)} />

          <Route
            path="setup"
            element={<Navigate to="/home?assistant=setup" replace />}
          />
          <Route
            path="setup/*"
            element={<Navigate to="/home?assistant=setup" replace />}
          />

          <Route path="welcome" element={withSuspense(<Welcome />)} />
          <Route path="inbox" element={withSuspense(<Inbox />)} />
          <Route path="channels" element={withSuspense(<ChannelCatalog />)} />

          <Route
            path="truth"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Truth remains the governed review surface behind the launch lane and should stay aligned with setup approval and runtime health."
              >
                {withSuspense(<TruthViewerPage />)}
              </OperatorRouteGuard>
            }
          />

          {renderLegacyLaunchFreezeRedirects()}
          {renderInternalRouteRedirects()}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
