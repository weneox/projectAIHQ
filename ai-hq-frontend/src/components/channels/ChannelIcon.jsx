import { cx } from "../../lib/cx.js";

const SIZE_MAP = {
  sm: {
    slot: "h-10 w-10",
    icon: "h-4.5 w-4.5",
    stackIcon: "h-3.5 w-3.5",
  },
  md: {
    slot: "h-11 w-11",
    icon: "h-5 w-5",
    stackIcon: "h-4 w-4",
  },
  lg: {
    slot: "h-14 w-14",
    icon: "h-5.5 w-5.5",
    stackIcon: "h-4.5 w-4.5",
  },
};

function normalizeIconClassName(className = "") {
  return className.replace("object-contain", "").trim();
}

function IconItem({ item, className }) {
  if (item.iconComponent) {
    const Icon = item.iconComponent;

    return (
      <span className="inline-flex items-center justify-center text-text">
        <Icon className={normalizeIconClassName(className)} />
      </span>
    );
  }

  return (
    <img
      src={item.icon}
      alt={item.iconAlt}
      className={cx("object-contain", className)}
      loading="lazy"
      decoding="async"
    />
  );
}

export default function ChannelIcon({
  channel,
  size = "md",
  className = "",
  slotClassName = "",
}) {
  const view = SIZE_MAP[size] || SIZE_MAP.md;
  const stack = Array.isArray(channel.iconStack) ? channel.iconStack.slice(0, 3) : [];
  const hasStack = stack.length > 0;
  const SingleIcon = channel.iconComponent;

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden border border-line bg-surface-subtle text-text",
        view.slot,
        slotClassName
      )}
      aria-hidden="true"
    >
      {hasStack ? (
        <span
          className={cx(
            "grid h-full w-full gap-px bg-line-soft",
            stack.length === 1 && "grid-cols-1",
            stack.length === 2 && "grid-cols-2",
            stack.length >= 3 && "grid-cols-2 [&>span:last-child]:col-span-2"
          )}
        >
          {stack.map((item, index) => (
            <span
              key={`${channel.id}-icon-${index}`}
              className="inline-flex items-center justify-center bg-surface-subtle"
            >
              <IconItem item={item} className={view.stackIcon} />
            </span>
          ))}
        </span>
      ) : SingleIcon ? (
        <span
          className={cx("inline-flex items-center justify-center text-text", className)}
        >
          <SingleIcon className={normalizeIconClassName(view.icon)} />
        </span>
      ) : (
        <img
          src={channel.icon}
          alt={channel.iconAlt}
          className={cx("object-contain", view.icon, className)}
          loading="lazy"
          decoding="async"
        />
      )}
    </span>
  );
}
