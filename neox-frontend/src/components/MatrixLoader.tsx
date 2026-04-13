import { useEffect, useRef, useState } from "react";

export default function MatrixLoader({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const letters = "01AI#$%NEOX";
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "rgba(0, 180, 255, 0.6)";
      ctx.font = `${fontSize}px monospace`;

      drops.forEach((y, i) => {
        const text = letters[Math.floor(Math.random() * letters.length)];
        ctx.fillText(text, i * fontSize, y * fontSize);

        if (y * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      });
    };

    const interval = setInterval(draw, 33);

    // 🧠 Matrix bitsin → KEÇİD BAŞLASIN
    const transitionTimer = setTimeout(() => {
      setExiting(true);
    }, 3200);

    // ⏭ əsas səhifə
    const doneTimer = setTimeout(onDone, 3800);

    return () => {
      clearInterval(interval);
      clearTimeout(transitionTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-black transition-all duration-700 ease-in-out
        ${exiting ? "scale-110 opacity-0" : "scale-100 opacity-100"}
      `}
    >
      {/* subtle scan flash */}
      {exiting && (
        <div className="absolute inset-0 bg-white opacity-5 animate-pulse pointer-events-none" />
      )}

      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
  
