import { Command } from "cmdk";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { ALL_SECTIONS } from "./shellNavigation.js";

function buildCommandGroups() {
  return ALL_SECTIONS.map((section) => {
    const seen = new Set();
    const items = [];

    if (section.to) {
      seen.add(section.to);
      items.push({
        id: section.id,
        label: section.label,
        value: `${section.label} ${section.kicker || ""} ${section.description || ""}`
          .trim()
          .toLowerCase(),
        to: section.to,
      });
    }

    for (const group of section.contextGroups || []) {
      for (const item of group.items || []) {
        if (!item?.to || seen.has(item.to)) continue;

        seen.add(item.to);
        items.push({
          id: `${section.id}-${item.to}`,
          label: item.label,
          value: `${item.label} ${group.title || ""} ${section.label} ${section.description || ""}`
            .trim()
            .toLowerCase(),
          to: item.to,
        });
      }
    }

    return {
      id: section.id,
      label: section.label,
      items,
    };
  }).filter((group) => group.items.length > 0);
}

export default function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const groups = useMemo(() => buildCommandGroups(), []);

  useEffect(() => {
    function onKeyDown(event) {
      const isModifier = event.metaKey || event.ctrlKey;
      if (isModifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
        aria-expanded={open}
        className={cx(
          "hidden h-11 w-[252px] items-center gap-3 rounded-[16px] px-4 text-left transition duration-200 md:inline-flex lg:w-[304px] xl:w-[360px]",
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,253,0.995)_100%)]",
          "text-[rgba(15,23,42,0.88)]",
          "shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
          "hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08),0_14px_28px_-24px_rgba(15,23,42,0.16)]"
        )}
      >
        <Search
          className="h-[15px] w-[15px] shrink-0 text-[rgba(15,23,42,0.46)]"
          strokeWidth={2}
        />
        <span className="truncate text-[13px] font-semibold tracking-[-0.02em]">
          Search workspace
        </span>
      </button>

      <Command.Dialog open={open} onOpenChange={setOpen} label="Command menu">
        <div className="command-overlay-anim fixed inset-0 z-[140] bg-[rgba(243,246,250,0.64)] backdrop-blur-[10px]" />

        <div className="command-panel-anim fixed left-1/2 top-[10vh] z-[150] w-[min(660px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(248,250,253,0.998)_100%)] shadow-[0_36px_110px_-40px_rgba(15,23,42,0.28)] backdrop-blur-xl">
          <Command className="relative w-full">
            <div className="px-5 pb-2 pt-4">
              <div className="flex items-center gap-3 border-b border-[rgba(15,23,42,0.075)] pb-3">
                <Search
                  className="h-[16px] w-[16px] shrink-0 text-[rgba(15,23,42,0.42)]"
                  strokeWidth={2}
                />

                <Command.Input
                  placeholder="Search pages and tools"
                  className="h-10 w-full border-0 bg-transparent p-0 text-[15px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.95)] outline-none placeholder:font-medium placeholder:text-[rgba(15,23,42,0.42)]"
                />
              </div>
            </div>

            <Command.List className="command-scroll max-h-[388px] overflow-y-auto px-2 pb-2">
              <Command.Empty className="px-6 py-12 text-center">
                <div className="text-[14px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.84)]">
                  No results
                </div>
              </Command.Empty>

              {groups.map((group, groupIndex) => (
                <Command.Group
                  key={group.id}
                  heading={group.label}
                  className={cx(
                    groupIndex > 0
                      ? "mt-2 border-t border-[rgba(15,23,42,0.06)] pt-2"
                      : "pt-1"
                  )}
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.value}
                      onSelect={() => {
                        navigate(item.to);
                        setOpen(false);
                      }}
                      className={cx(
                        "group flex cursor-pointer items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 outline-none transition duration-150",
                        "data-[selected=true]:bg-[rgba(15,23,42,0.05)]"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.94)]">
                          {item.label}
                        </div>
                      </div>

                      <ArrowRight
                        className="h-[15px] w-[15px] shrink-0 text-[rgba(15,23,42,0.3)] transition duration-200 group-data-[selected=true]:translate-x-[2px] group-data-[selected=true]:text-[rgba(38,76,165,0.95)]"
                        strokeWidth={2}
                      />
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      </Command.Dialog>
    </>
  );
}