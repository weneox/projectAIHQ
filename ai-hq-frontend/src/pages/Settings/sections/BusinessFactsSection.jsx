import { useEffect, useState } from "react";
import { BrainCircuit } from "lucide-react";

import Button from "../../../components/ui/Button.jsx";
import Card from "../../../components/ui/Card.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import {
  EmptyState,
  Field,
  Input,
  RowActions,
  Select,
  Toggle,
} from "./SectionPrimitives.jsx";

function BusinessFactCard({ item, canManage, onSave, onDelete, saving, deleting }) {
  const [local, setLocal] = useState({
    id: item?.id || "",
    fact_key: item?.fact_key || "",
    fact_group: item?.fact_group || "general",
    title: item?.title || "",
    value_text: item?.value_text || "",
    language: item?.language || "az",
    priority: item?.priority ?? 100,
    enabled: typeof item?.enabled === "boolean" ? item.enabled : true,
    source_type: item?.source_type || "manual",
  });

  useEffect(() => {
    setLocal({
      id: item?.id || "",
      fact_key: item?.fact_key || "",
      fact_group: item?.fact_group || "general",
      title: item?.title || "",
      value_text: item?.value_text || "",
      language: item?.language || "az",
      priority: item?.priority ?? 100,
      enabled: typeof item?.enabled === "boolean" ? item.enabled : true,
      source_type: item?.source_type || "manual",
    });
  }, [item]);

  function patch(key, value) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card variant="surface" padded="lg" className="rounded-[28px]">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Fact Key" hint="Məs: pricing_policy, shipping_rule, service_scope">
          <Input
            value={local.fact_key}
            disabled={!canManage}
            onChange={(e) => patch("fact_key", e.target.value)}
            placeholder="pricing_policy"
          />
        </Field>

        <Field label="Group" hint="general, pricing, support, sales və s.">
          <Input
            value={local.fact_group}
            disabled={!canManage}
            onChange={(e) => patch("fact_group", e.target.value)}
            placeholder="general"
          />
        </Field>

        <Field label="Title" hint="UI və admin üçün qısa başlıq">
          <Input
            value={local.title}
            disabled={!canManage}
            onChange={(e) => patch("title", e.target.value)}
            placeholder="Pricing Policy"
          />
        </Field>

        <Field label="Language" hint="az / en / ru / tr">
          <Input
            value={local.language}
            disabled={!canManage}
            onChange={(e) => patch("language", e.target.value)}
            placeholder="az"
          />
        </Field>

        <Field label="Priority" hint="Kiçik rəqəm daha prioritetli olur">
          <Input
            type="number"
            value={local.priority}
            disabled={!canManage}
            onChange={(e) => patch("priority", Number(e.target.value || 100))}
            placeholder="100"
          />
        </Field>

        <Field label="Source Type" hint="manual / imported / derived / system">
          <Select
            value={local.source_type}
            disabled={!canManage}
            onChange={(e) => patch("source_type", e.target.value)}
          >
            <option value="manual">manual</option>
            <option value="imported">imported</option>
            <option value="derived">derived</option>
            <option value="system">system</option>
          </Select>
        </Field>

        <div className="lg:col-span-2">
          <Field label="Value Text" hint="AI burada əsas business konteksti kimi istifadə edəcək">
            <textarea
              value={local.value_text}
              disabled={!canManage}
              onChange={(e) => patch("value_text", e.target.value)}
              placeholder="Qiymətlər avtomatik yazılmamalıdır. İstifadəçi qiymət soruşarsa əvvəl ehtiyacını dəqiqləşdir və sonra DM/contact capture et."
              className="min-h-[140px] w-full rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300/90 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
            />
          </Field>
        </div>

        <div className="lg:col-span-2 flex items-center justify-between gap-4 rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Enabled
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Bu fact AI tərəfindən istifadə olunsun.
            </div>
          </div>
          <Toggle checked={!!local.enabled} onChange={(v) => patch("enabled", v)} disabled={!canManage} />
        </div>

        <div className="lg:col-span-2">
          <RowActions
            canManage={canManage}
            saving={saving}
            deleting={deleting}
            onSave={() => onSave(local)}
            onDelete={() => onDelete(local)}
          />
        </div>
      </div>
    </Card>
  );
}

export default function BusinessFactsSection({
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
    setSavingId(String(item.id || item.fact_key || "new"));
    try {
      await onSave(item);
    } finally {
      setSavingId("");
    }
  }

  async function handleDelete(item) {
    if (!item?.id) return;
    setDeletingId(String(item.id));
    try {
      await onDelete(item.id);
    } finally {
      setDeletingId("");
    }
  }

  return (
    <SettingsSection
      eyebrow="Business Brain"
      title="Business Facts"
      subtitle="Şirkətə aid əsas faktlar, qaydalar, pricing qaydaları, satış məntiqi və xüsusi cavab konteksti."
      tone="default"
    >
      <div className="space-y-4">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Business facts are temporarily unavailable."
        />
        <div className="flex justify-end">
          <Button onClick={onCreate} disabled={!canManage} leftIcon={<BrainCircuit className="h-4 w-4" />}>
            Add Fact
          </Button>
        </div>

        {!items.length ? (
          <EmptyState
            title="Hələ business fact yoxdur"
            subtitle="Qiymət qaydaları, çatdırılma qaydaları, xüsusi cavab qaydaları və s. buraya əlavə olunmalıdır."
            actionLabel="Create First Fact"
            onAction={onCreate}
            disabled={!canManage}
          />
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <BusinessFactCard
                key={item.id || `${item.fact_key || "fact"}-${idx}`}
                item={item}
                canManage={canManage}
                saving={savingId === String(item.id || item.fact_key || "new")}
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
