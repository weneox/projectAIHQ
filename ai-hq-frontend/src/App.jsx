import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Shell from "./components/layout/Shell.jsx";
import AdminShell from "./components/admin/AdminShell.jsx";
import AdminRouteGuard from "./components/admin/AdminRouteGuard.jsx";
import OperatorRouteGuard from "./components/auth/OperatorRouteGuard.jsx";
import UserRouteGuard from "./components/auth/UserRouteGuard.jsx";
import AppEntryRedirect from "./components/auth/AppEntryRedirect.jsx";
import {
  INTERNAL_ONLY_APP_ROUTES,
  isLocalWorkspaceEntryEnabled,
} from "./lib/appEntry.js";

const Proposals = lazy(() => import("./pages/Proposals.jsx"));
const Publish = lazy(() => import("./pages/Publish.jsx"));
const Executions = lazy(() => import("./pages/Executions.jsx"));
const Expert = lazy(() => import("./pages/Expert.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Inbox = lazy(() => import("./pages/Inbox.jsx"));
const WorkspacePage = lazy(() => import("./surfaces/workspace/WorkspacePage.jsx"));
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

function renderInternalRouteRedirects() {
  return (
    <>
      {INTERNAL_ONLY_APP_ROUTES.map((path) => (
        <Route
          key={path}
          path={path.slice(1)}
          element={<Navigate to="/workspace" replace />}
        />
      ))}
    </>
  );
}

export default function App() {
  const localWorkspaceEntry = isLocalWorkspaceEntryEnabled();
  const setupEntryElement = localWorkspaceEntry ? (
    <Navigate to="/workspace" replace />
  ) : (
    <UserRouteGuard>
      {withSuspense(<SetupStudioRoute />)}
    </UserRouteGuard>
  );

  const setupRedirectElement = localWorkspaceEntry ? (
    <Navigate to="/workspace" replace />
  ) : (
    <UserRouteGuard>
      <Navigate to="/setup/studio" replace />
    </UserRouteGuard>
  );

  const rootEntryElement = localWorkspaceEntry ? (
    <Navigate to="/workspace" replace />
  ) : (
    <UserRouteGuard>
      <AppEntryRedirect />
    </UserRouteGuard>
  );

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
          element={setupEntryElement}
        />

        <Route
          path="/setup"
          element={setupRedirectElement}
        />

        <Route
          path="/setup/business"
          element={setupRedirectElement}
        />

        <Route
          path="/setup/channels"
          element={setupRedirectElement}
        />

        <Route
          path="/setup/knowledge"
          element={setupRedirectElement}
        />

        <Route
          path="/setup/services"
          element={setupRedirectElement}
        />

        <Route
          path="/setup/playbooks"
          element={setupRedirectElement}
        />

        <Route
          path="/setup/runtime"
          element={setupRedirectElement}
        />

        <Route path="/" element={rootEntryElement} />

        <Route
          path="/"
          element={
            <UserRouteGuard>
              <Shell />
            </UserRouteGuard>
          }
        >
          <Route path="workspace" element={withSuspense(<WorkspacePage />)} />
          <Route
            path="publish"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Publish brings together outgoing content, moderation pressure, approvals, and recent publishing outcomes for operational roles."
              >
                {withSuspense(<Publish />)}
              </OperatorRouteGuard>
            }
          />
          <Route
            path="proposals"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Proposals remains a detailed operational workspace. The primary product surfaces stay centered on Workspace, Inbox, Publish, and Expert."
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
                description="Comments remains the detailed moderation workspace. The primary product surfaces stay centered on Workspace, Inbox, Publish, and Expert."
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
                description="Incident history remains an advanced operational triage surface and stays limited to owner, admin, and operator roles."
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
                description="Voice sessions and live call controls remain detailed operational surfaces for owner, admin, and operator roles."
              >
                {withSuspense(<Voice />)}
              </OperatorRouteGuard>
            }
          />
          <Route path="truth" element={withSuspense(<TruthViewerPage />)} />
          <Route path="expert" element={withSuspense(<Expert />)} />
          <Route
            path="executions"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Execution traces remain an advanced operator inspection surface. The primary product surfaces stay centered on Workspace, Inbox, Publish, and Expert."
              >
                {withSuspense(<Executions />)}
              </OperatorRouteGuard>
            }
          />
          <Route path="settings" element={withSuspense(<Settings />)} />
          {renderInternalRouteRedirects()}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
