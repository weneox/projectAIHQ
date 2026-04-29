import { cx } from "../../lib/cx.js";

const SIZE_MAP = {
  sm: {
    wrap: "h-8 w-8",
    icon: "h-7 w-7",
    component: "h-5 w-5",
    stackWrap: "h-8 w-8",
    stackPrimary: "h-5 w-5",
    stackSecondary: "h-4 w-4",
    stackTertiary: "h-3.5 w-3.5",
  },
  md: {
    wrap: "h-10 w-10",
    icon: "h-8 w-8",
    component: "h-6 w-6",
    stackWrap: "h-10 w-10",
    stackPrimary: "h-6 w-6",
    stackSecondary: "h-[18px] w-[18px]",
    stackTertiary: "h-4 w-4",
  },
  lg: {
    wrap: "h-12 w-12",
    icon: "h-11 w-11",
    component: "h-8 w-8",
    stackWrap: "h-12 w-12",
    stackPrimary: "h-8 w-8",
    stackSecondary: "h-5 w-5",
    stackTertiary: "h-[18px] w-[18px]",
  },
};

function cleanClassName(className = "") {
  return String(className).replace("object-contain", "").trim();
}

function RenderIcon({ item, className }) {
  if (item.iconComponent) {
    const Icon = item.iconComponent;

    return (
      <Icon
        className={cleanClassName(className)}
        strokeWidth={1.95}
      />
    );
  }

  return (
    <img
      src={item.icon}
      alt={item.iconAlt || ""}
      className={cx("object-contain", className)}
      loading="lazy"
      decoding="async"
      draggable="false"
    />
  );
}

function StackedChannelIcon({ channel, view, className = "" }) {
  const stack = Array.isArray(channel.iconStack)
    ? channel.iconStack.slice(0, 3)
    : [];

  if (!stack.length) return null;

  const primary = stack[0];
  const secondary = stack[1];
  const tertiary = stack[2];

  return (
    <span
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center",
        "text-text",
        view.stackWrap,
        className
      )}
      aria-hidden="true"
    >
      <span className="relative z-[2] inline-flex items-center justify-center">
        <RenderIcon item={primary} className={view.stackPrimary} />
      </span>

      {secondary ? (
        <span className="absolute bottom-[1px] right-[1px] z-[3] inline-flex items-center justify-center">
          <RenderIcon item={secondary} className={view.stackSecondary} />
        </span>
      ) : null}

      {tertiary ? (
        <span className="absolute left-[1px] top-[1px] z-[1] inline-flex items-center justify-center opacity-80">
          <RenderIcon item={tertiary} className={view.stackTertiary} />
        </span>
      ) : null}
    </span>
  );
}

export default function ChannelIcon({
  channel,
  size = "md",
  className = "",
}) {
  const safeChannel = channel || {};
  const view = SIZE_MAP[size] || SIZE_MAP.md;

  const hasStack =
    Array.isArray(safeChannel.iconStack) && safeChannel.iconStack.length > 0;

  const SingleIcon = safeChannel.iconComponent;

  if (hasStack) {
    return (
      <StackedChannelIcon
        channel={safeChannel}
        view={view}
        className={className}
      />
    );
  }

  return (
    <span
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center text-text",
        view.wrap
      )}
      aria-hidden="true"
    >
      {SingleIcon ? (
        <SingleIcon
          className={cleanClassName(cx(view.component, className))}
          strokeWidth={1.95}
        />
      ) : (
        <img
          src={safeChannel.icon}
          alt={safeChannel.iconAlt || ""}
          className={cx("object-contain", view.icon, className)}
          loading="lazy"
          decoding="async"
          draggable="false"
        />
      )}
    </span>
  );
}