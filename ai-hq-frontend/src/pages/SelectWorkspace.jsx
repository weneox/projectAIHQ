import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { switchWorkspaceUser } from "../api/auth.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import AppIcon from "../components/ui/AppIcon.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import { getAppAuthContext, clearAppSessionContext } from "../lib/appSession.js";
import { cx } from "../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function workspaceName(workspace = {}) {
  return s(
    workspace.name ||
      workspace.workspaceName ||
      workspace.workspace_name ||
      workspace.companyName ||
      workspace.company_name ||
      workspace.displayName ||
      workspace.display_name ||
      workspace.tenantName ||
      workspace.tenant_name ||
      workspace.tenantKey ||
      workspace.tenant_key ||
      "Workspace"
  );
}

function workspaceKey(workspace = {}) {
  return s(
    workspace.tenantKey ||
      workspace.tenant_key ||
      workspace.workspaceKey ||
      workspace.workspace_key ||
      workspace.key ||
      workspace.slug ||
      ""
  );
}

function workspaceRole(workspace = {}) {
  return s(workspace.role || workspace.viewerRole || workspace.viewer_role || "member");
}

function workspaceToken(workspace = {}) {
  return s(
    workspace.switchToken ||
      workspace.switch_token ||
      workspace.accountSelectionToken ||
      workspace.account_selection_token ||
      workspace.token ||
      ""
  );
}

function workspaceStatus(workspace = {}) {
  if (workspace.active === false || workspace.disabled === true) return "disabled";
  if (workspace.current === true || workspace.selected === true) return "current";
  return "available";
}

function statusTone(status = "") {
  const safe = lower(status);

  if (safe === "current") return "success";
  if (safe === "disabled") return "neutral";

  return "brand";
}

function statusLabel(status = "") {
  const safe = lower(status);

  if (safe === "current") return "Current";
  if (safe === "disabled") return "Disabled";

  return "Available";
}

function initials(value = "") {
  const parts = s(value).split(/\s+/).filter(Boolean);

  if (!parts.length) return "W";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function normalizeWorkspaces(auth = {}) {
  const raw = arr(auth?.workspaces);

  if (raw.length) return raw;

  if (auth?.workspace) {
    return [{ ...auth.workspace, current: true }];
  }

  return [];
}

function WorkspaceRow({ workspace, selected, loading, onSelect }) {
  const name = workspaceName(workspace);
  const key = workspaceKey(workspace);
  const role = workspaceRole(workspace);
  const status = workspaceStatus(workspace);
  const disabled = status === "disabled" || loading;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cx(
        "grid min-h-[72px] w-full grid-cols-[minmax(260px,1fr)_150px_140px_130px] items-center gap-4 border-b border-line-soft px-5 py-4 text-left transition-colors duration-150 ease-premium last:border-b-0",
        selected ? "bg-brand/5" : "bg-white hover:bg-surface-subtle/55",
        disabled ? "cursor-not-allowed opacity-65" : "cursor-pointer"
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-[12.5px] font-semibold text-brand">
          {initials(name)}
        </span>

        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {name}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] font-medium text-text-muted">
            {key || "No workspace key"}
          </div>
        </div>
      </div>

      <div className="truncate text-[13px] font-medium text-text-muted">{role}</div>

      <AppStatusText tone={statusTone(status)}>{statusLabel(status)}</AppStatusText>

      <div className="flex justify-end">
        {selected ? (
          <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={2.1} />
        ) : (
          <ArrowRight className="h-4 w-4 text-text-muted" strokeWidth={2.1} />
        )}
      </div>
    </button>
  );
}

