import { useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, CalendarClock, BellRing, Coffee, X } from "lucide-react";
import { useReminders, requestNotificationPermission } from "../lib/useReminders";
import { useStore } from "../store";
import { t } from "../lib/i18n";

export default function NotificationBell({ onGoto }: { onGoto: (id: string) => void }) {
  const { items, dismiss } = useReminders();
  const { lang } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const count = items.length;

  const icon = (kind: string) => {
    if (kind === "overdue") return <AlertTriangle size={15} className="text-red-500" />;
    if (kind === "reminder") return <BellRing size={15} className="text-terrace-500" />;
    if (kind === "break") return <Coffee size={15} className="text-emerald-500" />;
    return <CalendarClock size={15} className="text-amber-500" />;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          requestNotificationPermission();
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-basin-2"
      >
        <Bell size={19} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-card shadow-xl animate-menu-in">
          <div className="border-b border-line px-4 py-3 text-sm font-bold text-ink">
            {t(lang, "notifications")}
          </div>
          <div className="max-h-80 overflow-y-auto p-3">
            {count === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-ink-soft">{t(lang, "allCaughtUp")}</p>
            ) : (
              <div className="notif-stack" data-peek={items.length > 1}>
                {items.slice(0, 3).map((it) => {
                  const index = items.indexOf(it);
                  return (
                    <div
                      key={it.key}
                      style={{ zIndex: 3 - index }}
                      className="terrace-card notif-stack-card group relative flex w-full items-center gap-3 px-4 py-3"
                    >
                      <button
                        onClick={() => {
                          onGoto(it.goal.id);
                          setOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-start"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card">
                          {icon(it.kind)}
                        </span>
                        <span className="min-w-0 text-sm text-ink">{it.text}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(it.key);
                        }}
                        aria-label={t(lang, "dismissNotification")}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-soft opacity-0 transition hover:bg-basin-2 hover:text-ink group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {count > 3 && (
              <p className="mt-2 px-2 text-center text-xs text-ink-soft">
                +{count - 3} {t(lang, "notifications")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
