import { cx } from "../../lib/cx.js";

const SIZE_MAP = {
  sm: {
    slot: "h-10 w-10 rounded-[14px]",
    icon: "h-5 w-5",
    stackWrap: "h-10 w-10",
    stackPrimary: "h-5 w-5",
    stackSecondary: "h-4 w-4",
  },
  md: {
    slot: "h-11 w-11 rounded-[16px]",
    icon: "h-5.5 w-5.5",
    stackWrap: "h-11 w-11",
    stackPrimary: "h-5.5 w-5.5",
    stackSecondary: "h-4.5 w-4.5",
  },
  lg: {
    slot: "h-[52px] w-[52px] rounded-[18px]",
    icon: "h-6 w-6",
    stackWrap: "h-[52px] w-[52px]",
    stackPrimary: "h-6 w-6",
    stackSecondary: "h-5 w-5",
  },
};

function cleanClassName(className = "") {
  return String(className).replace("object-contain", "").trim();
}

function RenderIcon({ item, className }) {
  if (item.iconComponent) {
    const Icon = item.iconComponent;
    return <Icon className={cleanClassName(className)} />;
  }

  return (
    <img
      src={item.icon}
      alt={item.iconAlt || ""}
      className={cx("object-contain", className)}
      loading="lazy"
      decoding="async"
    />
  );
}

function StackedChannelIcon({ channel, view }) {
  const stack = Array.isArray(channel.iconStack) ? channel.iconStack.slice(0, 3) : [];
  if (!stack.length) return null;

  const primary = stack[0];
  const secondary = stack[1];
  const tertiary = stack[2];

  return (
    <span
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center",
        view.stackWrap
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]" />

      <span className="relative z-[1] inline-flex h-full w-full items-center justify-center">
        <span className="inline-flex h-[72%] w-[72%] items-center justify-center rounded-[14px] bg-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.24)]">
          <RenderIcon item={primary} className={view.stackPrimary} />
        </span>
      </span>

      {secondary ? (
        <span className="absolute bottom-[8%] right-[6%] z-[2] inline-flex h-[42%] w-[42%] items-center justify-center rounded-[12px] bg-white shadow-[0_10px_20px_-16px_rgba(15,23,42,0.22)]">
          <RenderIcon item={secondary} className={view.stackSecondary} />
        </span>
      ) : null}

      {tertiary ? (
        <span className="absolute left-[6%] top-[8%] z-[2] inline-flex h-[34%] w-[34%] items-center justify-center rounded-[10px] bg-white shadow-[0_8px_18px_-14px_rgba(15,23,42,0.2)]">
          <RenderIcon item={tertiary} className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </span>
  );
}

export default function ChannelIcon({
  channel,
  size = "md",
  className = "",
  slotClassName = "",
}) {
  const view = SIZE_MAP[size] || SIZE_MAP.md;
  const hasStack = Array.isArray(channel.iconStack) && channel.iconStack.length > 0;
  const SingleIcon = channel.iconComponent;

  if (hasStack) {
    return (
      <StackedChannelIcon
        channel={channel}
        view={view}
        className={className}
        slotClassName={slotClassName}
      />
    );
  }

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-text",
        view.slot,
        slotClassName
      )}
      aria-hidden="true"
    >
      {SingleIcon ? (
        <span className={cx("inline-flex items-center justify-center text-text", className)}>
          <SingleIcon className={cleanClassName(view.icon)} />
        </span>
      ) : (
        <img
          src={channel.icon}
          alt={channel.iconAlt || ""}
          className={cx("object-contain", view.icon, className)}
          loading="lazy"
          decoding="async"
        />
      )}
    </span>
  );
}