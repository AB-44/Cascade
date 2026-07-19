import { useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, CalendarClock, BellRing, Coffee } from "lucide-react";
import { useReminders, requestNotificationPermission } from "../lib/useReminders";
import { useStore } from "../store";
import { t } from "../lib/i18n";

export default function NotificationBell({ onGoto }: { onGoto: (id: string) => void }) {
  const items = useReminders();
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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <Bell size={19} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-menu-in dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 dark:border-slate-700 dark:text-white">
            {t(lang, "notifications")}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {count === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">{t(lang, "allCaughtUp")}</p>
            ) : (
              items.map((it, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onGoto(it.goal.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-start transition last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/50"
                >
                  {icon(it.kind)}
                  <span className="text-sm text-slate-700 dark:text-slate-200">{it.text}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
