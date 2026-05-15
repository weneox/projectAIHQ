import { Suspense, lazy, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import Shell from "./components/layout/Shell.jsx";
import OperatorRouteGuard from "./components/auth/OperatorRouteGuard.jsx";
import UserRouteGuard from "./components/auth/UserRouteGuard.jsx";
import AppEntryRedirect from "./components/auth/AppEntryRedirect.jsx";
import Login from "./pages/Login.jsx";
import Inbox from "./pages/Inbox.jsx";
import ProductHomePage from "./surfaces/home/ProductHomePage.jsx";
import TruthViewerPage from "./pages/Truth/TruthViewerPage.jsx";
import ChannelCatalog from "./pages/ChannelCatalog.jsx";
import LaunchChecklist from "./pages/LaunchChecklist.jsx";
import Settings from "./pages/Settings.jsx";
import Customers from "./pages/Customers.jsx";
import Leads from "./pages/Leads.jsx";
import VoiceLab from "./pages/VoiceLab.jsx";
import Reports from "./pages/Reports.jsx";
import Knowledge from "./pages/Knowledge.jsx";
import Team from "./pages/Team.jsx";
import {
  INTERNAL_ONLY_APP_ROUTES,
  isLocalWorkspaceEntryEnabled,
} from "./lib/appEntry.js";
import {
  getAppAuthContext,
  peekAppAuthContext,
} from "./lib/appSession.js";

const PublicWebsiteWidget = lazy(() => import("./pages/PublicWebsiteWidget.jsx"));
const SelectWorkspace = lazy(() => import("./pages/SelectWorkspace.jsx"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail.jsx"));

const LEGACY_LAUNCH_FREEZE_ROUTES = [
  "workspace",
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

function deriveGuestInitialState({ localWorkspaceEntry = false } = {}) {
  if (localWorkspaceEntry) {
    return {
      allowGuest: false,
      redirectAuthenticated: true,
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

  if (localWorkspaceEntry) {
    return <Navigate to="/home" replace />;
  }

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
  return (
    <>
      <Route path="/admin/login" element={<Navigate to="/" replace />} />
      <Route path="/admin/*" element={<Navigate to="/" replace />} />
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
          <Route path="launch" element={<LaunchChecklist />} />

          <Route
            path="setup"
            element={<Navigate to="/home?assistant=setup" replace />}
          />
          <Route
            path="setup/*"
            element={<Navigate to="/home?assistant=setup" replace />}
          />

          <Route path="welcome" element={<Navigate to="/home" replace />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="customers" element={<Customers />} />
          <Route path="leads" element={<Leads />} />
          <Route path="voice-lab" element={<VoiceLab />} />
          <Route path="reports" element={<Reports />} />
          <Route path="channels" element={<ChannelCatalog />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="settings" element={<Settings />} />
          <Route path="team" element={<Team />} />

          <Route
            path="truth"
            element={
              <OperatorRouteGuard
                title="Giriş məhduddur"
                description="Bu bölmə yalnız təsdiqli biznes məlumatlarını idarə edən komanda üzvləri üçündür."
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

