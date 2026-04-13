import React, { useEffect, useRef, useState } from "react";

export default function LazyMount({
  children,
  rootMargin = "240px 0px",
  minHeight = 120,
  immediate = false, // əlavə
}: {
  children: React.ReactNode;
  rootMargin?: string;
  minHeight?: number;
  immediate?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [on, setOn] = useState(immediate);

  useEffect(() => {
    if (immediate) {
      setOn(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    // əgər IO yoxdur (köhnə browser) → göstər
    if (typeof IntersectionObserver === "undefined") {
      setOn(true);
      return;
    }

    let raf = 0;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    io.observe(el);

    // route dəyişəndə bəzən IO “miss” edir → 1 frame sonra yoxla
    raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      if (r.top < vh + 300 && r.bottom > -300) setOn(true);
    });

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [rootMargin, immediate]);

  return (
    <div ref={ref} style={{ minHeight }}>
      {on ? children : null}
    </div>
  );
}
