import React from "react";

export default function AdminStub({ title }: { title: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.03)",
        boxShadow: "0 18px 60px rgba(0,0,0,.30)",
        backdropFilter: "blur(10px)",
        padding: 16,
        color: "rgba(255,255,255,.85)",
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
      <div style={{ marginTop: 8, opacity: 0.7 }}>
        Bu tab hazır skeletdir. Növbəti addım: backend endpoint-lər + UI.
      </div>
    </div>
  );
}
