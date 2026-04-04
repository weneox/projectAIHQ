import { cx } from "../../lib/cx.js";

function normalizeIconClassName(className = "") {
  return className.replace("object-contain", "").trim();
}

function IconItem({ item, className, stacked = false }) {
  if (item.iconComponent) {
    const Icon = item.iconComponent;
    return (
      <span
        className={cx(
          "inline-flex shrink-0 items-center justify-center text-text",
          stacked && "opacity-[0.98]"
        )}
      >
        <Icon className={normalizeIconClassName(className)} />
      </span>
    );
  }

  return (
    <img
      src={item.icon}
      alt={item.iconAlt}
      className={cx(className, stacked && "opacity-[0.98]")}
      loading="lazy"
      decoding="async"
    />
  );
}

export default function ChannelIcon({
  channel,
  className = "h-6 w-6 object-contain",
  stackClassName = "",
}) {
  if (Array.isArray(channel.iconStack) && channel.iconStack.length) {
    return (
      <span
        className={cx("inline-flex items-center -space-x-1.5", stackClassName)}
        aria-hidden="true"
      >
        {channel.iconStack.map((item, index) => (
          <span
            key={`${channel.id}-icon-${index}`}
            className={cx(
              "relative inline-flex shrink-0 items-center justify-center",
              index > 0 && "opacity-[0.96]"
            )}
          >
            <IconItem item={item} className={className} stacked />
          </span>
        ))}
      </span>
    );
  }

  if (channel.iconComponent) {
    const Icon = channel.iconComponent;
    return (
      <span className="inline-flex shrink-0 items-center justify-center text-text">
        <Icon className={normalizeIconClassName(className)} />
      </span>
    );
  }

  return (
    <img
      src={channel.icon}
      alt={channel.iconAlt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}