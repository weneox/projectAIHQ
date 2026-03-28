import { useState } from "react";

import Badge from "../../../components/ui/Badge.jsx";
import Card from "../../../components/ui/Card.jsx";
import TruthReviewWorkbench from "../../../components/governance/TruthReviewWorkbench.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import {
  EmptyState,
  formatTimestampLabel,
  titleizeTrustAction,
} from "./trustSurfaceShared.jsx";

export default function TrustKnowledgeReviewSection({
  workbench,
  canManage,
  onApprove,
  onReject,
  onMarkForFollowUp,
  onKeepQuarantined,
  trust,
  sourceSurface,
}) {
  const [busyAction, setBusyAction] = useState("");
  const [busyId, setBusyId] = useState("");
  const trustUnavailable = trust?.unavailable === true;
  const sourceState = sourceSurface || {};
  const auditItems = Array.isArray(trust?.view?.audit) ? trust.view.audit : [];

  async function handleRunAction(item, action) {
    const actionType = String(action?.actionType || "").trim().toLowerCase();
    if (!item?.id || !actionType) return;

    setBusyId(String(item.id));
    setBusyAction(actionType);
    try {
      if (actionType === "approve") {
        await onApprove?.(item);
      } else if (actionType === "reject") {
        await onReject?.(item);
      } else if (actionType === "mark_follow_up") {
        await onMarkForFollowUp?.(item);
      } else if (actionType === "keep_quarantined") {
        await onKeepQuarantined?.(item);
      }
    } finally {
      setBusyId("");
      setBusyAction("");
    }
  }

  return (
    <SettingsSection
      eyebrow="Source Intelligence"
      title="Truth Review Workbench"
      subtitle="Source-derived truth changes are reviewed, conflicted, quarantined, approved, or rejected here before they can converge into approved truth."
      tone="default"
    >
      <div className="space-y-6">
        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
          This is the governed operator workbench for candidate truth changes. Policy outcome, required role, source trust, freshness, conflict strength, and finalize impact stay visible while you decide.
        </div>

        <SettingsSurfaceBanner
          surface={sourceState}
          unavailableMessage="Truth review telemetry is temporarily unavailable."
          refreshLabel="Refresh Workbench"
        />

        <TruthReviewWorkbench
          workbench={{
            ...(workbench || {}),
            items: Array.isArray(workbench?.items)
              ? workbench.items.map((item) => ({
                  ...item,
                  id: item.id,
                  actions: Array.isArray(item.actions)
                    ? item.actions.map((action) => ({
                        ...action,
                        allowed:
                          action.allowed !== false &&
                          !(busyId === String(item.id) && busyAction === action.actionType),
                      }))
                    : [],
                }))
              : [],
          }}
          surface={sourceState}
          canManage={canManage}
          onRunAction={handleRunAction}
        />

        <Card variant="surface" padded="md" className="rounded-[24px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Recent Trust Activity
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Review actions stay tied to the same audit trail and governance surfaces.
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
      </div>
    </SettingsSection>
  );
}
