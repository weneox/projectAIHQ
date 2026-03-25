import { useEffect, useState } from "react";
import { ListTree } from "lucide-react";

import Button from "../../../components/ui/Button.jsx";
import Card from "../../../components/ui/Card.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import {
  EmptyState,
  FeatureToggleCard,
  Field,
  Input,
  RowActions,
  Select,
} from "./SectionPrimitives.jsx";

function ChannelPolicyCard({ item, canManage, onSave, onDelete, saving, deleting }) {
  const [local, setLocal] = useState({
    id: item?.id || "",
    channel: item?.channel || "instagram",
    subchannel: item?.subchannel || "default",
    enabled: typeof item?.enabled === "boolean" ? item.enabled : true,
    auto_reply_enabled:
      typeof item?.auto_reply_enabled === "boolean" ? item.auto_reply_enabled : true,
    ai_reply_enabled:
      typeof item?.ai_reply_enabled === "boolean" ? item.ai_reply_enabled : true,
    human_handoff_enabled:
      typeof item?.human_handoff_enabled === "boolean" ? item.human_handoff_enabled : true,
    pricing_visibility: item?.pricing_visibility || "inherit",
    public_reply_mode: item?.public_reply_mode || "inherit",
    contact_capture_mode: item?.contact_capture_mode || "inherit",
    escalation_mode: item?.escalation_mode || "inherit",
    reply_style: item?.reply_style || "",
    max_reply_sentences: item?.max_reply_sentences ?? 2,
  });

  useEffect(() => {
    setLocal({
      id: item?.id || "",
      channel: item?.channel || "instagram",
      subchannel: item?.subchannel || "default",
      enabled: typeof item?.enabled === "boolean" ? item.enabled : true,
      auto_reply_enabled:
        typeof item?.auto_reply_enabled === "boolean" ? item.auto_reply_enabled : true,
      ai_reply_enabled:
        typeof item?.ai_reply_enabled === "boolean" ? item.ai_reply_enabled : true,
      human_handoff_enabled:
        typeof item?.human_handoff_enabled === "boolean" ? item.human_handoff_enabled : true,
      pricing_visibility: item?.pricing_visibility || "inherit",
      public_reply_mode: item?.public_reply_mode || "inherit",
      contact_capture_mode: item?.contact_capture_mode || "inherit",
      escalation_mode: item?.escalation_mode || "inherit",
      reply_style: item?.reply_style || "",
      max_reply_sentences: item?.max_reply_sentences ?? 2,
    });
  }, [item]);

  function patch(key, value) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card variant="surface" padded="lg" className="rounded-[28px]">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Channel" hint="instagram / whatsapp / facebook / comments">
          <Input
            value={local.channel}
            disabled={!canManage}
            onChange={(e) => patch("channel", e.target.value)}
            placeholder="instagram"
          />
        </Field>

        <Field label="Subchannel" hint="default, dm, comments və s.">
          <Input
            value={local.subchannel}
            disabled={!canManage}
            onChange={(e) => patch("subchannel", e.target.value)}
            placeholder="default"
          />
        </Field>

        <Field label="Pricing Visibility">
          <Select
            value={local.pricing_visibility}
            disabled={!canManage}
            onChange={(e) => patch("pricing_visibility", e.target.value)}
          >
            <option value="inherit">inherit</option>
            <option value="hidden">hidden</option>
            <option value="allowed">allowed</option>
            <option value="redirect_to_dm">redirect_to_dm</option>
            <option value="quote_only">quote_only</option>
          </Select>
        </Field>

        <Field label="Public Reply Mode">
          <Select
            value={local.public_reply_mode}
            disabled={!canManage}
            onChange={(e) => patch("public_reply_mode", e.target.value)}
          >
            <option value="inherit">inherit</option>
            <option value="disabled">disabled</option>
            <option value="short_public">short_public</option>
            <option value="dm_redirect">dm_redirect</option>
            <option value="operator_only">operator_only</option>
          </Select>
        </Field>

        <Field label="Contact Capture Mode">
          <Select
            value={local.contact_capture_mode}
            disabled={!canManage}
            onChange={(e) => patch("contact_capture_mode", e.target.value)}
          >
            <option value="inherit">inherit</option>
            <option value="never">never</option>
            <option value="optional">optional</option>
            <option value="required_before_quote">required_before_quote</option>
            <option value="required_before_handoff">required_before_handoff</option>
          </Select>
        </Field>

        <Field label="Escalation Mode">
          <Select
            value={local.escalation_mode}
            disabled={!canManage}
            onChange={(e) => patch("escalation_mode", e.target.value)}
          >
            <option value="inherit">inherit</option>
            <option value="manual">manual</option>
            <option value="automatic">automatic</option>
            <option value="operator_only">operator_only</option>
          </Select>
        </Field>

        <Field label="Reply Style">
          <Input
            value={local.reply_style}
            disabled={!canManage}
            onChange={(e) => patch("reply_style", e.target.value)}
            placeholder="short, warm, premium"
          />
        </Field>

        <Field label="Max Reply Sentences">
          <Input
            type="number"
            value={local.max_reply_sentences}
            disabled={!canManage}
            onChange={(e) => patch("max_reply_sentences", Number(e.target.value || 2))}
            placeholder="2"
          />
        </Field>

        <div className="lg:col-span-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FeatureToggleCard
            title="Enabled"
            subtitle="Bu policy aktiv olsun"
            checked={!!local.enabled}
            onChange={(v) => patch("enabled", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Auto Reply"
            subtitle="Kanal üzrə auto reply aktiv"
            checked={!!local.auto_reply_enabled}
            onChange={(v) => patch("auto_reply_enabled", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="AI Reply"
            subtitle="AI reply istifadə edilsin"
            checked={!!local.ai_reply_enabled}
            onChange={(v) => patch("ai_reply_enabled", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Human Handoff"
            subtitle="Human escalation icazəli olsun"
            checked={!!local.human_handoff_enabled}
            onChange={(v) => patch("human_handoff_enabled", v)}
            disabled={!canManage}
          />
        </div>

        <div className="lg:col-span-2">
          <RowActions
            canManage={canManage}
            saving={saving}
            deleting={deleting}
            onSave={() => onSave(local)}
            onDelete={() => onDelete(local.id)}
          />
        </div>
      </div>
    </Card>
  );
}

export default function ChannelPoliciesSection({
  items,
  canManage,
  onCreate,
  onSave,
  onDelete,
}) {
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  async function handleSave(item) {
    setSavingId(String(item.id || `${item.channel}:${item.subchannel}`));
    try {
      await onSave(item);
    } finally {
      setSavingId("");
    }
  }

  async function handleDelete(id) {
    setDeletingId(String(id || ""));
    try {
      await onDelete(id);
    } finally {
      setDeletingId("");
    }
  }

  return (
    <SettingsSection
      eyebrow="Business Brain"
      title="Channel Policies"
      subtitle="Instagram DM, comments, WhatsApp və digər kanallar üzrə davranış qaydaları."
      tone="default"
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={onCreate} disabled={!canManage} leftIcon={<ListTree className="h-4 w-4" />}>
            Add Policy
          </Button>
        </div>

        {!items.length ? (
          <EmptyState
            title="Hələ channel policy yoxdur"
            subtitle="Məsələn Instagram commentdə qiymət public yazılsın ya yox, DM-də auto-reply aktiv olsun ya yox kimi qaydalar."
            actionLabel="Create First Policy"
            onAction={onCreate}
            disabled={!canManage}
          />
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <ChannelPolicyCard
                key={item.id || `${item.channel || "channel"}-${idx}`}
                item={item}
                canManage={canManage}
                saving={savingId === String(item.id || `${item.channel}:${item.subchannel}`)}
                deleting={deletingId === String(item.id || "")}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
