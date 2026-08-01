import { useEffect } from "react";
import { X, type LucideIcon } from "lucide-react";

interface ConfirmModalProps {
  /** Icon shown in the circular badge at the top — pass the action's own
   *  icon (e.g. Archive). A small warning glyph is layered on top of it
   *  automatically, so callers don't need a combined icon asset. */
  icon: LucideIcon;
  title: string;
  message: string;
  /** Label for the destructive/primary action button. */
  confirmLabel: string;
  cancelLabel: string;
  /** Optional reassurance line shown under a divider in the footer,
   *  e.g. "You can restore this later from the archive." Omit if the
   *  action has no such safety net. */
  footnote?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Defaults to false — most confirmations here are recoverable
   *  (archive, remove-from-list) rather than permanent deletions, so the
   *  primary button uses the app's normal terrace green unless this is
   *  set for a genuinely irreversible action. */
  destructive?: boolean;
}

export default function ConfirmModal({
  icon: Icon,
  title,
  message,
  confirmLabel,
  cancelLabel,
  footnote,
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const accentText = destructive ? "text-clay" : "text-terrace-600";
  const accentBg = destructive ? "bg-clay/12" : "bg-terrace-500/12";
  const confirmBtnCls = destructive
    ? "bg-clay text-white shadow-sm hover:bg-clay/90"
    : "bg-terrace-600 text-white shadow-sm hover:bg-terrace-700";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="terrace-card relative w-full max-w-md overflow-hidden bg-card p-6 text-center shadow-2xl animate-scale-in">
        <button
          onClick={onCancel}
          className="absolute end-4 top-4 rounded-lg bg-basin-2 p-2 text-ink-soft transition-colors duration-150 hover:bg-ink/10 hover:text-ink"
        >
          <X size={16} />
        </button>

        <div className={`relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${accentBg}`}>
          <Icon size={26} className={accentText} />
          <span className="absolute -bottom-0.5 -end-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold-500 text-card ring-2 ring-card">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
        </div>

        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">{message}</p>

        <div className="mt-5 flex gap-2.5 border-t border-line pt-5">
          <button
            onClick={onConfirm}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${confirmBtnCls}`}
          >
            <Icon size={16} />
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
        </div>

        {footnote && (
          <div className="mt-4 flex items-center justify-center gap-2 border-t border-line pt-4 text-xs text-ink-soft">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${destructive ? "border-clay/50 text-clay" : "border-terrace-500/50 text-terrace-600"}`}>
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </span>
            {footnote}
          </div>
        )}
      </div>
    </div>
  );
}
