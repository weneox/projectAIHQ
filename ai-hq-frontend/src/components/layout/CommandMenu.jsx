import { Command } from "cmdk";
import { ArrowRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { ALL_SECTIONS } from "./shellNavigation.js";

function buildCommandGroups() {
  return ALL_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    items: [
      {
        id: section.id,
        label: section.label,
        value: String(section.label || "").trim().toLowerCase(),
        to: section.to,
      },
    ],
  })).filter((group) => group.items.length > 0);
}

export default function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [openedAtPath, setOpenedAtPath] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const groups = useMemo(() => buildCommandGroups(), []);
  const dialogOpen = open && openedAtPath === location.pathname;

  const openMenu = useCallback(() => {
    setOpenedAtPath(location.pathname);
    setOpen(true);
  }, [location.pathname]);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (nextOpen) {
        openMenu();
        return;
      }
      closeMenu();
    },
    [closeMenu, openMenu]
  );

  useEffect(() => {
    function onKeyDown(event) {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.key.toLowerCase() !== "k") return;

      event.preventDefault();

      if (dialogOpen) {
        closeMenu();
        return;
      }

      openMenu();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMenu, dialogOpen, openMenu]);

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        aria-label="Open search"
        aria-expanded={dialogOpen}
        className={cx(
          "hidden h-9 min-w-[260px] items-center gap-2 rounded-soft border border-line bg-surface px-3 text-left text-text-muted transition-colors md:inline-flex lg:min-w-[300px] xl:min-w-[340px]",
          "hover:border-line-strong hover:bg-surface-subtle hover:text-text"
        )}
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.9} />
        <span className="truncate text-[13px]">Search pages</span>
        <span className="ml-auto shrink-0 text-[12px] text-text-subtle">
          Ctrl K
        </span>
      </button>

      <Command.Dialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        label="Command menu"
      >
        <div className="command-overlay-anim fixed inset-0 z-[140] bg-overlay/60" />

        <div className="command-panel-anim fixed left-1/2 top-[10vh] z-[150] w-[min(560px,calc(100vw-24px))] -translate-x-1/2">
          <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel-strong">
            <Command className="relative w-full">
              <div className="border-b border-line-soft px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Search
                    className="h-4 w-4 shrink-0 text-text-subtle"
                    strokeWidth={1.9}
                  />

                  <Command.Input
                    placeholder="Search pages"
                    className="h-8 w-full border-0 bg-transparent p-0 text-[14px] text-text outline-none placeholder:text-text-subtle"
                  />
                </div>
              </div>

              <Command.List className="command-scroll max-h-[360px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-[13px] text-text-muted">
                  No results
                </Command.Empty>

                {groups.map((group, groupIndex) => (
                  <Command.Group
                    key={group.id}
                    heading={group.label}
                    className={cx(
                      "px-1",
                      groupIndex > 0 && "mt-2 border-t border-line-soft pt-2"
                    )}
                  >
                    {group.items.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={item.value}
                        onSelect={() => {
                          navigate(item.to);
                          closeMenu();
                        }}
                        className={cx(
                          "group flex cursor-pointer items-center justify-between gap-3 rounded-soft px-3 py-2.5 text-[13px] text-text outline-none transition-colors",
                          "data-[selected=true]:bg-surface-subtle"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{item.label}</div>
                        </div>

                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-text-subtle transition-transform group-data-[selected=true]:translate-x-[2px]"
                          strokeWidth={1.9}
                        />
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </div>
        </div>
      </Command.Dialog>
    </>
  );
}
