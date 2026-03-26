import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

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

function LocationCard({ item, canManage, onSave, onDelete, saving, deleting }) {
  const [local, setLocal] = useState({
    id: item?.id || "",
    location_key: item?.location_key || "",
    title: item?.title || "",
    country_code: item?.country_code || "AZ",
    city: item?.city || "",
    address_line: item?.address_line || "",
    map_url: item?.map_url || "",
    phone: item?.phone || "",
    email: item?.email || "",
    is_primary: typeof item?.is_primary === "boolean" ? item.is_primary : false,
    enabled: typeof item?.enabled === "boolean" ? item.enabled : true,
    sort_order: item?.sort_order ?? 0,
  });

  useEffect(() => {
    setLocal({
      id: item?.id || "",
      location_key: item?.location_key || "",
      title: item?.title || "",
      country_code: item?.country_code || "AZ",
      city: item?.city || "",
      address_line: item?.address_line || "",
      map_url: item?.map_url || "",
      phone: item?.phone || "",
      email: item?.email || "",
      is_primary: typeof item?.is_primary === "boolean" ? item.is_primary : false,
      enabled: typeof item?.enabled === "boolean" ? item.enabled : true,
      sort_order: item?.sort_order ?? 0,
    });
  }, [item]);

  function patch(key, value) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card variant="surface" padded="lg" className="rounded-[28px]">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Location Key">
          <Input
            value={local.location_key}
            disabled={!canManage}
            onChange={(e) => patch("location_key", e.target.value)}
            placeholder="main_office"
          />
        </Field>

        <Field label="Title">
          <Input
            value={local.title}
            disabled={!canManage}
            onChange={(e) => patch("title", e.target.value)}
            placeholder="Main Office"
          />
        </Field>

        <Field label="Country Code">
          <Input
            value={local.country_code}
            disabled={!canManage}
            onChange={(e) => patch("country_code", e.target.value)}
            placeholder="AZ"
          />
        </Field>

        <Field label="City">
          <Input
            value={local.city}
            disabled={!canManage}
            onChange={(e) => patch("city", e.target.value)}
            placeholder="Baku"
          />
        </Field>

        <Field label="Address">
          <Input
            value={local.address_line}
            disabled={!canManage}
            onChange={(e) => patch("address_line", e.target.value)}
            placeholder="Street, building, floor"
          />
        </Field>

        <Field label="Map URL">
          <Input
            value={local.map_url}
            disabled={!canManage}
            onChange={(e) => patch("map_url", e.target.value)}
            placeholder="https://maps..."
          />
        </Field>

        <Field label="Phone">
          <Input
            value={local.phone}
            disabled={!canManage}
            onChange={(e) => patch("phone", e.target.value)}
            placeholder="+994..."
          />
        </Field>

        <Field label="Email">
          <Input
            value={local.email}
            disabled={!canManage}
            onChange={(e) => patch("email", e.target.value)}
            placeholder="info@company.com"
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

        <div className="grid gap-3 md:grid-cols-2">
          <FeatureToggleCard
            title="Primary"
            subtitle="Əsas location"
            checked={!!local.is_primary}
            onChange={(v) => patch("is_primary", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Enabled"
            subtitle="Bu location aktiv olsun"
            checked={!!local.enabled}
            onChange={(v) => patch("enabled", v)}
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

export default function LocationsSection({
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
    setSavingId(String(item.id || item.location_key || "new"));
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
      title="Locations"
      subtitle="Filiallar, address, working hours, map link və delivery area məlumatları."
      tone="default"
    >
      <div className="space-y-4">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Locations are temporarily unavailable."
        />
        <div className="flex justify-end">
          <Button onClick={onCreate} disabled={!canManage} leftIcon={<MapPin className="h-4 w-4" />}>
            Add Location
          </Button>
        </div>

        {!items.length ? (
          <EmptyState
            title="Hələ location yoxdur"
            subtitle="Filial və ya ofis məlumatlarını əlavə et ki sistem branch/location əsaslı cavab verə bilsin."
            actionLabel="Create First Location"
            onAction={onCreate}
            disabled={!canManage}
          />
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <LocationCard
                key={item.id || `${item.location_key || "location"}-${idx}`}
                item={item}
                canManage={canManage}
                saving={savingId === String(item.id || item.location_key || "new")}
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
