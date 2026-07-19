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
 * left in LTR) and vertically centered — the primary way to reach the
 * app's main sections (dashboard view + the Team/Projects/Templates/
 * Archive panels). Hidden below `sm` since it would otherwise overlap
 * page content on narrow screens; those sections stay one tap away via
 * their own panels either way.
 */
export default function Sidebar({ items }: { items: SidebarItem[] }) {
  return (
    <nav
      className="no-print fixed start-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-full border border-line bg-card/90 p-2 shadow-lg backdrop-blur-md sm:flex"
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
  );
}
