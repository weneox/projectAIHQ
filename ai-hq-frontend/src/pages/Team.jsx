import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Crown,
  MailPlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserRound,
  Users,
  UserX,
  X,
} from "lucide-react";
import {
  createTeamUser,
  getTeam,
  updateTeamUser,
  updateTeamUserStatus,
} from "../api/team.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppIconButton from "../components/ui/AppIconButton.jsx";
import AppStatCard from "../components/ui/AppStatCard.jsx";
import {
  AppFilterAction as AppTeamFilterAction,
  AppFilterMenuShell as AppTeamFilterMenuShell,
  AppFilterOption as AppTeamFilterOption,
  AppFilterSearchInput as AppTeamFilterSearchInput,
  AppMultiSelectMenu as AppTeamMultiSelectMenu,
  AppTableHeaderFilter as AppTeamHeaderFilter,
  normalizeAppFilterList as normalizeTeamFilterList,
  toggleAppFilterListValue as toggleTeamFilterListValue,
} from "../components/ui/AppTableFilters.jsx";
import {
  AppChoiceButton as AppTeamChoiceButton,
  AppChoiceGroup as AppTeamChoiceGroup,
  AppPageField as AppTeamPageField,
  AppPageInput as AppTeamPageInput,
} from "../components/ui/AppPageField.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const PAGE_SIZE = 6;
const TABLE_MIN_WIDTH = "min-w-[1240px] w-full";
const TABLE_BODY_MIN_HEIGHT = "min-h-[348px]";
const TABLE_GRID_STYLE = {
  gridTemplateColumns:
    "280px minmax(300px,1fr) 132px 132px 190px 144px 132px",
};

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function isTeamNotConfiguredError(error) {
  const message = lower(
    error?.payload?.error ||
      error?.payload?.message ||
      error?.message ||
      error
  );

  return (
    message === "not found" ||
    message.includes("not found") ||
    message.includes("team not found") ||
    message.includes("workspace not found")
  );
}

function teamLoadErrorMessage(error) {
  if (isTeamNotConfiguredError(error)) return "";

  return (
    s(error?.payload?.message || error?.payload?.error || error?.message) ||
    "Komanda yüklənə bilmədi."
  );
}

function roleDescription(role = "") {
  const safe = lower(role);

  if (safe === "owner") {
    return "Tam giriş. Sahib hesabları qorunur və buradan deaktiv edilə bilməz.";
  }

  if (safe === "admin") {
    return "Komandanı, kanalları, ayarları və müştəri əməliyyatlarını idarə edə bilər.";
  }

  return "Gələnlər, fürsətlər, müştərilər və gündəlik müştəri işlərini idarə edə bilər.";
}
function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function roleLabel(value = "") {
  const safe = lower(value);
  if (safe === "owner") return "Sahib";
  if (safe === "admin") return "Admin";
  if (safe === "operator") return "Operator";
  return titleize(value);
}

