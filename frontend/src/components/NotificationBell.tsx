import { useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, CalendarClock, BellRing, Coffee, Settings, ArrowLeft, X } from "lucide-react";
import { useReminders, requestNotificationPermission, type ReminderItem } from "../lib/useReminders";
import { useStore } from "../store";
import { t } from "../lib/i18n";

const KIND_STYLE: Record<
  ReminderItem["kind"],
  { accent: string; iconColor: string; icon: typeof AlertTriangle }
> = {
  overdue: { accent: "#B04632", iconColor: "text-clay", icon: AlertTriangle },
  today: { accent: "#C9973B", iconColor: "text-gold-600", icon: CalendarClock },
  soon: { accent: "#C9973B", iconColor: "text-gold-600", icon: CalendarClock },
  reminder: { accent: "#1F6E5C", iconColor: "text-terrace-600", icon: BellRing },
  break: { accent: "#1F6E5C", iconColor: "text-terrace-600", icon: Coffee },
};

const PAGE_SIZE = 3;

export default function NotificationBell({ onGoto }: { onGoto: (id: string) => void }) {
  const { items, dismiss } = useReminders();
  const { lang } = useStore();
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Reset how many are shown each time the panel is reopened, so it
  // doesn't stay expanded from a previous session.
  useEffect(() => {
    if (open) setVisibleCount(PAGE_SIZE);
  }, [open]);

  const count = items.length;
  const visibleItems = items.slice(0, visibleCount);
  const hasMore = count > visibleCount;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          requestNotificationPermission();
        }}
        className="topbar-nav-item relative inline-flex h-9 items-center justify-center gap-0 rounded-lg px-2 text-ink-soft hover:bg-basin-2"
      >
        <Bell size={19} className="shrink-0" />
        <span className="topbar-nav-text text-sm font-medium">{t(lang, "notifications")}</span>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-line bg-card shadow-xl animate-menu-in">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-bold text-ink">{t(lang, "notifications")}</span>
            <button
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-xs font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
            >
              {t(lang, "closeAll")}
              <ArrowLeft size={13} className="rtl:rotate-180" />
            </button>
          </div>

          {count === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-basin-2 text-ink-soft">
                <Bell size={20} />
              </span>
              <p className="text-sm font-semibold text-ink">{t(lang, "noNewNotifications")}</p>
              <p className="text-xs text-ink-soft">{t(lang, "allCaughtUp")}</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto p-2.5">
              <div className="space-y-2">
                {visibleItems.map((it) => {
                  const style = KIND_STYLE[it.kind];
                  const Icon = style.icon;
                  return (
                    <div
                      key={it.key}
                      className="group relative flex items-stretch gap-3 overflow-hidden rounded-lg bg-basin-2/50 ps-4 pe-2 py-2.5 transition-colors duration-150 hover:bg-basin-2"
                    >
                      <span
                        className="absolute inset-y-0 start-0 w-1 rounded-e-full"
                        style={{ backgroundColor: style.accent }}
                      />
                      <button
                        onClick={() => {
                          onGoto(it.goal.id);
                          setOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-start gap-2.5 text-start"
                      >
                        <span className={`mt-0.5 shrink-0 ${style.iconColor}`}>
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{it.text}</span>
                          {it.detail && (
                            <span className="mt-0.5 block truncate text-xs text-ink-soft">{it.detail}</span>
                          )}
                        </span>
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terrace-500" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(it.key);
                        }}
                        aria-label={t(lang, "dismissNotification")}
                        className="flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full text-ink-soft opacity-0 transition-opacity duration-150 hover:bg-card hover:text-ink group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {(hasMore || visibleCount > PAGE_SIZE) && (
                <button
                  onClick={() =>
                    hasMore ? setVisibleCount((c) => c + PAGE_SIZE) : setVisibleCount(PAGE_SIZE)
                  }
                  className="mt-2 w-full rounded-lg py-2 text-center text-xs font-medium text-ink-soft transition-colors duration-150 hover:bg-basin-2 hover:text-ink"
                >
                  {hasMore ? `+${count - visibleCount} ${t(lang, "notifications")}` : t(lang, "showLess")}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <Settings size={13} />
              {t(lang, "settings")}
            </span>
            {count > PAGE_SIZE && (
              <button
                onClick={() => setVisibleCount(hasMore ? count : PAGE_SIZE)}
                className="flex items-center gap-1 text-xs font-medium text-terrace-600 transition-colors duration-150 hover:text-terrace-700"
              >
                {hasMore ? t(lang, "viewAllNotifications") : t(lang, "showLess")}
                <ArrowLeft size={13} className="rtl:rotate-180" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
