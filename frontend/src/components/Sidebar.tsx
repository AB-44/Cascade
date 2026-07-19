import type { LucideIcon } from "lucide-react";
import { Waves } from "lucide-react";

export interface SidebarItem {
  id: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

/**
 * Full-height icon rail docked to the reading-start edge (right in RTL,
 * left in LTR) — the primary way to reach the app's main sections
 * (dashboard view + the Team/Projects/Templates/Archive/Profile panels).
 * Hidden below `sm` since it would otherwise eat too much width on narrow
 * screens; those sections stay reachable via the header's own menus there.
 */
export default function Sidebar({ items }: { items: SidebarItem[] }) {
  return (
    <nav
      className="no-print fixed inset-y-0 start-0 z-40 hidden w-[76px] flex-col items-center border-e border-line bg-card py-4 sm:flex"
      aria-label="Main"
    >
      <div className="terrace-card flex h-10 w-10 shrink-0 items-center justify-center bg-terrace-700 text-terrace-50 shadow-sm">
        <Waves size={19} />
      </div>

      <div className="mt-6 flex flex-1 flex-col items-center gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            title={item.label}
            aria-label={item.label}
            aria-current={item.active ? "page" : undefined}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150 ${
              item.active
                ? "bg-terrace-600 text-white shadow-sm"
                : "text-ink-soft hover:bg-terrace-500/10 hover:text-terrace-700"
            }`}
          >
            <item.icon size={19} strokeWidth={2} />
          </button>
        ))}
      </div>
    </nav>
  );
}
