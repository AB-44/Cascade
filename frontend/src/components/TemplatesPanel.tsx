import { FileStack, Trash2, X, Plus } from "lucide-react";
import { useStore } from "../store";
import { useClosing } from "../lib/useClosing";

export default function TemplatesPanel({ onClose }: { onClose: () => void }) {
  const { closing, requestClose } = useClosing(onClose);
  const { templates, deleteTemplate, createFromTemplate } = useStore();

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
              <FileStack size={18} strokeWidth={2.25} />
            </div>
            <h2 className="font-display text-xl font-semibold leading-tight text-ink">Templates</h2>
          </div>
          <button onClick={requestClose} className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink">
            <X size={19} />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {templates.length === 0 && (
            <div className="py-16 text-center">
              <FileStack className="mx-auto mb-3 text-ink-soft/40" size={44} />
              <p className="text-sm text-ink-soft">No templates yet.</p>
              <p className="mt-1 text-xs text-ink-soft/70">Edit any goal and choose "Save as Template" to reuse its structure.</p>
            </div>
          )}
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-line bg-basin-2/40 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-ink">{t.name}</h3>
                  <p className="text-xs text-ink-soft">{t.nodes.length} goal(s) · {new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => confirm(`Delete template "${t.name}"?`) && deleteTemplate(t.id)} className="rounded-md p-1 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay">
                  <Trash2 size={16} />
                </button>
              </div>
              <button
                onClick={() => {
                  createFromTemplate(t.id, null);
                  requestClose();
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-terrace-600 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.98]"
              >
                <Plus size={15} /> Create Goal from this
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
