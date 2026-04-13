import React, { useEffect, useMemo, useState } from "react";

type Props = {
  children: React.ReactNode;

  /** Intro (logo/intro screen) komponenti */
  Intro: React.ComponentType<{ onDone: () => void }>;

  /** Loader komponenti (məs: progress / spinner) */
  Loader: React.ComponentType;

  /** localStorage açarı */
  storageKey?: string;

  /** intro minimum görünmə (ms) */
  introMs?: number;

  /** loader minimum görünmə (ms) */
  loaderMs?: number;
};

export default function IntroGate({
  children,
  Intro,
  Loader,
  storageKey = "neox_intro_seen_v1",
  introMs = 1100,
  loaderMs = 650,
}: Props) {
  const alreadySeen = useMemo(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  }, [storageKey]);

  const [phase, setPhase] = useState<"ready" | "intro" | "loader">(
    alreadySeen ? "ready" : "intro"
  );

  // Intro minimum vaxt + sonra loader
  useEffect(() => {
    if (phase !== "intro") return;
    const t = window.setTimeout(() => setPhase("loader"), introMs);
    return () => window.clearTimeout(t);
  }, [phase, introMs]);

  // Loader minimum vaxt + sonra app, və artıq seen yaz
  useEffect(() => {
    if (phase !== "loader") return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, "1");
      } catch {}
      setPhase("ready");
    }, loaderMs);
    return () => window.clearTimeout(t);
  }, [phase, loaderMs, storageKey]);

  // Intro komponentində “Skip / Done” kimi düymə istəsən:
  const onIntroDone = () => setPhase("loader");

  if (phase === "intro") return <Intro onDone={onIntroDone} />;
  if (phase === "loader") return <Loader />;

  return <>{children}</>;
}
