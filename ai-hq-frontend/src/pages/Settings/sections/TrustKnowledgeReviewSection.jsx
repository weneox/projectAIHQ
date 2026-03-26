import { useState } from "react";

import Card from "../../../components/ui/Card.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import {
  EmptyState,
  KnowledgeCandidateCard,
  StatTile,
  formatTimestampLabel,
  titleizeTrustAction,
} from "./trustSurfaceShared.jsx";

export default function TrustKnowledgeReviewSection({
  items,
  canManage,
  onApprove,
  onReject,
  trust,
  sourceSurface,
}) {
  const [busyId, setBusyId] = useState("");
  const [busyAction, setBusyAction] = useState("");

  async function handleApprove(item) {
    setBusyId(String(item.id || ""));
    setBusyAction("approve");
    try {
      await onApprove(item);
    } finally {
      setBusyId("");
      setBusyAction("");
    }
  }

  async function handleReject(item) {
    setBusyId(String(item.id || ""));
    setBusyAction("reject");
    try {
      await onReject(item);
    } finally {
      setBusyId("");
      setBusyAction("");
    }
  }

  const conflictCount = items.filter((x) => String(x.status).toLowerCase() === "conflict").length;
  const trustUnavailable = trust?.unavailable === true;
  const sourceState = sourceSurface || {};
  const auditItems = Array.isArray(trust?.view?.audit) ? trust.view.audit : [];

  return (
    <SettingsSection
      eyebrow="Source Intelligence"
      title="Knowledge Review"
      subtitle="Candidates from source sync and source evidence land here before they can influence approved truth."
      tone="default"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile
            label="Pending Items"
            value={items.length}
            hint="Evidence-backed candidates waiting for review"
            tone="info"
          />
          <StatTile
            label="Conflicts"
            value={conflictCount}
            hint="Candidates that need closer human judgment"
            tone={conflictCount > 0 ? "warn" : "neutral"}
          />
          <StatTile
            label="Truth Protection"
            value="Review Required"
            hint="Sync never auto-promotes evidence into approved truth"
            tone="success"
          />
        </div>

        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
          Approve a candidate only when the source evidence is strong enough to move it forward in the truth-maintenance workflow. Rejecting leaves approved truth unchanged.
        </div>

        <SettingsSurfaceBanner
          surface={sourceState}
          unavailableMessage="Knowledge review source intelligence is temporarily unavailable."
          refreshLabel="Refresh Review"
        />

        <Card variant="surface" padded="md" className="rounded-[24px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Recent Trust Activity
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Minimal audit trail for source, review, and truth-governance actions.
                </div>
              </div>
              {trustUnavailable ? (
                <Badge tone="warn" variant="subtle" dot>
                  Unavailable
                </Badge>
              ) : null}
            </div>

            {!auditItems.length ? (
              <EmptyState
                title="No recent trust activity"
                subtitle={
                  trustUnavailable
                    ? "Audit signals are temporarily unavailable."
                    : "Recent source, review, and truth actions will appear here."
                }
              />
            ) : (
              <div className="space-y-3">
                {auditItems.slice(0, 6).map((entry) => (
                  <div
                    key={entry.id || `${entry.action || "action"}-${entry.createdAt || ""}`}
                    className="flex flex-col gap-2 rounded-[18px] border border-slate-200/80 px-4 py-3 dark:border-white/10"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info" variant="subtle" dot>
                        {titleizeTrustAction(entry.action)}
                      </Badge>
                      <Badge tone="neutral" variant="subtle" dot>
                        {entry.actor || "system"}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {formatTimestampLabel(entry.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {!items.length ? (
          <EmptyState
            title="No review items waiting"
            subtitle="When source sync surfaces candidate changes that may affect approved truth, they will appear here for review."
          />
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <KnowledgeCandidateCard
                key={item.id}
                item={item}
                canManage={canManage}
                busyApprove={busyId === String(item.id) && busyAction === "approve"}
                busyReject={busyId === String(item.id) && busyAction === "reject"}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
