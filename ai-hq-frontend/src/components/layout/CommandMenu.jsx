import { Command } from "cmdk";
import { Button } from "antd";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ALL_SECTIONS } from "./shellNavigation.js";

function flattenItems() {
  const items = [];

  for (const section of ALL_SECTIONS) {
    items.push({
      id: section.id,
      label: section.label,
      description: section.description,
      value: `${section.label} ${section.kicker} ${section.description}`,
      to: section.to,
    });

    for (const group of section.contextGroups || []) {
      for (const item of group.items || []) {
        if (!item.to) continue;
        items.push({
          id: `${section.id}-${item.to}`,
          label: item.label,
          description: group.title,
          value: `${item.label} ${group.title} ${section.label}`,
          to: item.to,
        });
      }
    }
  }

  return items;
}

export default function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const items = useMemo(() => flattenItems(), []);

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
        className="hidden !h-11 !rounded-[14px] !border-line !bg-surface !px-4 !text-text-muted !shadow-none hover:!border-line-strong hover:!bg-surface-muted hover:!text-text md:!inline-flex"
        icon={<Search className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        Search or jump
        <span className="ml-3 rounded-[10px] border border-line bg-canvas px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          Ctrl K
        </span>
      </Button>

      <Command.Dialog open={open} onOpenChange={setOpen} label="Command menu">
        <div className="fixed inset-0 z-[140] bg-overlay/60 backdrop-blur-[8px]" />
        <div className="fixed left-1/2 top-[16vh] z-[150] w-[min(680px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[28px] border border-line bg-surface shadow-panel-strong">
          <Command className="w-full">
            <div className="border-b border-line-soft px-4 py-4">
              <div className="flex items-center gap-3 rounded-[16px] border border-line bg-surface-muted px-4">
                <Search className="h-4 w-4 text-text-subtle" />
                <Command.Input
                  placeholder="Search pages, tools, and workspaces"
                  className="h-12 w-full border-0 bg-transparent p-0 text-[15px] text-text outline-none placeholder:text-text-subtle"
                />
              </div>
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto p-3">
              <Command.Empty className="px-3 py-10 text-center text-sm text-text-muted">
                No matching destinations found.
              </Command.Empty>

              {ALL_SECTIONS.map((section) => (
                <Command.Group
                  key={section.id}
                  heading={section.label}
                  className="mb-2 overflow-hidden rounded-[20px] border border-transparent p-1 text-text"
                >
                  {items
                    .filter(
                      (item) =>
                        item.id === section.id ||
                        (section.contextGroups || []).some((group) =>
                          (group.items || []).some((groupItem) => groupItem.to === item.to)
                        )
                    )
                    .map((item) => (
                      <Command.Item
                        key={item.id}
                        value={item.value}
                        onSelect={() => {
                          navigate(item.to);
                          setOpen(false);
                        }}
                        className="group flex cursor-pointer items-center justify-between rounded-[16px] px-3 py-3 text-sm outline-none data-[selected=true]:bg-brand-soft"
                      >
                        <div>
                          <div className="font-semibold text-text">{item.label}</div>
                          <div className="text-xs text-text-muted">{item.description}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-text-subtle transition group-data-[selected=true]:text-brand" />
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
