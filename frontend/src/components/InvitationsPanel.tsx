import { useEffect, useState } from "react";
import { Mail, X, Loader2, Check, FolderDot } from "lucide-react";
import { fetchMyInvitations, acceptInvitation, declineInvitation, ApiError, type MyInvitation } from "../lib/api";
import { useClosing } from "../lib/useClosing";

export default function InvitationsPanel({ onClose, onAccepted }: { onClose: () => void; onAccepted?: () => void }) {
  const { closing, requestClose } = useClosing(onClose);
  const [invitations, setInvitations] = useState<MyInvitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetchMyInvitations()
      .then((res) => setInvitations(res.invitations))
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر جلب الدعوات"));
  };

  useEffect(() => {
    load();
  }, []);

  const respond = async (invite: MyInvitation, action: "accept" | "decline") => {
    setBusyId(invite.id);
    try {
      if (action === "accept") {
        await acceptInvitation(invite.id);
        onAccepted?.();
      } else {
        await declineInvitation(invite.id);
      }
      setInvitations((prev) => prev?.filter((i) => i.id !== invite.id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تنفيذ الطلب");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px] ${closing ? "" : "animate-fade-in"}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`terrace-card flex h-full w-full max-w-md flex-col overflow-hidden !rounded-none bg-card shadow-2xl ${closing ? "animate-panel-out" : "animate-panel-in"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-basin-2/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
              <Mail size={18} strokeWidth={2.25} />
            </div>
            <h2 className="font-display text-xl font-semibold leading-tight text-ink">
              الدعوات {invitations ? <span className="text-ink-soft">({invitations.length})</span> : ""}
            </h2>
          </div>
          <button onClick={requestClose} className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink">
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {error && (
            <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs text-clay">
              {error}
            </p>
          )}

          {invitations === null && !error && (
            <div className="flex justify-center py-16 text-ink-soft/50">
              <Loader2 className="animate-spin" size={28} />
            </div>
          )}

          {invitations !== null && invitations.length === 0 && (
            <div className="py-16 text-center">
              <Mail className="mx-auto mb-3 text-ink-soft/40" size={44} />
              <p className="text-sm text-ink-soft">ما فيه دعوات جديدة حاليًا.</p>
            </div>
          )}

          {invitations?.map((inv) => (
            <div
              key={inv.id}
              className="terrace-card border border-line bg-basin-2/40 p-3.5"
              style={{ borderInlineStartWidth: 3, borderInlineStartColor: inv.projectColor || "#6366f1" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: inv.projectColor || "#6366f1" }}
                >
                  <FolderDot size={15} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {inv.projectName}
                  </p>
                  <p className="truncate text-xs text-ink-soft">{inv.inviterName} دعاك تنضم لهذا المشروع</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busyId === inv.id}
                  onClick={() => respond(inv, "decline")}
                  className="flex-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5 disabled:opacity-50"
                >
                  رفض
                </button>
                <button
                  disabled={busyId === inv.id}
                  onClick={() => respond(inv, "accept")}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-terrace-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97] disabled:opacity-50"
                >
                  <Check size={13} /> قبول
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