function statusLabel(value = "") {
  const safe = lower(value);
  if (["active", "enabled"].includes(safe)) return "Aktiv";
  if (["invited", "pending"].includes(safe)) return "Dəvət edilib";
  if (["disabled", "blocked", "inactive"].includes(safe)) return "Deaktiv";
  return titleize(value);
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function userId(user = {}) {
  return s(user.id || user.user_id);
}

function userEmail(user = {}) {
  return s(user.user_email || user.email);
}

function userName(user = {}) {
  return s(
    user.full_name ||
      user.fullName ||
      user.name ||
      user.display_name ||
      userEmail(user) ||
      "Komanda üzvü"
  );
}

function userRole(user = {}) {
  return lower(user.role || "operator");
}

function userStatus(user = {}) {
  return lower(user.status || "active");
}

function userUpdatedRaw(user = {}) {
  return s(user.updated_at || user.updatedAt || user.created_at || user.createdAt);
}

function updatedTimestamp(user = {}) {
  const raw = userUpdatedRaw(user);
  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function updatedLabel(user = {}) {
  return formatWhen(userUpdatedRaw(user)) || "Naməlum";
}

function displayUserId(value = "") {
  const raw = s(value);
  if (!raw) return "—";

  const cleaned = raw;
  if (cleaned.length <= 18) return cleaned;

  return `…${cleaned.slice(-14)}`;
}





function toneForRole(role = "") {
  const safe = lower(role);
  if (safe === "owner") return "brand";
  if (safe === "admin") return "success";
  return "neutral";
}

function toneForStatus(status = "") {
  const safe = lower(status);
  if (["active", "enabled"].includes(safe)) return "success";
  if (["invited", "pending"].includes(safe)) return "warning";
  if (["disabled", "blocked", "inactive"].includes(safe)) return "danger";
  return "neutral";
}

function toneText(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-text-muted";
}

function toneDot(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function normalizeList(values = []) {
  return normalizeTeamFilterList(values);
}

function toggleListValue(values = [], value = "") {
  return toggleTeamFilterListValue(values, value);
}

function uniqueOptions(values = [], priority = [], labeler = titleize) {
  const priorityMap = new Map(priority.map((item, index) => [item, index]));
  const unique = [...new Set(values.map((value) => lower(value)).filter(Boolean))];

  return unique
    .sort((a, b) => {
      const aPriority = priorityMap.has(a) ? priorityMap.get(a) : 100;
      const bPriority = priorityMap.has(b) ? priorityMap.get(b) : 100;

      if (aPriority !== bPriority) return aPriority - bPriority;

      return titleize(a).localeCompare(titleize(b));
    })
    .map((value) => ({ value, label: labeler(value) }));
}

function countActiveFilters(filters = {}) {
  return [
    s(filters.member),
    s(filters.email),
    s(filters.userId),
    normalizeList(filters.roles).length ? "roles" : "",
    normalizeList(filters.statuses).length ? "statuses" : "",
    normalizeList(filters.updatedDates).length ? "updatedDates" : "",
    s(filters.updatedSort),
  ].filter(Boolean).length;
}

function createDefaultFilters() {
  return {
    member: "",
    email: "",
    userId: "",
    roles: [],
    statuses: [],
    updatedDates: [],
    updatedSort: "",
  };
}

function MemberIdentityBadge({ role = "" }) {
  const owner = lower(role) === "owner";

  return (
    <span className="flex w-8 shrink-0 items-center justify-center">
      {owner ? (
        <Crown
          className="h-[22px] w-[22px] text-brand drop-shadow-[0_2px_10px_rgba(37,99,235,0.2)]"
          strokeWidth={2.1}
        />
      ) : (
        <UserRound
          className="h-[22px] w-[22px] text-text-muted"
          strokeWidth={2.05}
        />
      )}
    </span>
  );
}

function StatusText({ tone = "neutral", children }) {
  return (
    <span
      className={cx(
        "inline-flex min-w-[82px] items-center gap-2 text-[12.5px] font-semibold",
        toneText(tone)
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-md", toneDot(tone))} />
      {children}
    </span>
  );
}

function RoleText({ role = "" }) {
  return (
    <span
      title={roleDescription(role)}
      className={cx(
        "inline-flex min-w-[82px] items-center text-[12.5px] font-semibold",
        toneText(toneForRole(role))
      )}
    >
      {roleLabel(role)}
    </span>
  );
}

function EmptyState({ onAddMember, canManage, filtered = false }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[560px]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] border border-line-soft bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F8FB_100%)] text-text-muted shadow-[0_22px_48px_-38px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.94)]">
          <Users className="h-8 w-8" strokeWidth={1.9} />
        </div>

        <h2 className="mt-5 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          {filtered ? "Uyğun üzv tapılmadı" : "Hələ komanda üzvü yoxdur"}
        </h2>

        <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          {filtered
            ? "Cari filtrlərə uyğun üzv yoxdur."
            : "Gələnlər, fürsətlər, müştərilər, kanallar və workspace ayarlarında kömək edəcək komanda üzvlərini əlavə edin."}
        </p>

        <div className="mt-5 rounded-md border border-line-soft bg-surface-subtle px-4 py-3 text-left">
          <div className="text-[13px] font-semibold text-text">
            Rol bələdçisi
          </div>
          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            Sahiblərdə tam giriş var. Adminlər qurulumu və komanda üzvlərini idarə edir. Operatorlar gündəlik müştəri söhbətlərini aparır.
          </div>
        </div>

        {canManage && !filtered ? (
          <div className="mt-5 flex justify-center">
            <Button
              type="button"
              onClick={onAddMember}
              leftIcon={<Plus className="h-4 w-4" strokeWidth={2.1} />}
            >
              İlk üzvü əlavə et
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HeaderFilter(props) {
  return <AppTeamHeaderFilter {...props} />;
}

function FilterMenuShell(props) {
  return <AppTeamFilterMenuShell {...props} />;
}

function FilterSearchInput(props) {
  return <AppTeamFilterSearchInput {...props} />;
}

function FilterOption(props) {
  return <AppTeamFilterOption {...props} />;
}

function FilterAction(props) {
  return <AppTeamFilterAction {...props} />;
}

function MultiSelectMenu(props) {
  return <AppTeamMultiSelectMenu {...props} />;
}

function UpdatedMenu({
  options,
  selectedValues,
  sortValue,
  onToggleDate,
  onSetSort,
  onClear,
}) {
  const selected = normalizeList(selectedValues);

  return (
    <FilterMenuShell>
      <FilterAction onClick={onClear} disabled={!selected.length && !sortValue}>
        Yenilənmə filtrini təmizlə
      </FilterAction>

      <div className="my-1 h-px bg-line-soft" />

      <FilterOption
        selected={sortValue === "newest"}
        onClick={() => onSetSort(sortValue === "newest" ? "" : "newest")}
      >
        Ən yenilər əvvəl
      </FilterOption>
      <FilterOption
        selected={sortValue === "oldest"}
        onClick={() => onSetSort(sortValue === "oldest" ? "" : "oldest")}
      >
        Ən köhnələr əvvəl
      </FilterOption>

      {arr(options).length ? <div className="my-1 h-px bg-line-soft" /> : null}

      {arr(options).map((option) => (
        <FilterOption
          key={option.value}
          selected={selected.includes(option.value)}
          onClick={() => onToggleDate(option.value)}
        >
          {option.label}
        </FilterOption>
      ))}
    </FilterMenuShell>
  );
}

function TeamRow({ user, busyId, canManage, onToggleStatus, onEdit }) {
  const id = userId(user);
  const email = userEmail(user);
  const role = userRole(user);
  const status = userStatus(user);
  const active = ["active", "enabled"].includes(status);
  const owner = role === "owner";
  const busy = busyId === id;
  const updated = updatedLabel(user);

  return (
    <div
      className={cx(
        "team-member-row grid min-h-[58px]",
        TABLE_MIN_WIDTH,
        "items-center gap-0 px-0 transition-colors duration-base ease-premium hover:bg-surface-subtle/55"
      )}
      style={TABLE_GRID_STYLE}
    >
      <div className="flex min-w-0 items-center gap-3.5 px-4">
        <MemberIdentityBadge role={role} />

        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {userName(user)}
          </div>
        </div>
      </div>

      <div className="min-w-0 px-4">
        <div className="truncate text-[13px] font-medium text-text-muted">
          {email || "Email əlavə edilməyib"}
        </div>
      </div>

      <div className="min-w-0 px-4">
        <RoleText role={role} />
      </div>

      <div className="min-w-0 px-4">
        <StatusText tone={toneForStatus(status)}>{statusLabel(status)}</StatusText>
      </div>

      <div className="min-w-0 px-4">
        <div
          title={id || ""}
          className="truncate text-[12.5px] font-semibold text-text-muted"
        >
          {displayUserId(id)}
        </div>
      </div>

      <div className="px-4 text-[12.5px] font-medium text-text-subtle">
        {updated || "—"}
      </div>

      <div className="flex items-center justify-end gap-2 px-4">
        {canManage && !owner ? (
          <Button
            type="button"
            size="sm"
            variant={active ? "danger" : "secondary"}
            loading={busy}
            disabled={!id || busy}
            className="min-w-[74px]"
            onClick={() => onToggleStatus(user)}
          >
            {active ? "Deaktiv et" : "Aktiv et"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled
            className="min-w-[74px]"
          >
            Sahib
          </Button>
        )}

        <AppIconButton
          disabled={!canManage || !id}
          onClick={() => onEdit(user)}
          label="Üzvü redaktə et"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.1} />
        </AppIconButton>
      </div>
    </div>
  );
}

function PaginationFooter({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  filtered = false,
  onPageChange,
}) {
  const from = totalItems ? (currentPage - 1) * pageSize + 1 : 0;
  const to = Math.min(totalItems, currentPage * pageSize);

  return (
    <div
      className={cx(
        "flex items-center justify-between border-t border-line-soft px-4 py-2.5",
        TABLE_MIN_WIDTH
      )}
    >
      <div className="text-[12px] font-medium text-text-muted">
        Göstərilir <span className="font-semibold text-text">{from}</span>-
        <span className="font-semibold text-text">{to}</span> /{" "}
        <span className="font-semibold text-text">{totalItems}</span>
        {filtered ? <span className="text-text-subtle"> filtrli</span> : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-[12px] font-semibold text-text transition-colors duration-base ease-premium hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-45"
        >
          Əvvəlki
        </button>

        <div className="inline-flex h-8 min-w-[54px] items-center justify-center rounded-md border border-line-soft bg-surface-subtle px-2 text-[12px] font-semibold text-text-muted">
          {currentPage} / {totalPages}
        </div>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-[12px] font-semibold text-text transition-colors duration-base ease-premium hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-45"
        >
          Növbəti
        </button>
      </div>
    </div>
  );
}

function FieldInput(props) {
  return <AppTeamPageField {...props} />;
}

function SoftInput(props) {
  return <AppTeamPageInput {...props} />;
}

function ChoiceButton(props) {
  return <AppTeamChoiceButton {...props} />;
}

function ChoiceGroup(props) {
  return <AppTeamChoiceGroup {...props} />;
}

function AddMemberForm({ canManage, invite, setInvite, busy, onSubmit }) {
  return (
    <form onSubmit={onSubmit} autoComplete="off" className="grid gap-5">
      <FieldInput label="Email">
        <SoftInput
          value={invite.email}
          onChange={(event) =>
            setInvite((current) => ({ ...current, email: event.target.value }))
          }
          placeholder="operator@company.com"
          disabled={!canManage}
          autoComplete="new-password"
          name="team_invite_contact_entry"
        />
      </FieldInput>

      <FieldInput label="Ad">
        <SoftInput
          value={invite.fullName}
          onChange={(event) =>
            setInvite((current) => ({
              ...current,
              fullName: event.target.value,
            }))
          }
          placeholder="İstəyə bağlı"
          disabled={!canManage}
          autoComplete="new-password"
          name="team_invite_display_entry"
        />
      </FieldInput>

      <ChoiceGroup
        label="Rol"
        value={invite.role}
        disabled={!canManage}
        options={[
          { value: "operator", label: "Operator" },
          { value: "admin", label: "Admin" },
        ]}
        onChange={(value) =>
          setInvite((current) => ({ ...current, role: value }))
        }
      />

      <div className="pt-1">
        <Button
          type="submit"
          fullWidth
          disabled={!canManage}
          loading={busy}
          leftIcon={
            !busy ? <Plus className="h-4 w-4" strokeWidth={2.1} /> : undefined
          }
        >
          Üzv əlavə et
        </Button>
      </div>

      {!canManage ? (
        <Card padded={false} clip>
          <div className="px-3 py-3 text-[12.5px] font-medium leading-5 text-text-muted">
            Komanda üzvlərini yalnız sahib və adminlər əlavə edə və yeniləyə bilər.
          </div>
        </Card>
      ) : null}
    </form>
  );
}

function EditMemberForm({ canManage, edit, setEdit, busy, onSubmit }) {
  const owner = edit.role === "owner";

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="grid gap-5">
      <FieldInput label="Ad">
        <SoftInput
          value={edit.fullName}
          onChange={(event) =>
            setEdit((current) => ({
              ...current,
              fullName: event.target.value,
            }))
          }
          placeholder="Tam ad"
          disabled={!canManage}
          autoComplete="new-password"
          name="team_edit_display_entry"
        />
      </FieldInput>

      <FieldInput label="Email">
        <SoftInput
          value={edit.email}
          onChange={(event) =>
            setEdit((current) => ({
              ...current,
              email: event.target.value,
            }))
          }
          placeholder="email@company.com"
          disabled={!canManage}
          autoComplete="new-password"
          name="team_edit_contact_entry"
        />
      </FieldInput>

      <ChoiceGroup
        label="Rol"
        value={edit.role}
        disabled={!canManage || owner}
        options={[
          { value: "owner", label: "Sahib" },
          { value: "admin", label: "Admin" },
          { value: "operator", label: "Operator" },
        ]}
        onChange={(value) =>
          setEdit((current) => ({
            ...current,
            role: value,
          }))
        }
      />

      <ChoiceGroup
        label="Status"
        value={edit.status}
        disabled={!canManage || owner}
        options={[
          { value: "active", label: "Aktiv" },
          { value: "invited", label: "Dəvət edilib" },
          { value: "disabled", label: "Deaktiv" },
        ]}
        onChange={(value) =>
          setEdit((current) => ({
            ...current,
            status: value,
          }))
        }
      />

      <div className="pt-1">
        <Button type="submit" fullWidth disabled={!canManage} loading={busy}>
          Dəyişiklikləri saxla
        </Button>
      </div>
    </form>
  );
}

function CenterModal({ open, title, description, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
      <style>
        {`
          @keyframes teamModalIn {
            from {
              opacity: 0;
              transform: translate3d(0, 10px, 0) scale(0.985);
            }
            to {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1);
            }
          }
        `}
      </style>

      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-[rgba(15,23,42,0.46)] backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[520px]"
        style={{
          animation: "teamModalIn 160ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "opacity, transform",
        }}
      >
        <Card
          padded={false}
          clip
          className="max-h-[calc(100vh-48px)] overflow-hidden border border-white/70 shadow-[0_34px_90px_-54px_rgba(15,23,42,0.86)]"
        >
          <div className="flex max-h-[calc(100vh-48px)] flex-col">
            <div className="border-b border-line-soft px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                    {title}
                  </div>
                  <p className="mt-1 max-w-[390px] text-[12.5px] font-medium leading-5 text-text-muted">
                    {description}
                  </p>
                </div>

                <AppIconButton onClick={onClose} label="Close panel">
                  <X className="h-4 w-4" strokeWidth={2.1} />
                </AppIconButton>
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-5">{children}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Team() {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    users: [],
    viewerRole: "",
  });
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openFilter, setOpenFilter] = useState("");
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [edit, setEdit] = useState({
    id: "",
    email: "",
    fullName: "",
    role: "operator",
    status: "active",
  });
  const [invite, setInvite] = useState({
    email: "",
    fullName: "",
    role: "operator",
  });

  const load = useCallback(async ({ refreshing = false } = {}) => {
    setState((current) => ({
      ...current,
      loading: !refreshing,
      refreshing,
      error: "",
    }));

    try {
      const payload = await getTeam();

      setState({
        loading: false,
        refreshing: false,
        error: "",
        users: arr(payload?.users),
        viewerRole: lower(payload?.viewerRole || ""),
      });
    } catch (error) {
      const safeError = teamLoadErrorMessage(error);

      setState({
        loading: false,
        refreshing: false,
        error: safeError,
        users: [],
        viewerRole: isTeamNotConfiguredError(error) ? "owner" : "",
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const modalOpen = showAddMember || Boolean(editingUser);
    if (!modalOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setShowAddMember(false);
        setEditingUser(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAddMember, editingUser]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpenFilter("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const canManage = useMemo(
    () => ["owner", "admin"].includes(lower(state.viewerRole)),
    [state.viewerRole]
  );

  const stats = useMemo(() => {
    const users = arr(state.users);

    const total = users.length;
    const active = users.filter((user) =>
      ["active", "enabled"].includes(userStatus(user))
    ).length;
    const invited = users.filter((user) =>
      ["invited", "pending"].includes(userStatus(user))
    ).length;
    const disabled = users.filter((user) =>
      ["disabled", "blocked", "inactive"].includes(userStatus(user))
    ).length;

    return {
      total,
      active,
      invited,
      disabled,
    };
  }, [state.users]);

  const filterOptions = useMemo(() => {
    const users = arr(state.users);
    const updatedDateValues = [
      ...new Set(users.map((user) => updatedLabel(user)).filter(Boolean)),
    ];

    return {
      roles: uniqueOptions(
        users.map((user) => userRole(user)),
        ["owner", "admin", "operator"],
        roleLabel
      ),
      statuses: uniqueOptions(
        users.map((user) => userStatus(user)),
        ["active", "invited", "disabled"],
        statusLabel
      ),
      updatedDates: updatedDateValues
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value: lower(value), label: value })),
    };
  }, [state.users]);

  const activeFilterCount = countActiveFilters(filters);
  const hasActiveFilters = activeFilterCount > 0;

  const filteredUsers = useMemo(() => {
    const safeFilters = {
      ...filters,
      roles: normalizeList(filters.roles),
      statuses: normalizeList(filters.statuses),
      updatedDates: normalizeList(filters.updatedDates),
    };

    const memberQuery = lower(safeFilters.member);
    const emailQuery = lower(safeFilters.email);
    const userIdQuery = lower(safeFilters.userId);

    const users = arr(state.users).filter((user) => {
      const id = userId(user);
      const member = userName(user);
      const email = userEmail(user);
      const role = userRole(user);
      const status = userStatus(user);
      const updated = lower(updatedLabel(user));

      if (memberQuery && !lower(member).includes(memberQuery)) return false;
      if (emailQuery && !lower(email).includes(emailQuery)) return false;
      if (userIdQuery && !lower(id).includes(userIdQuery)) return false;

      if (safeFilters.roles.length && !safeFilters.roles.includes(role)) {
        return false;
      }

      if (
        safeFilters.statuses.length &&
        !safeFilters.statuses.includes(status)
      ) {
        return false;
      }

      if (
        safeFilters.updatedDates.length &&
        !safeFilters.updatedDates.includes(updated)
      ) {
        return false;
      }

      return true;
    });

    if (filters.updatedSort === "newest") {
      return [...users].sort((a, b) => updatedTimestamp(b) - updatedTimestamp(a));
    }

    if (filters.updatedSort === "oldest") {
      return [...users].sort((a, b) => updatedTimestamp(a) - updatedTimestamp(b));
    }

    return users;
  }, [filters, state.users]);

  const totalUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const shouldPaginate = totalUsers > PAGE_SIZE;

  const visibleUsers = useMemo(() => {
    if (!shouldPaginate) return filteredUsers;

    const pageStart = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(pageStart, pageStart + PAGE_SIZE);
  }, [currentPage, filteredUsers, shouldPaginate]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  function updateFilters(updater) {
    setFilters((current) =>
      typeof updater === "function" ? updater(current) : updater
    );
  }

  function clearFilters() {
    setFilters(createDefaultFilters());
    setOpenFilter("");
  }

  function openEditUser(user) {
    setEditingUser(user);
    setEdit({
      id: userId(user),
      email: userEmail(user),
      fullName: userName(user),
      role: userRole(user),
      status: userStatus(user),
    });
  }

  function _updateLocalUserStatus(id, nextStatus) {
    setState((current) => ({
      ...current,
      users: arr(current.users).map((user) =>
        userId(user) === id
          ? {
              ...user,
              status: nextStatus,
              updated_at: new Date().toISOString(),
            }
          : user
      ),
    }));
  }

  async function handleInvite(event) {
    event?.preventDefault?.();

    const email = s(invite.email).toLowerCase();

    if (!email) {
      setNotice({
        tone: "danger",
        title: "Email lazımdır",
        description: "Komanda üzvü əlavə etməzdən əvvəl email daxil edin.",
      });
      return;
    }

    try {
      setBusyId("invite");
      setNotice(null);

      await createTeamUser({
        user_email: email,
        full_name: s(invite.fullName),
        role: s(invite.role, "operator"),
        status: "active",
      });

      setNotice({
        tone: "success",
        title: "Komanda üzvü əlavə edildi",
        description: "Workspace giriş siyahısı yeniləndi.",
      });

      setInvite({
        email: "",
        fullName: "",
        role: "operator",
      });

      setShowAddMember(false);
      await load({ refreshing: true });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Üzv əlavə edilə bilmədi",
        description:
          s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "İcazələri yoxlayın və yenidən cəhd edin.",
      });
    } finally {
      setBusyId("");
    }
  }

  async function handleToggleStatus(user) {
    const id = userId(user);
    if (!id || busyId) return;

    const nextStatus = ["active", "enabled"].includes(userStatus(user))
      ? "disabled"
      : "active";

    try {
      setBusyId(id);
      setNotice(null);

      
        await updateTeamUserStatus(id, nextStatus);
        await load({ refreshing: true });
      

      setNotice({
        tone: "success",
        title: "Komanda üzvü yeniləndi",
        description: `Status ${statusLabel(nextStatus)} olaraq dəyişdi.`,
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Üzv yenilənə bilmədi",
        description:
          s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "İcazələri yoxlayın və yenidən cəhd edin.",
      });
    } finally {
      setBusyId("");
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();

    const id = s(edit.id);
    const email = s(edit.email);
    const fullName = s(edit.fullName);
    const role = lower(edit.role || "operator");
    const status = lower(edit.status || "active");

    if (!id) {
      setNotice({
        tone: "danger",
        title: "Üzv seçilməyib",
        description: "Dəyişiklikləri saxlamazdan əvvəl komanda üzvü seçin.",
      });
      return;
    }

    if (!email) {
      setNotice({
        tone: "danger",
        title: "Email lazımdır",
        description: "Komanda üzvünün emaili lazımdır.",
      });
      return;
    }

    setBusyId(id);
    setNotice(null);

    try {
      await updateTeamUser(id, {
        user_email: email,
        full_name: fullName,
        role,
        status,
      });

      setNotice({
        tone: "success",
        title: "Üzv yeniləndi",
        description: "Komanda üzvü dəyişiklikləri saxlanıldı.",
      });

      setEditingUser(null);
      await load({ refreshing: true });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Yeniləmə alınmadı",
        description:
          s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Komanda üzvü yenilənə bilmədi.",
      });
    } finally {
      setBusyId("");
    }
  }

  if (state.loading) {
    return (
      <PageCanvas>
        <LoadingSurface title="Komanda yüklənir" />
      </PageCanvas>
    );
  }

  return (
    <>
      <style>
        {`
          .team-page-scope input,
          .team-page-scope button {
            -webkit-tap-highlight-color: transparent;
          }

          .team-page-scope input:focus,
          .team-page-scope input:focus-visible {
            outline: none !important;
            box-shadow: none !important;
          }

          .team-soft-control,
          .team-filter-control {
            box-shadow:
              inset 0 0 0 1px rgba(203, 213, 225, 0.9),
              inset 0 1px 0 rgba(255, 255, 255, 0.82),
              0 1px 2px rgba(15, 23, 42, 0.035);
          }

          .team-soft-control:focus-within,
          .team-filter-control:focus-within {
            background: #ffffff;
            box-shadow:
              inset 0 0 0 2px rgba(37, 99, 235, 0.68),
              inset 0 1px 0 rgba(255, 255, 255, 0.92),
              0 1px 2px rgba(15, 23, 42, 0.045);
          }

          /* === team-solid-zebra:start === */
          .team-table-head {
            background: #f2f5f9;
            box-shadow: inset 0 -1px 0 #d8e0ea;
          }

          .team-member-row {
            background: #ffffff;
          }

          .team-member-row:nth-child(even) {
            background: #f6f8fb;
          }

          .team-member-row:hover {
            background: #edf2f8;
          }
          /* === team-solid-zebra:end === */
          .team-page-scope input:-webkit-autofill,
          .team-page-scope input:-webkit-autofill:hover,
          .team-page-scope input:-webkit-autofill:focus,
          .team-page-scope input:-webkit-autofill:active {
            -webkit-text-fill-color: rgb(15, 23, 42) !important;
            caret-color: rgb(15, 23, 42) !important;
            box-shadow: 0 0 0 1000px #ffffff inset !important;
            -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
            transition: background-color 999999s ease-in-out 0s !important;
          }
        `}
      </style>

      <div className="team-page-scope">
        <PageCanvas>
          {state.error ? (
            <InlineNotice
              tone="danger"
              title="Komanda yüklənə bilmədi"
              description={state.error}
              compact
            />
          ) : null}

          {notice ? (
            <InlineNotice
              tone={notice.tone}
              title={notice.title}
              description={notice.description}
              compact
            />
          ) : null}

          <section className="space-y-5">
            <PageHeader
              title="Komanda üzvləri"
              description="Komanda üzvlərini dəvət edin, rollarını seçin və müştəri söhbətlərini kimin idarə edəcəyini nəzarətdə saxlayın."
              actions={
                <>
                  <Button
                    type="button"
                    onClick={() => setShowAddMember(true)}
                    disabled={!canManage}
                    leftIcon={<Plus className="h-4 w-4" strokeWidth={2.1} />}
                  >
                    Üzv əlavə et
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    loading={state.refreshing}
                    onClick={() => load({ refreshing: true })}
                    leftIcon={
                      !state.refreshing ? (
                        <RefreshCw className="h-4 w-4" strokeWidth={2.1} />
                      ) : undefined
                    }
                  >
                    Yenilə
                  </Button>
                </>
              }
            />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AppStatCard
                icon={<Users className="h-[30px] w-[30px]" strokeWidth={1.85} />}
                label="Bütün üzvlər"
                value={stats.total}
              />
              <AppStatCard
                icon={
                  <UserCheck className="h-[30px] w-[30px]" strokeWidth={1.85} />
                }
                label="Aktiv üzvlər"
                value={stats.active}
              />
              <AppStatCard
                icon={
                  <MailPlus className="h-[30px] w-[30px]" strokeWidth={1.85} />
                }
                label="Dəvət edilənlər"
                value={stats.invited}
              />
              <AppStatCard
                icon={<UserX className="h-[30px] w-[30px]" strokeWidth={1.85} />}
                label="Deaktiv üzvlər"
                value={stats.disabled}
              />
            </div>

            <Card padded={false} className="overflow-visible">
              {arr(state.users).length ? (
                <div className="relative overflow-visible">
                  <div className={TABLE_MIN_WIDTH}>
                    <div className="team-table-head relative z-20 border-b border-line-soft px-0 py-2">
                      <div
                        className={cx(
                          "grid",
                          TABLE_MIN_WIDTH,
                          "items-center gap-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle"
                        )}
                        style={TABLE_GRID_STYLE}
                      >
                        <HeaderFilter
                          id="member"
                          label="Üzv"
                          openFilter={openFilter}
                          active={Boolean(s(filters.member))}
                          onOpen={setOpenFilter}
                        >
                          <FilterSearchInput
                            value={filters.member}
                            onChange={(value) =>
                              updateFilters((current) => ({
                                ...current,
                                member: value,
                              }))
                            }
                            placeholder="Üzv axtar"
                          />
                        </HeaderFilter>

                        <HeaderFilter
                          id="email"
                          label="Email"
                          openFilter={openFilter}
                          active={Boolean(s(filters.email))}
                          onOpen={setOpenFilter}
                        >
                          <FilterSearchInput
                            value={filters.email}
                            onChange={(value) =>
                              updateFilters((current) => ({
                                ...current,
                                email: value,
                              }))
                            }
                            placeholder="Email axtar"
                          />
                        </HeaderFilter>

                        <HeaderFilter
                          id="role"
                          label="Rol"
                          openFilter={openFilter}
                          active={normalizeList(filters.roles).length > 0}
                          onOpen={setOpenFilter}
                        >
                          <MultiSelectMenu
                            allLabel="Bütün rollar"
                            options={filterOptions.roles}
                            selectedValues={filters.roles}
                            onToggle={(value) =>
                              updateFilters((current) => ({
                                ...current,
                                roles: toggleListValue(current.roles, value),
                              }))
                            }
                            onClear={() =>
                              updateFilters((current) => ({
                                ...current,
                                roles: [],
                              }))
                            }
                          />
                        </HeaderFilter>

                        <HeaderFilter
                          id="status"
                          label="Status"
                          openFilter={openFilter}
                          active={normalizeList(filters.statuses).length > 0}
                          onOpen={setOpenFilter}
                        >
                          <MultiSelectMenu
                            allLabel="Bütün statuslar"
                            options={filterOptions.statuses}
                            selectedValues={filters.statuses}
                            onToggle={(value) =>
                              updateFilters((current) => ({
                                ...current,
                                statuses: toggleListValue(current.statuses, value),
                              }))
                            }
                            onClear={() =>
                              updateFilters((current) => ({
                                ...current,
                                statuses: [],
                              }))
                            }
                          />
                        </HeaderFilter>

                        <HeaderFilter
                          id="userId"
                          label="Üzv ID"
                          openFilter={openFilter}
                          active={Boolean(s(filters.userId))}
                          onOpen={setOpenFilter}
                        >
                          <FilterSearchInput
                            value={filters.userId}
                            onChange={(value) =>
                              updateFilters((current) => ({
                                ...current,
                                userId: value,
                              }))
                            }
                            placeholder="ID axtar"
                          />
                        </HeaderFilter>

                        <HeaderFilter
                          id="updated"
                          label="Yenilənmə"
                          openFilter={openFilter}
                          active={
                            normalizeList(filters.updatedDates).length > 0 ||
                            Boolean(filters.updatedSort)
                          }
                          onOpen={setOpenFilter}
                          align="right"
                        >
                          <UpdatedMenu
                            options={filterOptions.updatedDates}
                            selectedValues={filters.updatedDates}
                            sortValue={filters.updatedSort}
                            onToggleDate={(value) =>
                              updateFilters((current) => ({
                                ...current,
                                updatedDates: toggleListValue(
                                  current.updatedDates,
                                  value
                                ),
                              }))
                            }
                            onSetSort={(value) =>
                              updateFilters((current) => ({
                                ...current,
                                updatedSort: value,
                              }))
                            }
                            onClear={() =>
                              updateFilters((current) => ({
                                ...current,
                                updatedDates: [],
                                updatedSort: "",
                              }))
                            }
                          />
                        </HeaderFilter>

                        <div className="flex h-8 items-center justify-end px-4">
                          {hasActiveFilters ? (
                            <button
                              type="button"
                              onClick={clearFilters}
                              className="inline-flex h-7 items-center justify-center rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand transition-colors duration-base ease-premium hover:bg-brand/5"
                            >
                              Təmizlə {activeFilterCount}
                            </button>
                          ) : (
                            <span className="px-2 text-right">Əməliyyat</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {filteredUsers.length ? (
                      <div
                        className={cx(
                          "relative z-10 divide-y divide-line-soft",
                          TABLE_BODY_MIN_HEIGHT
                        )}
                      >
                        {visibleUsers.map((user) => (
                          <TeamRow
                            key={userId(user) || userEmail(user)}
                            user={user}
                            busyId={busyId}
                            canManage={canManage}
                            onToggleStatus={handleToggleStatus}
                            onEdit={openEditUser}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className={TABLE_BODY_MIN_HEIGHT}>
                        <EmptyState filtered canManage={canManage} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState
                  canManage={canManage}
                  onAddMember={() => setShowAddMember(true)}
                />
              )}
            </Card>

            {shouldPaginate ? (
              <div className="overflow-x-auto">
                <PaginationFooter
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalUsers}
                  pageSize={PAGE_SIZE}
                  filtered={hasActiveFilters}
                  onPageChange={setCurrentPage}
                />
              </div>
            ) : null}
          </section>
        </PageCanvas>

        <CenterModal
          open={showAddMember}
          title="Üzv əlavə et"
          description="Bu workspace-ə giriş vermək və əməliyyatlarda kömək etmək üçün komanda üzvü dəvət edin."
          onClose={() => setShowAddMember(false)}
        >
          <AddMemberForm
            canManage={canManage}
            invite={invite}
            setInvite={setInvite}
            busy={busyId === "invite"}
            onSubmit={handleInvite}
          />
        </CenterModal>

        <CenterModal
          open={Boolean(editingUser)}
          title="Üzvü redaktə et"
          description="Üzv məlumatlarını, rolunu və cari giriş statusunu yeniləyin."
          onClose={() => setEditingUser(null)}
        >
          <EditMemberForm
            canManage={canManage}
            edit={edit}
            setEdit={setEdit}
            busy={busyId === `edit:${edit.id}`}
            onSubmit={handleEditSubmit}
          />
        </CenterModal>
      </div>
    </>
  );
}
