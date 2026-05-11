const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "ai-hq-frontend/src/components/channels/ChannelDetailDrawer.jsx");
let src = fs.readFileSync(file, "utf8");

const start = src.indexOf("function ActionPanel({");
const end = src.indexOf("function StandardChannelDetailDrawer({");

if (start === -1 || end === -1 || end <= start) {
  throw new Error("ActionPanel block tapılmadı");
}

const replacement = `function ActionPanel({
  connected = false,
  pendingSelection = false,
  primaryLabel,
  primaryDisabled = false,
  primaryLoading = false,
  disconnectLoading = false,
  disconnectAvailable = false,
  onPrimary,
  onDisconnect,
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <Button
        type="button"
        fullWidth
        loading={primaryLoading}
        disabled={primaryDisabled}
        onClick={onPrimary}
        leftIcon={
          connected ? (
            <Inbox className="h-4 w-4" strokeWidth={2.1} />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2.1} />
          )
        }
      >
        {primaryLabel}
      </Button>

      {disconnectAvailable && !pendingSelection ? (
        <Button
          type="button"
          variant="secondary"
          loading={disconnectLoading}
          disabled={disconnectLoading}
          onClick={onDisconnect}
        >
          Disconnect
        </Button>
      ) : null}
    </div>
  );
}

`;

src = src.slice(0, start) + replacement + src.slice(end);

fs.writeFileSync(file, src, "utf8");
console.log("fixed ChannelDetailDrawer ActionPanel syntax");
