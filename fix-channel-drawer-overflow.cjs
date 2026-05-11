const fs = require("fs");
const path = require("path");

const root = process.cwd();

function patchFile(rel, patches) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, "utf8");

  for (const [from, to] of patches) {
    if (!src.includes(from)) {
      throw new Error(`Pattern not found in ${rel}:\n${from.slice(0, 180)}`);
    }
    src = src.replace(from, to);
  }

  fs.writeFileSync(file, src, "utf8");
}

patchFile("ai-hq-frontend/src/pages/ChannelCatalog.jsx", [
  [
    `      <div
        className="relative w-full max-w-[880px]"`,
    `      <div
        className="relative w-full max-w-[720px]"`
  ],
  [
    `        <div className="h-[min(730px,calc(100vh-44px))] overflow-hidden rounded-md border border-white/70 bg-surface shadow-[0_34px_90px_-54px_rgba(15,23,42,0.86)]">`,
    `        <div className="h-[min(560px,calc(100vh-120px))] overflow-hidden rounded-md border border-white/70 bg-surface shadow-[0_34px_90px_-54px_rgba(15,23,42,0.86)]">`
  ],
]);

patchFile("ai-hq-frontend/src/components/channels/ChannelDetailDrawer.jsx", [
  [
    `      <header className="shrink-0 border-b border-line-soft bg-surface px-7 py-5">`,
    `      <header className="shrink-0 border-b border-line-soft bg-surface px-5 py-4">`
  ],
  [
    `            <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center">`,
    `            <div className="flex h-11 w-11 shrink-0 items-center justify-center">`
  ],
  [
    `              <div className="truncate text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">`,
    `              <div className="truncate text-[22px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">`
  ],
  [
    `      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-surface-muted px-7 py-6">
        <div className="mx-auto max-w-[860px] space-y-4">`,
    `      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-surface-muted px-5 py-4">
        <div className="mx-auto max-w-[680px] space-y-3">`
  ],
  [
    `    <Card padded="md">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <PrimaryStatus label={channelStateLabel(state)} state={state} />

          <h2 className="mt-4 truncate text-[26px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
            {connected ? \`\${channel?.name} is connected\` : \`Connect \${channel?.name}\`}
          </h2>

          <p className="mt-2 max-w-[620px] text-[13.5px] font-medium leading-6 text-text-muted">
            {statusMessage({ channel, status })}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={loading}
          onClick={onRefresh}
          leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
        >
          Refresh
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-3 border border-line-soft bg-surface-muted">
        <DetailMetric
          label="Messages"
          value={messagesReady ? "Active" : "Off"}
          tone={messagesReady ? "success" : "warning"}
        />
        <DetailMetric
          label="Replies"
          value={connected ? "Enabled" : "Off"}
          tone={connected ? "success" : "warning"}
        />
        <DetailMetric
          label="Account"
          value={displayName || "Not set"}
          tone={connected ? "success" : "neutral"}
        />
      </div>

      {subtitle ? (
        <div className="mt-3 text-[12.5px] font-medium text-text-muted">
          {subtitle}
        </div>
      ) : null}
    </Card>`,
    `    <Card padded="sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
            {connected ? \`\${channel?.name} is connected\` : \`Connect \${channel?.name}\`}
          </h2>

          <p className="mt-2 max-w-[560px] text-[13px] font-medium leading-6 text-text-muted">
            {statusMessage({ channel, status })}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={loading}
          onClick={onRefresh}
          leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
        >
          Refresh
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-3 border border-line-soft bg-surface-muted">
        <DetailMetric
          label="Messages"
          value={messagesReady ? "Active" : "Off"}
          tone={messagesReady ? "success" : "warning"}
        />
        <DetailMetric
          label="Replies"
          value={connected ? "Enabled" : "Off"}
          tone={connected ? "success" : "warning"}
        />
        <DetailMetric
          label="Account"
          value={displayName || "Not set"}
          tone={connected ? "success" : "neutral"}
        />
      </div>

      {subtitle ? (
        <div className="mt-2 text-[12px] font-medium text-text-muted">
          {subtitle}
        </div>
      ) : null}
    </Card>`
  ],
  [
    `          <Card padded="md">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h3 className="text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  Inbox flow
                </h3>

                <p className="mt-2 max-w-[560px] text-[13.5px] font-medium leading-6 text-text-muted">
                  Customer messages from this channel are handled from the shared inbox.
                </p>
              </div>

              <CheckCircle2
                className={cx(
                  "h-5 w-5",
                  connected ? "text-success" : "text-text-subtle"
                )}
                strokeWidth={2.1}
              />
            </div>

            {isTelegram && !connected ? (
              <div className="mt-4">
                <SmallLinkButton onClick={handleTelegramCreate}>
                  Open BotFather
                </SmallLinkButton>
              </div>
            ) : null}
          </Card>`,
    `          {isTelegram && !connected ? (
            <Card padded="sm">
              <SmallLinkButton onClick={handleTelegramCreate}>
                Open BotFather
              </SmallLinkButton>
            </Card>
          ) : null}`
  ],
  [
    `      <footer className="shrink-0 border-t border-line-soft bg-white px-7 py-4">
        <div className="mx-auto max-w-[860px]">`,
    `      <footer className="shrink-0 border-t border-line-soft bg-white px-5 py-3">
        <div className="mx-auto max-w-[680px]">`
  ],
  [
    `    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">`,
    `    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">`
  ],
  [
    `      {connected ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onInbox}
          leftIcon={<Inbox className="h-4 w-4" strokeWidth={2.1} />}
        >
          Inbox
        </Button>
      ) : null}

      {disconnectAvailable && !pendingSelection ? (`,
    `      {disconnectAvailable && !pendingSelection ? (`
  ],
]);

console.log("compacted channel modal and drawer");
