import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export default function IntroScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();

  // i18n mətnlər (locale dəyişəndə avtomatik yenilənəcək)
  const wakeText = useMemo(() => t("intro.wakeText"), [t]);
  const mainText = useMemo(() => t("intro.mainText"), [t]);

  const [text, setText] = useState("");
  const [mode, setMode] = useState<"wake" | "main">("wake");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("/type.mp3");
    audioRef.current.volume = 0.18;
  }, []);

  // Locale dəyişəndə intro-nu təmiz restart et (istəmirsənsə, bunu silə bilərik)
  useEffect(() => {
    setText("");
    setMode("wake");
  }, [wakeText, mainText]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    timeout = setTimeout(() => {
      if (mode === "wake") {
        let i = 0;
        interval = setInterval(() => {
          setText(wakeText.slice(0, i + 1));
          audioRef.current?.play().catch(() => {});
          i++;

          if (i === wakeText.length) {
            if (interval) clearInterval(interval);
            setMode("main");
          }
        }, 120);
      }

      if (mode === "main") {
        let i = 0;
        setText("");

        interval = setInterval(() => {
          setText(mainText.slice(0, i + 1));
          if (i % 2 === 0) audioRef.current?.play().catch(() => {});
          i++;

          if (i === mainText.length) {
            if (interval) clearInterval(interval);
            setTimeout(onDone, 1500);
          }
        }, 45);
      }
    }, 700);

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [mode, onDone, wakeText, mainText]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Matrix background səndə necədirsə elə qalır */}

      <div
        className="
          absolute
          top-6 left-6
          max-w-[94vw] sm:max-w-[520px]
          font-mono font-bold
          text-[14px] sm:text-[18px]
          leading-snug
          text-cyan-400/90
          whitespace-nowrap
          overflow-hidden
          drop-shadow-[0_0_12px_rgba(34,197,94,0.35)]
        "
      >
        {text}
        <span className="animate-pulse">▌</span>
      </div>
    </div>
  );
}
