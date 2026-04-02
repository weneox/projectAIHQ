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
        <div className={`border-b border-slate-200/80 pb-8 ${centered ? "text-center" : ""}`}>
          <div className={`${centered ? "mx-auto max-w-[740px]" : "max-w-[760px]"}`}>
            {eyebrow ? (
              <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
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
        </div>

        <div className="pt-8">{children}</div>
      </div>
    </motion.section>
  );
}
