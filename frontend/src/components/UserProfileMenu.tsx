import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Mail, User as UserIcon } from "lucide-react";
import { getStoredUser, fetchMe, logout, type CurrentUser } from "../lib/api";
import { t } from "../lib/i18n";
import { UserAvatar } from "./ProfilePanel";

export default function UserProfileMenu({
  lang,
  onOpenProfile,
}: {
  lang: "en" | "ar";
  onOpenProfile: () => void;
}) {
  const [user, setUser] = useState<CurrentUser | null>(() => getStoredUser());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => {
        /* keep showing the cached user; header still works offline */
      });
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg py-1 pe-1.5 ps-1 transition-colors duration-150 hover:bg-terrace-500/10"
      >
        <UserAvatar user={user} size={32} />
        <span className="hidden max-w-[120px] truncate text-sm font-semibold text-ink sm:inline">
          {user.name}
        </span>
        <ChevronDown
          size={14}
          className={`hidden text-ink-soft transition-transform duration-150 sm:inline ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute end-0 top-full z-40 mt-2 w-60 rounded-xl border border-line bg-card p-1.5 shadow-xl animate-menu-in">
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <UserAvatar user={user} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-ink-soft">
                <Mail size={11} />
                {user.email}
              </p>
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          <button
            onClick={() => {
              setOpen(false);
              onOpenProfile();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-terrace-500/10"
          >
            <UserIcon size={15} />
            {t(lang, "myProfile")}
          </button>
          <div className="my-1 border-t border-line" />
          <button
            onClick={async () => {
              await logout();
              window.location.reload();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-clay transition-colors duration-150 hover:bg-clay/10"
          >
            <LogOut size={15} />
            {t(lang, "logout")}
          </button>
        </div>
      )}
    </div>
  );
}
