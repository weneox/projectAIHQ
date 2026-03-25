import { cn } from "./analytics-utils.js";

export default function Surface({ className = "", children }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,26,0.86),rgba(6,9,18,0.94))] shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}