import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Shell from "./components/layout/Shell.jsx";
import AdminShell from "./components/admin/AdminShell.jsx";
import AdminRouteGuard from "./components/admin/AdminRouteGuard.jsx";
import OperatorRouteGuard from "./components/auth/OperatorRouteGuard.jsx";
import UserRouteGuard from "./components/auth/UserRouteGuard.jsx";
import AppEntryRedirect from "./components/auth/AppEntryRedirect.jsx";
import {
  LoadingSurface,
  PageCanvas,
} from "./components/ui/AppShellPrimitives.jsx";
import { INTERNAL_ONLY_APP_ROUTES } from "./lib/appEntry.js";

const Proposals = lazy(() => import("./pages/Proposals.jsx"));
const Publish = lazy(() => import("./pages/Publish.jsx"));
const Executions = lazy(() => import("./pages/Executions.jsx"));
const Inbox = lazy(() => import("./pages/Inbox.jsx"));
const ProductHomePage = lazy(() => import("./surfaces/home/ProductHomePage.jsx"));
const WorkspacePage = lazy(() => import("./surfaces/workspace/WorkspacePage.jsx"));
const Leads = lazy(() => import("./pages/Leads.jsx"));
const Comments = lazy(() => import("./pages/Comments.jsx"));
const Incidents = lazy(() => import("./pages/Incidents.jsx"));
const Voice = lazy(() => import("./pages/Voice.jsx"));
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

export default function App() {
  const rootEntryElement = (
    <UserRouteGuard>
      <AppEntryRedirect />
    </UserRouteGuard>
  );

  const selectWorkspaceEntryElement = (
    <UserRouteGuard>{withSuspense(<SelectWorkspace />)}</UserRouteGuard>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={withSuspense(<Login />)} />
        <Route path="/signup" element={withSuspense(<Login />)} />
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
          <Route path="welcome" element={withSuspense(<Welcome />)} />
          <Route path="workspace" element={withSuspense(<WorkspacePage />)} />
          <Route
            path="setup"
            element={<Navigate to="/home?assistant=setup" replace />}
          />

          <Route
            path="publish"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Publishing remains an internal workflow surface. It is not part of the primary launch lane."
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
                description="Proposals remains an internal operational workspace. The primary launch lane stays centered on launch channel, setup, truth, runtime, and live operator surfaces."
              >
                {withSuspense(<Proposals />)}
              </OperatorRouteGuard>
            }
          />

          <Route path="inbox" element={withSuspense(<Inbox />)} />
          <Route path="channels" element={withSuspense(<ChannelCatalog />)} />

          <Route
            path="leads"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Leads is an operational follow-up surface. It stays available to owner, admin, and operator roles without redefining the launch lane."
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
                description="Comments remains a live operator surface for moderation and reply review, but it does not replace the primary launch-channel and inbox posture."
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
                description="Voice remains a separate live operator surface for receptionist sessions, call controls, and handoff. It does not redefine the primary launch lane."
              >
                {withSuspense(<Voice />)}
              </OperatorRouteGuard>
            }
          />

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

          <Route
            path="executions"
            element={
              <OperatorRouteGuard
                title="Operator access required"
                description="Execution traces remain an advanced internal inspection surface rather than a primary launch product area."
              >
                {withSuspense(<Executions />)}
              </OperatorRouteGuard>
            }
          />

          {renderInternalRouteRedirects()}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
