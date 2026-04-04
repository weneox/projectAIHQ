import { Command } from "cmdk";
import { Button } from "antd";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ALL_SECTIONS } from "./shellNavigation.js";

function buildCommandGroups() {
  return ALL_SECTIONS.map((section) => {
    const seen = new Set();
    const items = [];

    const primaryValue = `${section.label} ${section.kicker || ""} ${section.description || ""}`
      .trim()
      .toLowerCase();

    items.push({
      id: section.id,
      label: section.label,
      description: section.description,
      value: primaryValue,
      to: section.to,
    });

    seen.add(section.to);

    for (const group of section.contextGroups || []) {
      for (const item of group.items || []) {
        if (!item.to || seen.has(item.to)) continue;

        seen.add(item.to);
        items.push({
          id: `${section.id}-${item.to}`,
          label: item.label,
          description: group.title,
          value: `${item.label} ${group.title} ${section.label}`
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
      <Button
        size="large"
        className="hidden !h-10 !rounded-[13px] !border-line !bg-surface !px-4 !text-text-muted !shadow-none hover:!border-line-strong hover:!bg-surface-muted hover:!text-text md:!inline-flex"
        icon={<Search className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        Search
        <span className="ml-3 rounded-[9px] border border-line bg-canvas px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          Ctrl K
        </span>
      </Button>

      <Command.Dialog open={open} onOpenChange={setOpen} label="Command menu">
        <div className="fixed inset-0 z-[140] bg-[rgba(15,23,42,0.18)] backdrop-blur-[6px]" />

        <div className="fixed left-1/2 top-[14vh] z-[150] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_36px_90px_-40px_rgba(15,23,42,0.34)]">
          <Command className="w-full">
            <div className="border-b border-line-soft px-4 py-4">
              <div className="flex items-center gap-3 rounded-[16px] bg-surface-muted px-4">
                <Search className="h-4 w-4 text-text-subtle" />
                <Command.Input
                  placeholder="Search pages and tools"
                  className="h-12 w-full border-0 bg-transparent p-0 text-[15px] text-text outline-none placeholder:text-text-subtle"
                />
              </div>
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto p-3">
              <Command.Empty className="px-3 py-10 text-center text-sm text-text-muted">
                No matching destinations found.
              </Command.Empty>

              {groups.map((group) => (
                <Command.Group
                  key={group.id}
                  heading={group.label}
                  className="mb-3 overflow-hidden rounded-[18px] p-1 text-text"
                >
                  <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                    {group.label}
                  </div>

                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.value}
                      onSelect={() => {
                        navigate(item.to);
                        setOpen(false);
                      }}
                      className="group flex cursor-pointer items-center justify-between rounded-[14px] px-3 py-3 text-sm outline-none data-[selected=true]:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-text">
                          {item.label}
                        </div>
                        {item.description ? (
                          <div className="truncate text-xs text-text-muted">
                            {item.description}
                          </div>
                        ) : null}
                      </div>

                      <ArrowRight className="h-4 w-4 shrink-0 text-text-subtle transition group-data-[selected=true]:translate-x-[1px] group-data-[selected=true]:text-brand" />
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