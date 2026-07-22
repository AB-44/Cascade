import { useState } from "react";
import { AlertTriangle, Download, LogOut } from "lucide-react";
import { logout } from "./api";
import { hasLocalData, downloadLocalBackup } from "./storage";
import { useStore } from "../store";
import { t } from "./i18n";

/**
 * Logging out used to *always* silently download a backup file if
 * anything was cached locally — even when it was already fully synced.
 * For most people, most of the time, that meant an unexplained file
 * landing in Downloads on every sign-out: exactly the kind of thing that
 * makes an app look untrustworthy, and most people have no idea what to
 * do with the file anyway.
 *
 * Now it only asks when there's something genuinely at risk (sync status
 * isn't "synced" and there's local data to lose), and it's an explicit,
 * labeled choice — not a silent download.
 */
export function useLogoutFlow(lang: "en" | "ar") {
  const { syncStatus } = useStore();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async (skipAutoBackup: boolean) => {
    setBusy(true);
    try {
      await logout({ skipAutoBackup });
    } finally {
      window.location.reload();
    }
  };

  const requestLogout = () => {
    const atRisk = syncStatus !== "synced" && hasLocalData();
    if (atRisk) {
      setConfirmOpen(true);
    } else {
      // Nothing unsynced to protect — log out plainly, no file, no prompt.
      finish(true);
    }
  };

  const modal = confirmOpen && (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && setConfirmOpen(false)}
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-xl animate-scale-in">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-600">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-ink">
              {t(lang, "unsyncedBackupTitle")}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">{t(lang, "unsyncedBackupBody")}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={() => {
              downloadLocalBackup();
              finish(true);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-terrace-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-terrace-700 disabled:opacity-60"
          >
            <Download size={15} />
            {t(lang, "downloadAndLogout")}
          </button>
          <button
            disabled={busy}
            onClick={() => finish(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3.5 py-2.5 text-sm font-semibold text-ink-soft transition-colors duration-150 hover:bg-ink/5 disabled:opacity-60"
          >
            <LogOut size={15} />
            {t(lang, "logoutWithoutBackup")}
          </button>
          <button
            disabled={busy}
            onClick={() => setConfirmOpen(false)}
            className="w-full rounded-lg px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5 disabled:opacity-60"
          >
            {t(lang, "cancel")}
          </button>
        </div>
      </div>
    </div>
  );

  return { requestLogout, modal };
}
