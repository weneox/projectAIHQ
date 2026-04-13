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
import AppBootSurface from "./components/loading/AppBootSurface.jsx";
import {
  LoadingSurface,
  PageCanvas,
} from "./components/ui/AppShellPrimitives.jsx";
import { INTERNAL_ONLY_APP_ROUTES } from "./lib/appEntry.js";
import { getAppAuthContext } from "./lib/appSession.js";

const Inbox = lazy(() => import("./pages/Inbox.jsx"));
const ProductHomePage = lazy(() => import("./surfaces/home/ProductHomePage.jsx"));
const Welcome = lazy(() => import("./pages/Welcome.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
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
    <PageCanvas className="px-4 py-8 md:px-6 md:py-10">
      <LoadingSurface
        title="Loading page"
        description="Preparing the next workspace surface."
        className="mx-auto max-w-[720px]"
      />
    </PageCanvas>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function GuestRouteGuard({ children }) {
  const [state, setState] = useState({
    loading: true,
    allowGuest: false,
    unavailable: false,
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const auth = await getAppAuthContext({ force: true });
        if (!alive) return;

        if (auth?.authenticated) {
          setState({
            loading: false,
            allowGuest: false,
            unavailable: false,
          });
          return;
        }

        if (auth?.transientFailure || auth?.unavailable || auth?.resolved === false) {
          setState({
            loading: false,
            allowGuest: false,
            unavailable: true,
          });
          return;
        }

        setState({
          loading: false,
          allowGuest: true,
          unavailable: false,
        });
      } catch {
        if (!alive) return;
        setState({
          loading: false,
          allowGuest: false,
          unavailable: true,
        });
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) {
    return (
      <AppBootSurface
        label="Checking account"
        detail="Looking for an active session before we show this page."
      />
    );
  }

  if (state.unavailable) {
    return (
      <AppBootSurface
        label="Authentication unavailable"
        detail="We could not verify your session right now."
      />
    );
  }

  if (!state.allowGuest) {
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
    <GuestRouteGuard>{withSuspense(<Login />)}</GuestRouteGuard>
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