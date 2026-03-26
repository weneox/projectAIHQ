import { useEffect, useState } from "react";
import { Contact2 } from "lucide-react";

import Button from "../../../components/ui/Button.jsx";
import Card from "../../../components/ui/Card.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import {
  EmptyState,
  FeatureToggleCard,
  Field,
  Input,
  RowActions,
} from "./SectionPrimitives.jsx";

function ContactCard({ item, canManage, onSave, onDelete, saving, deleting }) {
  const [local, setLocal] = useState({
    id: item?.id || "",
    contact_key: item?.contact_key || "",
    channel: item?.channel || "phone",
    label: item?.label || "",
    value: item?.value || "",
    is_primary: typeof item?.is_primary === "boolean" ? item.is_primary : false,
    enabled: typeof item?.enabled === "boolean" ? item.enabled : true,
    visible_public:
      typeof item?.visible_public === "boolean" ? item.visible_public : true,
    visible_in_ai:
      typeof item?.visible_in_ai === "boolean" ? item.visible_in_ai : true,
    sort_order: item?.sort_order ?? 0,
  });

  useEffect(() => {
    setLocal({
      id: item?.id || "",
      contact_key: item?.contact_key || "",
      channel: item?.channel || "phone",
      label: item?.label || "",
      value: item?.value || "",
      is_primary: typeof item?.is_primary === "boolean" ? item.is_primary : false,
      enabled: typeof item?.enabled === "boolean" ? item.enabled : true,
      visible_public:
        typeof item?.visible_public === "boolean" ? item.visible_public : true,
      visible_in_ai:
        typeof item?.visible_in_ai === "boolean" ? item.visible_in_ai : true,
      sort_order: item?.sort_order ?? 0,
    });
  }, [item]);

  function patch(key, value) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card variant="surface" padded="lg" className="rounded-[28px]">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Contact Key">
          <Input
            value={local.contact_key}
            disabled={!canManage}
            onChange={(e) => patch("contact_key", e.target.value)}
            placeholder="main_phone"
          />
        </Field>

        <Field label="Channel">
          <Input
            value={local.channel}
            disabled={!canManage}
            onChange={(e) => patch("channel", e.target.value)}
            placeholder="phone"
          />
        </Field>

        <Field label="Label">
          <Input
            value={local.label}
            disabled={!canManage}
            onChange={(e) => patch("label", e.target.value)}
            placeholder="Main Sales Line"
          />
        </Field>

        <Field label="Value">
          <Input
            value={local.value}
            disabled={!canManage}
            onChange={(e) => patch("value", e.target.value)}
            placeholder="+994..."
          />
        </Field>

        <Field label="Sort Order">
          <Input
            type="number"
            value={local.sort_order}
            disabled={!canManage}
            onChange={(e) => patch("sort_order", Number(e.target.value || 0))}
            placeholder="0"
          />
        </Field>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 lg:col-span-2">
          <FeatureToggleCard
            title="Primary"
            subtitle="Əsas contact"
            checked={!!local.is_primary}
            onChange={(v) => patch("is_primary", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Enabled"
            subtitle="Record aktiv olsun"
            checked={!!local.enabled}
            onChange={(v) => patch("enabled", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Visible Public"
            subtitle="Public UI üçün görünə bilər"
            checked={!!local.visible_public}
            onChange={(v) => patch("visible_public", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Visible In AI"
            subtitle="AI cavablarında istifadə olunsun"
            checked={!!local.visible_in_ai}
            onChange={(v) => patch("visible_in_ai", v)}
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

export default function ContactsSection({
  items,
  canManage,
  surface,
  onCreate,
  onSave,
  onDelete,
}) {
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  async function handleSave(item) {
    setSavingId(String(item.id || item.contact_key || "new"));
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
      title="Contacts"
      subtitle="Telefon, email, WhatsApp, Instagram, support line və AI-visible əlaqə kanalları."
      tone="default"
    >
      <div className="space-y-4">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Contacts are temporarily unavailable."
        />
        <div className="flex justify-end">
          <Button onClick={onCreate} disabled={!canManage} leftIcon={<Contact2 className="h-4 w-4" />}>
            Add Contact
          </Button>
        </div>

        {!items.length ? (
          <EmptyState
            title="Hələ contact yoxdur"
            subtitle="AI düzgün əlaqə məlumatı verməsi üçün əsas contact record-lar buraya daxil edilməlidir."
            actionLabel="Create First Contact"
            onAction={onCreate}
            disabled={!canManage}
          />
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <ContactCard
                key={item.id || `${item.contact_key || "contact"}-${idx}`}
                item={item}
                canManage={canManage}
                saving={savingId === String(item.id || item.contact_key || "new")}
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
