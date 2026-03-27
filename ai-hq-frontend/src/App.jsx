import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Shell from "./components/layout/Shell.jsx";
import AdminShell from "./components/admin/AdminShell.jsx";
import AdminRouteGuard from "./components/admin/AdminRouteGuard.jsx";
import OperatorRouteGuard from "./components/auth/OperatorRouteGuard.jsx";
import UserRouteGuard from "./components/auth/UserRouteGuard.jsx";
import AppEntryRedirect from "./components/auth/AppEntryRedirect.jsx";
import { areInternalRoutesEnabled, INTERNAL_ONLY_APP_ROUTES } from "./lib/appEntry.js";

const Proposals = lazy(() => import("./pages/Proposals.jsx"));
const Executions = lazy(() => import("./pages/Executions.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Inbox = lazy(() => import("./pages/Inbox.jsx"));
const Leads = lazy(() => import("./pages/Leads.jsx"));
const Comments = lazy(() => import("./pages/Comments.jsx"));
const Incidents = lazy(() => import("./pages/Incidents.jsx"));
const Voice = lazy(() => import("./pages/Voice.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const TruthViewerPage = lazy(() => import("./pages/Truth/TruthViewerPage.jsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.jsx"));
const AdminTenants = lazy(() => import("./pages/AdminTenants.jsx"));
const AdminTeam = lazy(() => import("./pages/AdminTeam.jsx"));
const AdminSecrets = lazy(() => import("./pages/AdminSecrets.jsx"));
const SetupStudioRoute = lazy(() => import("./pages/SetupStudio/index.jsx"));
const CommandPage = lazy(() => import("./pages/CommandPage.jsx"));
const Agents = lazy(() => import("./pages/Agents.jsx"));
const Threads = lazy(() => import("./pages/Threads.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-10">
      <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 backdrop-blur-xl">
        Loading...
      </div>
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function renderInternalRouteSet(enabled) {
  if (enabled) {
    return (
      <>
        <Route path="command-demo" element={withSuspense(<CommandPage />)} />
        <Route path="analytics" element={withSuspense(<Analytics />)} />
        <Route path="agents" element={withSuspense(<Agents />)} />
        <Route path="threads" element={withSuspense(<Threads />)} />
      </>
    );
  }

  return (
    <>
      {INTERNAL_ONLY_APP_ROUTES.map((path) => (
        <Route
          key={path}
          path={path.slice(1)}
          element={<Navigate to="/truth" replace />}
        />
      ))}
    </>
  );
}

export default function App() {
  const internalRoutesEnabled = areInternalRoutesEnabled();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={withSuspense(<Login />)}
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

        <Route
          path="/setup/studio"
          element={
            <UserRouteGuard>
              {withSuspense(<SetupStudioRoute />)}
            </UserRouteGuard>
          }
        />

        <Route
          path="/setup"
          element={
            <UserRouteGuard>
              <Navigate to="/setup/studio" replace />
            </UserRouteGuard>
          }
        />

        <Route
          path="/setup/business"
          element={
            <UserRouteGuard>
              <Navigate to="/setup/studio" replace />
            </UserRouteGuard>
          }
        />

        <Route
          path="/setup/channels"
          element={
            <UserRouteGuard>
              <Navigate to="/setup/studio" replace />
            </UserRouteGuard>
          }
        />

        <Route
          path="/setup/knowledge"
          element={
            <UserRouteGuard>
              <Navigate to="/setup/studio" replace />
            </UserRouteGuard>
          }
        />

        <Route
          path="/setup/services"
          element={
            <UserRouteGuard>
              <Navigate to="/setup/studio" replace />
            </UserRouteGuard>
          }
        />

        <Route
          path="/setup/playbooks"
          element={
            <UserRouteGuard>
              <Navigate to="/setup/studio" replace />
            </UserRouteGuard>
          }
        />

        <Route
          path="/setup/runtime"
          element={
            <UserRouteGuard>
              <Navigate to="/setup/studio" replace />
            </UserRouteGuard>
          }
        />

        <Route
          path="/"
          element={
            <UserRouteGuard>
              <AppEntryRedirect />
            </UserRouteGuard>
          }
        />

        <Route
          path="/"
          element={
            <UserRouteGuard>
              <Shell />
            </UserRouteGuard>
          }
        >
          <Route
            path="proposals"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Proposals are still an operational workspace. Launch-core product users can continue in Business Truth, Setup Studio, Inbox, and Settings."
              >
                {withSuspense(<Proposals />)}
              </OperatorRouteGuard>
            }
          />
          <Route path="inbox" element={withSuspense(<Inbox />)} />
          <Route
            path="leads"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Leads is an operational follow-up surface. This launch slice keeps it available only to owner, admin, and operator roles."
              >
                {withSuspense(<Leads />)}
              </OperatorRouteGuard>
            }
          />
          <Route
            path="comments"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Comments is a moderation and response workspace. It stays gated to operational roles for this launch slice."
              >
                {withSuspense(<Comments />)}
              </OperatorRouteGuard>
            }
          />
          <Route
            path="incidents"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Incident history is an operational triage surface. It stays available only to owner, admin, and operator roles."
              >
                {withSuspense(<Incidents />)}
              </OperatorRouteGuard>
            }
          />
          <Route
            path="voice"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Voice sessions and live call controls are operational surfaces. They remain available only to owner, admin, and operator roles."
              >
                {withSuspense(<Voice />)}
              </OperatorRouteGuard>
            }
          />
          <Route path="truth" element={withSuspense(<TruthViewerPage />)} />
          <Route
            path="executions"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Execution traces are still an operator inspection surface. Normal launch-core users are redirected toward the core product instead."
              >
                {withSuspense(<Executions />)}
              </OperatorRouteGuard>
            }
          />
          <Route path="settings" element={withSuspense(<Settings />)} />
          {renderInternalRouteSet(internalRoutesEnabled)}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
