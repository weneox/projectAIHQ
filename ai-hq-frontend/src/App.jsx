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
import Inbox from "./pages/Inbox.jsx";
import ProductHomePage from "./surfaces/home/ProductHomePage.jsx";
import Welcome from "./pages/Welcome.jsx";
import TruthViewerPage from "./pages/Truth/TruthViewerPage.jsx";
import ChannelCatalog from "./pages/ChannelCatalog.jsx";
import {
  INTERNAL_ONLY_APP_ROUTES,
  isLocalWorkspaceEntryEnabled,
} from "./lib/appEntry.js";
import {
  getAppAuthContext,
  peekAppAuthContext,
} from "./lib/appSession.js";

const PublicWebsiteWidget = lazy(() => import("./pages/PublicWebsiteWidget.jsx"));
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

const ADMIN_ROUTES_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN_ROUTES === "1";

function withSuspense(element) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

function deriveGuestInitialState({ localWorkspaceEntry = false } = {}) {
  if (localWorkspaceEntry) {
    return {
      allowGuest: true,
      redirectAuthenticated: false,
    };
  }

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
  const localWorkspaceEntry = isLocalWorkspaceEntryEnabled();

  const [state, setState] = useState(() =>
    deriveGuestInitialState({ localWorkspaceEntry })
  );

  useEffect(() => {
    if (localWorkspaceEntry) return undefined;

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
  }, [localWorkspaceEntry]);

  if (!localWorkspaceEntry && (state.redirectAuthenticated || !state.allowGuest)) {
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

function renderAdminRoutes() {
  if (!ADMIN_ROUTES_ENABLED) {
    return (
      <>
        <Route path="/admin/login" element={<Navigate to="/" replace />} />
        <Route path="/admin/*" element={<Navigate to="/" replace />} />
      </>
    );
  }

  return (
    <>
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
        <Route path="/verify-email" element={<Navigate to="/login" replace />} />
        <Route
          path="/widget/website-chat"
          element={withSuspense(<PublicWebsiteWidget />)}
        />

        {renderAdminRoutes()}

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
          <Route path="home" element={<ProductHomePage />} />

          <Route
            path="setup"
            element={<Navigate to="/home?assistant=setup" replace />}
          />
          <Route
            path="setup/*"
            element={<Navigate to="/home?assistant=setup" replace />}
          />

          <Route path="welcome" element={<Welcome />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="channels" element={<ChannelCatalog />} />

          <Route
            path="truth"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Truth remains the governed review surface behind the launch lane and should stay aligned with setup approval and runtime health."
              >
                <TruthViewerPage />
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
