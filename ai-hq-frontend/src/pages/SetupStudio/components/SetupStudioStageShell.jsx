import { motion } from "framer-motion";
import { PageHeader } from "../../../components/ui/PageSection.jsx";

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
      className="product-page w-full"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          body={body}
          align={align}
        />

        <div className="pt-8">{children}</div>
      </div>
    </motion.section>
  );
}
