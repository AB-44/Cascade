import { Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { useStore } from "../store";
import { priorityColor } from "../lib/goals";
import { useClosing } from "../lib/useClosing";

export default function ArchivePanel({ onClose }: { onClose: () => void }) {
  const { closing, requestClose } = useClosing(onClose);
  const { goals, archiveGoal, deleteGoal } = useStore();
  const archived = goals.filter((g) => g.archived);

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
              <Archive size={18} strokeWidth={2.25} />
            </div>
            <h2 className="font-display text-xl font-semibold leading-tight text-ink">
              Archived <span className="text-ink-soft">({archived.length})</span>
            </h2>
          </div>
          <button onClick={requestClose} className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink">
            <X size={19} />
          </button>
        </div>
        <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
          {archived.length === 0 && (
            <div className="py-16 text-center">
              <Archive className="mx-auto mb-3 text-ink-soft/40" size={44} />
              <p className="text-sm text-ink-soft">Nothing archived.</p>
            </div>
          )}
          {archived.map((g) => (
            <div
              key={g.id}
              className="terrace-card flex items-center gap-3 border border-line bg-basin-2/40 p-3 transition-colors duration-150 hover:bg-basin-2/70"
              style={{ borderInlineStartWidth: 3, borderInlineStartColor: g.color }}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: priorityColor(g.priority) }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{g.name}</p>
                {g.tag && <span className="text-xs text-ink-soft">{g.tag}</span>}
              </div>
              <button onClick={() => archiveGoal(g.id, false)} title="Restore" className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600">
                <ArchiveRestore size={16} />
              </button>
              <button onClick={() => confirm(`Delete "${g.name}" permanently?`) && deleteGoal(g.id)} title="Delete" className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
