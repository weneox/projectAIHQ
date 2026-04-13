import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function AdminSectionSkeleton({
  title,
  subtitle,
  chips,
  children,
}: {
  title: string;
  subtitle?: string;
  chips?: string[];
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: 18, color: "rgba(255,255,255,.92)" }}>{title}</div>
          <div style={{ marginTop: 6, opacity: 0.72, color: "rgba(255,255,255,.85)", lineHeight: 1.35 }}>
            {subtitle || "Bu bölmə hazır skeleton-dur. Növbəti addım: backend endpoint-lər + UI."}
          </div>

          {chips?.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {chips.map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "rgba(255,255,255,.04)",
                    color: "rgba(255,255,255,.86)",
                    opacity: 0.95,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.10)",
            background: "rgba(255,255,255,.03)",
            boxShadow: "0 18px 60px rgba(0,0,0,.30)",
            backdropFilter: "blur(10px)",
            color: "rgba(255,255,255,.85)",
            fontSize: 12,
            whiteSpace: "nowrap",
            opacity: 0.85,
          }}
        >
          Skeleton mode
        </div>
      </div>

      {/* Body grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <SkelCard title="Status" span={4}>
          <SkelLine w="70%" />
          <SkelLine w="50%" />
          <SkelLine w="60%" />
        </SkelCard>

        <SkelCard title="Filters" span={4}>
          <SkelPill />
          <div style={{ height: 8 }} />
          <SkelPill />
        </SkelCard>

        <SkelCard title="Actions" span={4}>
          <SkelButton />
          <div style={{ height: 8 }} />
          <SkelButton />
        </SkelCard>

        <SkelCard title="Main panel" span={8}>
          <SkelRow />
          <SkelRow />
          <SkelRow />
          <SkelRow />
        </SkelCard>

        <SkelCard title="Side panel" span={4}>
          <SkelLine w="80%" />
          <SkelLine w="55%" />
          <SkelLine w="65%" />
          <div style={{ height: 10 }} />
          <SkelPill />
        </SkelCard>
      </div>

      {children ? (
        <div
          style={{
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,.10)",
            background: "rgba(255,255,255,.03)",
            boxShadow: "0 18px 60px rgba(0,0,0,.30)",
            backdropFilter: "blur(10px)",
            padding: 14,
            color: "rgba(255,255,255,.88)",
          }}
        >
          {children}
        </div>
      ) : null}

      {/* mobile */}
      <style>{`
        @media (max-width: 820px) {
          .neox-skel-span-8 { grid-column: span 12 / span 12 !important; }
          .neox-skel-span-4 { grid-column: span 12 / span 12 !important; }
        }
      `}</style>
    </div>
  );
}

function SkelCard({ title, span, children }: { title: string; span: 4 | 8 | 12; children?: React.ReactNode }) {
  const cls = span === 8 ? "neox-skel-span-8" : "neox-skel-span-4";
  return (
    <div
      className={cls}
      style={{
        gridColumn: `span ${span} / span ${span}`,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.03)",
        boxShadow: "0 18px 60px rgba(0,0,0,.30)",
        backdropFilter: "blur(10px)",
        padding: 14,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, color: "rgba(255,255,255,.85)" }}>{title}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function SkelLine({ w = "70%" }: { w?: string }) {
  return (
    <div
      style={{
        height: 10,
        width: w,
        borderRadius: 999,
        background: "linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12), rgba(255,255,255,.06))",
        opacity: 0.9,
        marginTop: 10,
      }}
    />
  );
}

function SkelPill() {
  return (
    <div
      style={{
        height: 34,
        width: "100%",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.03)",
        boxShadow: "0 10px 30px rgba(0,0,0,.25)",
      }}
    />
  );
}

function SkelButton() {
  return (
    <div
      style={{
        height: 36,
        width: "100%",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.04)",
        boxShadow: "0 12px 40px rgba(0,0,0,.25)",
      }}
    />
  );
}

function SkelRow() {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.02)",
        marginTop: 10,
      }}
    >
      <div
        style={{
          height: 26,
          width: 26,
          borderRadius: 10,
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.10)",
          flex: "0 0 auto",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 10, width: "55%", borderRadius: 999, background: "rgba(255,255,255,.08)" }} />
        <div style={{ height: 10, width: "35%", borderRadius: 999, background: "rgba(255,255,255,.06)", marginTop: 8 }} />
      </div>
      <div style={{ height: 10, width: 60, borderRadius: 999, background: "rgba(255,255,255,.06)" }} />
    </div>
  );
}
