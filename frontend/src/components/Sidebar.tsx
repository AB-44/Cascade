import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export interface SidebarItem {
  id: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

/**
 * Floating capsule nav, pinned to the reading-start edge (right in RTL,
 * left in LTR), sitting a bit above vertical center — the primary way
 * to reach the app's main sections (dashboard view + the Team/Projects/
 * Templates/Archive panels). Hidden below `sm` since it would otherwise
 * overlap page content on narrow screens; those sections stay one tap
 * away via their own panels either way.
 *
 * Hovering anywhere over the icon rail opens a companion panel next to it
 * showing every item's label with the active one marked by a leading bar.
 * The panel stays open while the pointer moves between the rail and the
 * panel itself, and only closes (after a short delay) once the pointer
 * leaves both.
 */
export default function Sidebar({ items }: { items: SidebarItem[] }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleEnter = () => {
    cancelClose();
    setOpen(true);
  };

  const handleLeave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      className="no-print fixed start-4 top-[38%] z-40 hidden -translate-y-1/2 sm:block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <nav
        className="relative z-[2] flex flex-col items-center gap-1 rounded-full border border-line bg-card/90 p-2 shadow-lg backdrop-blur-md"
        aria-label="Main"
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            title={item.label}
            aria-label={item.label}
            aria-current={item.active ? "page" : undefined}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 ${
              item.active
                ? "bg-terrace-600 text-white shadow-sm"
                : "text-ink-soft hover:bg-terrace-500/10 hover:text-terrace-700"
            }`}
          >
            <item.icon size={19} strokeWidth={2} />
          </button>
        ))}
      </nav>

      <div
        className={`absolute start-full top-0 z-[1] ms-2 flex w-44 flex-col gap-1 rounded-2xl border border-line bg-card/95 p-2 shadow-lg backdrop-blur-md transition-all duration-200 ${
          open
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-2 rtl:-translate-x-2 opacity-0"
        }`}
        aria-hidden={!open}
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            aria-current={item.active ? "page" : undefined}
            className={`relative flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm transition-colors duration-150 ${
              item.active
                ? "font-medium text-terrace-700"
                : "text-ink-soft hover:bg-terrace-500/10 hover:text-terrace-700"
            }`}
          >
            <span
              className={`absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-terrace-600 transition-opacity duration-150 ${
                item.active ? "opacity-100" : "opacity-0"
              }`}
            />
            <item.icon size={18} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
