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
        value: `${section.label}`.trim().toLowerCase(),
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
          "hidden h-11 min-w-[300px] items-center gap-3 rounded-[14px] border border-line bg-white px-4 text-left transition duration-200 md:inline-flex lg:min-w-[340px] xl:min-w-[390px]",
          "text-[rgba(15,23,42,0.92)] hover:border-line-strong hover:bg-surface-muted"
        )}
      >
        <Search
          className="h-[16px] w-[16px] shrink-0 text-[rgba(15,23,42,0.42)]"
          strokeWidth={2}
        />
        <span className="truncate text-[14px] font-semibold tracking-[-0.02em]">
          Search workspace
        </span>
      </button>

      <Command.Dialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        label="Command menu"
      >
        <div className="command-overlay-anim fixed inset-0 z-[140] bg-[rgba(15,23,42,0.18)] backdrop-blur-[6px]" />

        <div className="command-panel-anim fixed left-1/2 top-[10vh] z-[150] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_24px_48px_-30px_rgba(15,23,42,0.18)]">
          <Command className="relative w-full">
            <div className="px-4 pb-2 pt-4">
              <div className="flex items-center gap-3 border-b border-line-soft pb-3">
                <Search
                  className="h-[16px] w-[16px] shrink-0 text-[rgba(15,23,42,0.42)]"
                  strokeWidth={2}
                />

                <Command.Input
                  placeholder="Search pages"
                  className="h-10 w-full border-0 bg-transparent p-0 text-[15px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.95)] outline-none placeholder:font-medium placeholder:text-[rgba(15,23,42,0.42)]"
                />
              </div>
            </div>

            <Command.List className="command-scroll max-h-[360px] overflow-y-auto px-2 pb-2">
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
                    groupIndex > 0 ? "mt-2 border-t border-line-soft pt-2" : "pt-1"
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
                        "group flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 outline-none transition duration-150",
                        "data-[selected=true]:bg-surface-subtle"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.94)]">
                          {item.label}
                        </div>
                      </div>

                      <ArrowRight
                        className="h-[15px] w-[15px] shrink-0 text-[rgba(15,23,42,0.3)] transition duration-200 group-data-[selected=true]:translate-x-[2px] group-data-[selected=true]:text-[rgba(31,77,168,0.95)]"
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