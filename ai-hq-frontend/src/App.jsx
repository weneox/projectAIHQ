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

const loadInbox = () => import("./pages/Inbox.jsx");
const loadProductHomePage = () => import("./surfaces/home/ProductHomePage.jsx");
const loadWelcome = () => import("./pages/Welcome.jsx");
const loadVerifyEmail = () => import("./pages/Auth/VerifyEmailPage.jsx");
const loadPublicWebsiteWidget = () => import("./pages/PublicWebsiteWidget.jsx");
const loadTruthViewerPage = () => import("./pages/Truth/TruthViewerPage.jsx");
const loadChannelCatalog = () => import("./pages/ChannelCatalog.jsx");
const loadAdminLogin = () => import("./pages/AdminLogin.jsx");
const loadAdminTenants = () => import("./pages/AdminTenants.jsx");
const loadAdminTeam = () => import("./pages/AdminTeam.jsx");
const loadAdminSecrets = () => import("./pages/AdminSecrets.jsx");
const loadSelectWorkspace = () => import("./pages/SelectWorkspace.jsx");

const Inbox = lazy(loadInbox);
const ProductHomePage = lazy(loadProductHomePage);
const Welcome = lazy(loadWelcome);
const VerifyEmail = lazy(loadVerifyEmail);
const PublicWebsiteWidget = lazy(loadPublicWebsiteWidget);
const TruthViewerPage = lazy(loadTruthViewerPage);
const ChannelCatalog = lazy(loadChannelCatalog);
const AdminLogin = lazy(loadAdminLogin);
const AdminTenants = lazy(loadAdminTenants);
const AdminTeam = lazy(loadAdminTeam);
const AdminSecrets = lazy(loadAdminSecrets);
const SelectWorkspace = lazy(loadSelectWorkspace);

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

function withSuspense(element) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

function warmLaunchRoutes() {
  const warm = () => {
    Promise.allSettled([
      loadProductHomePage(),
      loadChannelCatalog(),
      loadInbox(),
      loadTruthViewerPage(),
      loadWelcome(),
    ]);
  };

  if (typeof window === "undefined") return;

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(warm, { timeout: 1800 });
    return;
  }

  window.setTimeout(warm, 400);
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
  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    warmLaunchRoutes();
  }, []);

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
