export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function wrapIndex(index, length) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

export function relativeIndex(index, activeIndex, length) {
  if (!length) return 0;

  let diff = index - activeIndex;
  const half = Math.floor(length / 2);

  if (diff > half) diff -= length;
  if (diff < -half) diff += length;

  return diff;
}

export function slotConfig(slot) {
  if (slot === 0) {
    return {
      x: "0%",
      y: "0%",
      scale: 1,
      opacity: 1,
      zIndex: 40,
      filter: "blur(0px)",
      width: "min(72vw, 920px)",
      pointerEvents: "auto",
    };
  }

  if (slot === -1) {
    return {
      x: "-34%",
      y: "12%",
      scale: 0.78,
      opacity: 0.56,
      zIndex: 24,
      filter: "blur(1px)",
      width: "min(28vw, 360px)",
      pointerEvents: "auto",
    };
  }

  if (slot === 1) {
    return {
      x: "34%",
      y: "12%",
      scale: 0.78,
      opacity: 0.56,
      zIndex: 24,
      filter: "blur(1px)",
      width: "min(28vw, 360px)",
      pointerEvents: "auto",
    };
  }

  if (slot === -2) {
    return {
      x: "-52%",
      y: "17%",
      scale: 0.58,
      opacity: 0.16,
      zIndex: 10,
      filter: "blur(4px)",
      width: "min(20vw, 260px)",
      pointerEvents: "none",
    };
  }

  if (slot === 2) {
    return {
      x: "52%",
      y: "17%",
      scale: 0.58,
      opacity: 0.16,
      zIndex: 10,
      filter: "blur(4px)",
      width: "min(20vw, 260px)",
      pointerEvents: "none",
    };
  }

  return {
    x: "0%",
    y: "20%",
    scale: 0.4,
    opacity: 0,
    zIndex: 1,
    filter: "blur(8px)",
    width: "220px",
    pointerEvents: "none",
  };
}

export function capabilityRows() {
  return [
    { key: "strategy", label: "Strategy" },
    { key: "content", label: "Content" },
    { key: "funnels", label: "Funnels" },
    { key: "analytics", label: "Analytics" },
    { key: "messaging", label: "Messaging" },
    { key: "planning", label: "Planning" },
    { key: "social", label: "Social" },
    { key: "kpi", label: "KPI" },
  ];
}