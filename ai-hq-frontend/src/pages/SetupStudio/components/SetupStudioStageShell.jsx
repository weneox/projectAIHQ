import { motion } from "framer-motion";

function s(v) {
  return String(v ?? "").trim();
}

export default function SetupStudioStageShell({
  eyebrow = "",
  title,
  body = "",
  align = "left",
  children,
}) {
  const centered = s(align).toLowerCase() === "center";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="relative overflow-hidden rounded-[38px] bg-[linear-gradient(180deg,rgba(255,255,255,.78)_0%,rgba(247,248,250,.64)_100%)] px-5 py-6 shadow-[0_28px_70px_-46px_rgba(15,23,42,.28)] backdrop-blur-[18px] sm:px-7 sm:py-7 lg:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_top_left,rgba(255,255,255,.88),transparent_44%),radial-gradient(620px_circle_at_bottom_right,rgba(226,232,240,.24),transparent_34%)]" />

          <div className="relative z-10">
            <div
              className={`${centered ? "mx-auto max-w-[740px] text-center" : "max-w-[760px]"}`}
            >
              {eyebrow ? (
                <div className="mb-4 inline-flex items-center rounded-full bg-white/78 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {eyebrow}
                </div>
              ) : null}

              <h2 className="text-[30px] font-semibold leading-[1.04] tracking-[-0.055em] text-slate-950 sm:text-[38px] lg:text-[44px]">
                {title}
              </h2>

              {body ? (
                <p className="mt-3 text-[15px] leading-7 text-slate-600">
                  {body}
                </p>
              ) : null}
            </div>

            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
