const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "ai-hq-frontend/src/components/channels/WebsiteWidgetDetailDrawer.jsx");
let src = fs.readFileSync(file, "utf8");

src = src.replace(
  'import { useEffect, useMemo, useState } from "react";',
  'import { useState } from "react";'
);

src = src.replace(
  `  const [form, setForm] = useState(() => buildInitialForm());
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState(null);

  const statusQueryKey = buildWorkspaceScopedQueryKey(
    ["website-widget-status"],
    workspace.tenantKey
  );

  const statusQuery = useQuery({
    queryKey: statusQueryKey,
    queryFn: getWebsiteWidgetStatus,
    enabled: open && workspace.ready,
    staleTime: 8_000,
    refetchOnWindowFocus: false,
  });

  const domain = normalizeDomain(form.domain);
  const widgetStatus = obj(statusQuery.data);
  const widgetId = getWidgetId(widgetStatus);`,
  `  const [formDraft, setFormDraft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState(null);

  const statusQueryKey = buildWorkspaceScopedQueryKey(
    ["website-widget-status"],
    workspace.tenantKey
  );

  const statusQuery = useQuery({
    queryKey: statusQueryKey,
    queryFn: getWebsiteWidgetStatus,
    enabled: open && workspace.ready,
    staleTime: 8_000,
    refetchOnWindowFocus: false,
  });

  const widgetStatus = obj(statusQuery.data);
  const form = formDraft || buildInitialForm(widgetStatus);
  const domain = normalizeDomain(form.domain);
  const widgetId = getWidgetId(widgetStatus);`
);

src = src.replace(
  `  useEffect(() => {
    if (!statusQuery.data) return;
    setForm(buildInitialForm(statusQuery.data));
  }, [statusQuery.data]);

`,
  ""
);

src = src.replaceAll("setForm((current) => ({", "setFormDraft((current) => ({\n                        ...form,");
src = src.replaceAll("...current,", "...current,");

// Yuxarıdakı replace bəzi yerlərdə artıq ...form + ...current yaradır, onu düz saxlayırıq.
// Amma nested indentation-dan asılı olaraq təkrar ...form düşməsin deyə sadə cleanup:
src = src.replaceAll("...form,\n                        ...current,\n                        ...form,", "...form,\n                        ...current,");

src = src.replace(
  `      setNotice({ tone: "success", text: "Website chat settings saved." });
      await queryClient.invalidateQueries({ queryKey: statusQueryKey });`,
  `      setNotice({ tone: "success", text: "Website chat settings saved." });
      setFormDraft(null);
      await queryClient.invalidateQueries({ queryKey: statusQueryKey });`
);

const oldSteps = `  const steps = useMemo(
    () => [
      {
        title: "Configure",
        body: widgetId
          ? "Widget identity is created."
          : "Save once to create the public widget ID.",
        done: Boolean(widgetId),
        current: !widgetId,
      },
      {
        title: "Verify domain",
        body: verified
          ? "Domain ownership is verified."
          : "Confirm this website can load the widget.",
        done: verified,
        current: Boolean(widgetId) && !verified,
      },
      {
        title: "Install & test",
        body: productionReady
          ? "Snippet is ready for production install."
          : "Copy snippet and send a test message to Inbox.",
        done: productionReady,
        current: Boolean(widgetId) && verified && !productionReady,
      },
    ],
    [productionReady, verified, widgetId]
  );`;

const newSteps = `  const steps = [
    {
      title: "Configure",
      body: widgetId
        ? "Widget identity is created."
        : "Save once to create the public widget ID.",
      done: Boolean(widgetId),
      current: !widgetId,
    },
    {
      title: "Verify domain",
      body: verified
        ? "Domain ownership is verified."
        : "Confirm this website can load the widget.",
      done: verified,
      current: Boolean(widgetId) && !verified,
    },
    {
      title: "Install & test",
      body: productionReady
        ? "Snippet is ready for production install."
        : "Copy snippet and send a test message to Inbox.",
      done: productionReady,
      current: Boolean(widgetId) && verified && !productionReady,
    },
  ];`;

if (!src.includes(oldSteps)) {
  throw new Error("steps useMemo block not found");
}

src = src.replace(oldSteps, newSteps);

fs.writeFileSync(file, src, "utf8");
console.log("fixed WebsiteWidgetDetailDrawer React lint issues");
