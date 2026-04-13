import React, { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Hotspot = {
  key: string;
  label: string;
  top: string;
  left: string;
  width: string;
  height: string;
  onClick: () => void;
};

export default function Lift() {
  const navigate = useNavigate();
  const { lang } = useParams<{ lang?: string }>();
  const safeLang = (lang || "en").toLowerCase();

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBg = document.body.style.backgroundColor;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.backgroundColor = "#000";

    return () => {
      document.body.style.overflow = prevBodyOverflow || "";
      document.documentElement.style.overflow = prevHtmlOverflow || "";
      document.documentElement.style.overscrollBehavior = prevOverscroll || "";
      document.body.style.backgroundColor = prevBg || "";
    };
  }, []);

  const bgDesktop =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771330211/ChatGPT_Image_Feb_17_2026_04_07_23_PM_qa5qtr.webp";
  const bgMobile =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771330209/ChatGPT_Image_Feb_17_2026_04_09_24_PM_d6lrjb.webp";

  const goReceptionScene = () =>
    navigate(`/${safeLang}`, {
      state: { scrollTo: "inside-1" },
      replace: false,
    });

  const goHome = () => navigate(`/${safeLang}`);

  const goServices = () => navigate(`/${safeLang}/services`);
  const goUseCases = () => navigate(`/${safeLang}/use-cases`);
  const goFaq = () => navigate(`/${safeLang}/faq`);
  const goBlog = () => navigate(`/${safeLang}/blog`);
  const goContact = () => navigate(`/${safeLang}/contact`);

  const hotspots: Hotspot[] = useMemo(
    () => [
      { key: "reception", label: "Reception", top: "23.2%", left: "42.2%", width: "24.5%", height: "7.2%", onClick: goReceptionScene },
      { key: "services", label: "Services", top: "32.3%", left: "42.2%", width: "24.5%", height: "7.2%", onClick: goServices },
      { key: "usecases", label: "Use Cases", top: "41.4%", left: "42.2%", width: "24.5%", height: "7.2%", onClick: goUseCases },
      { key: "faq", label: "FAQ", top: "50.6%", left: "42.2%", width: "24.5%", height: "7.2%", onClick: goFaq },
      { key: "blog", label: "Blog", top: "59.8%", left: "42.2%", width: "24.5%", height: "7.2%", onClick: goBlog },
      { key: "contact", label: "Contact", top: "78.2%", left: "42.2%", width: "24.5%", height: "7.2%", onClick: goContact },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safeLang]
  );

  const killFocusScroll = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-black text-white">
      <section className="relative h-full w-full overflow-hidden">
        <div className="absolute inset-0 hidden bg-center bg-cover bg-no-repeat sm:block" style={{ backgroundImage: `url(${bgDesktop})` }} />
        <div className="absolute inset-0 bg-center bg-cover bg-no-repeat sm:hidden" style={{ backgroundImage: `url(${bgMobile})` }} />

        <div className="absolute left-4 top-4 z-30 sm:left-6 sm:top-6">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] text-white/85">
            İstədiyin mərtəbəyə keçid
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onMouseDown={killFocusScroll}
              onClick={goHome}
              className="rounded-2xl border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-black/45 sm:text-sm"
            >
              Home
            </button>

            <button
              type="button"
              onMouseDown={killFocusScroll}
              onClick={goReceptionScene}
              className="rounded-2xl border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-black/45 sm:text-sm"
            >
              Reception
            </button>
          </div>
        </div>

        {hotspots.map((h) => (
          <button
            key={h.key}
            type="button"
            aria-label={h.label}
            onMouseDown={killFocusScroll}
            onClick={h.onClick}
            className="absolute z-20"
            style={{
              top: h.top,
              left: h.left,
              width: h.width,
              height: h.height,
              background: "transparent",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
            }}
          />
        ))}
      </section>
    </div>
  );
}
