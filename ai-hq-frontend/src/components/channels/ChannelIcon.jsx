import { cx } from "../../lib/cx.js";

const SIZE_MAP = {
  sm: {
    wrap: "h-8 w-8",
    icon: "h-8 w-8",
    component: "h-5 w-5",
    stackWrap: "h-8 w-8",
    stackPrimary: "h-4.5 w-4.5",
    stackSecondary: "h-3.5 w-3.5",
    stackTertiary: "h-3 w-3",
  },
  md: {
    wrap: "h-9 w-9",
    icon: "h-9 w-9",
    component: "h-5.5 w-5.5",
    stackWrap: "h-9 w-9",
    stackPrimary: "h-5 w-5",
    stackSecondary: "h-4 w-4",
    stackTertiary: "h-3 w-3",
  },
  lg: {
    wrap: "h-10 w-10",
    icon: "h-10 w-10",
    component: "h-6 w-6",
    stackWrap: "h-10 w-10",
    stackPrimary: "h-5.5 w-5.5",
    stackSecondary: "h-4.5 w-4.5",
    stackTertiary: "h-3.5 w-3.5",
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
        view.stackWrap
      )}
      aria-hidden="true"
    >
      <span className="relative z-[1] inline-flex h-[70%] w-[70%] items-center justify-center rounded-[10px] border border-[#e6ebf2] bg-white shadow-[0_8px_16px_-12px_rgba(15,23,42,0.14)]">
        <RenderIcon item={primary} className={view.stackPrimary} />
      </span>

      {secondary ? (
        <span className="absolute bottom-0 right-0 z-[2] inline-flex h-[42%] w-[42%] items-center justify-center rounded-[8px] border border-[#e8edf3] bg-white shadow-[0_6px_12px_-10px_rgba(15,23,42,0.12)]">
          <RenderIcon item={secondary} className={view.stackSecondary} />
        </span>
      ) : null}

      {tertiary ? (
        <span className="absolute left-0 top-0 z-[2] inline-flex h-[34%] w-[34%] items-center justify-center rounded-[7px] border border-[#e8edf3] bg-white shadow-[0_5px_10px_-9px_rgba(15,23,42,0.10)]">
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
  const view = SIZE_MAP[size] || SIZE_MAP.md;
  const hasStack =
    Array.isArray(channel.iconStack) && channel.iconStack.length > 0;
  const SingleIcon = channel.iconComponent;

  if (hasStack) {
    return <StackedChannelIcon channel={channel} view={view} />;
  }

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center",
        view.wrap
      )}
      aria-hidden="true"
    >
      {SingleIcon ? (
        <span className="inline-flex items-center justify-center text-text">
          <SingleIcon className={cleanClassName(cx(view.component, className))} />
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