export default function SelectWorkspace() {
  const navigate = useNavigate();

  const [auth, setAuth] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const nextAuth = await getAppAuthContext({ force: true });
        if (!alive) return;

        setAuth(nextAuth);

        const workspaces = normalizeWorkspaces(nextAuth);
        const first = workspaces[0];

        if (first) {
          setSelectedKey(workspaceKey(first) || workspaceName(first));
        }
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Unable to load workspaces.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const workspaces = useMemo(() => normalizeWorkspaces(auth), [auth]);

  const filteredWorkspaces = useMemo(() => {
    const q = lower(query);

    return workspaces.filter((workspace) => {
      if (!q) return true;

      return lower(
        [workspaceName(workspace), workspaceKey(workspace), workspaceRole(workspace)].join(" ")
      ).includes(q);
    });
  }, [query, workspaces]);

  const selectedWorkspace = useMemo(() => {
    return (
      workspaces.find(
        (workspace) => (workspaceKey(workspace) || workspaceName(workspace)) === selectedKey
      ) || filteredWorkspaces[0]
    );
  }, [filteredWorkspaces, selectedKey, workspaces]);

  async function handleContinue() {
    if (!selectedWorkspace || switching) return;

    const status = workspaceStatus(selectedWorkspace);
    if (status === "disabled") return;

    const switchToken = workspaceToken(selectedWorkspace);

    setSwitching(true);
    setError("");

    try {
      if (switchToken) {
        await switchWorkspaceUser({ switchToken });
        clearAppSessionContext();
      }

      navigate("/home", { replace: true });
    } catch (err) {
      setError(err?.message || "Unable to switch workspace.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[1040px] flex-col justify-center">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <AppIcon icon={ShieldCheck} size="lg" tone="text" strokeWidth={2.05} />

              <h1 className="mt-5 text-[28px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
                Select workspace
              </h1>

              <p className="mt-3 text-[13.5px] font-medium leading-6 text-text-muted">
                Choose the workspace you want to operate. Access, inbox state, and
                customer data will follow that workspace.
              </p>
            </div>

            <Card padded={false} clip>
              <div className="px-5 py-5">
                <div className="text-[13px] font-semibold text-text">
                  Signed in account
                </div>

                <div className="mt-1 truncate text-[13px] font-medium text-text-muted">
                  {s(auth?.user?.email || auth?.identity?.email || auth?.user?.user_email) ||
                    "Session account"}
                </div>

                <div className="mt-4">
                  <AppStatusText tone={auth?.authenticated ? "success" : "warning"}>
                    {auth?.authenticated ? "Authenticated" : "Checking session"}
                  </AppStatusText>
                </div>
              </div>
            </Card>
          </div>

          <Card padded={false} clip>
            <div className="border-b border-line-soft px-5 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-[17px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                    Workspaces
                  </div>
                  <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                    {loading
                      ? "Loading available workspaces."
                      : `${filteredWorkspaces.length} workspace option${filteredWorkspaces.length === 1 ? "" : "s"}`}
                  </div>
                </div>

                <div className="w-full md:w-[320px]">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search workspace..."
                    appearance="quiet"
                    leftIcon={<Search className="h-4 w-4" strokeWidth={2.1} />}
                  />
                </div>
              </div>
            </div>

            {error ? (
              <div className="border-b border-line-soft px-5 py-3 text-[13px] font-semibold text-danger">
                {error}
              </div>
            ) : null}

            <div>
              {loading ? (
                <div className="px-5 py-12 text-center text-[13px] font-medium text-text-muted">
                  Loading workspaces...
                </div>
              ) : filteredWorkspaces.length ? (
                filteredWorkspaces.map((workspace) => {
                  const key = workspaceKey(workspace) || workspaceName(workspace);

                  return (
                    <WorkspaceRow
                      key={key}
                      workspace={workspace}
                      selected={selectedKey === key}
                      loading={switching}
                      onSelect={() => setSelectedKey(key)}
                    />
                  );
                })
              ) : (
                <div className="px-5 py-12 text-center">
                  <div className="text-[16px] font-semibold text-text">
                    No workspaces found
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-text-muted">
                    Clear the search or return to login with another account.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-line-soft px-5 py-4">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  clearAppSessionContext();
                  navigate("/login", { replace: true });
                }}
              >
                Back to login
              </Button>

              <Button
                type="button"
                size="md"
                loading={switching}
                disabled={!selectedWorkspace || loading}
                onClick={handleContinue}
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.15} />}
              >
                Continue
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}