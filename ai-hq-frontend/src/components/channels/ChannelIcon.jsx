import { cx } from "../../lib/cx.js";

function IconItem({ item, className }) {
  if (item.iconComponent) {
    const Icon = item.iconComponent;
    return <Icon className={className.replace("object-contain", "").trim()} />;
  }

  return <img src={item.icon} alt={item.iconAlt} className={className} />;
}

export default function ChannelIcon({
  channel,
  className = "h-6 w-6 object-contain",
  stackClassName = "",
}) {
  if (Array.isArray(channel.iconStack) && channel.iconStack.length) {
    return (
      <span className={cx("inline-flex items-center -space-x-2", stackClassName)}>
        {channel.iconStack.map((item, index) => (
          <span key={`${channel.id}-icon-${index}`} className="relative">
            <IconItem item={item} className={className} />
          </span>
        ))}
      </span>
    );
  }

  if (channel.iconComponent) {
    const Icon = channel.iconComponent;
    return <Icon className={className.replace("object-contain", "").trim()} />;
  }

  return <img src={channel.icon} alt={channel.iconAlt} className={className} />;
}
