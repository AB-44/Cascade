import { useEffect, useState } from "react";
import { Archive, Eye, RotateCcw, Trash2, Search, FolderDot, ArchiveRestore, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { priorityColor } from "../lib/goals";
import { ProgressRing } from "./ui";
import { MemberAvatar } from "./TeamPanel";
import {
  fetchArchivedProjects,
  restoreProject,
  forceDeleteProject,
  type ArchivedProject,
} from "../lib/api";
import ArchivedProjectViewer from "./ArchivedProjectViewer";
import ConfirmModal from "./ConfirmModal";

type Tab = "projects" | "goals";

export default function ArchivePage() {
  const [tab, setTab] = useState<Tab>("projects");

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
          <Archive size={20} strokeWidth={2.25} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">الأرشيف</h1>
          <p className="text-sm text-ink-soft">المشاريع والأهداف التي أرشفتها — استرجعها أو احذفها نهائيًا.</p>
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-line bg-card p-1">
        {([
          { id: "projects", label: "المشاريع المؤرشفة" },
          { id: "goals", label: "الأهداف المؤرشفة" },
        ] as { id: Tab; label: string }[]).map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
              tab === tb.id ? "bg-terrace-600 text-white shadow-sm" : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "projects" ? <ArchivedProjectsTab /> : <ArchivedGoalsTab />}
    </div>
  );
}

function ArchivedProjectsTab() {
  const { refreshFromServer } = useStore();
  const [projects, setProjects] = useState<ArchivedProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ArchivedProject | null>(null);

  const load = () => {
    fetchArchivedProjects()
      .then((res) => setProjects(res.projects))
      .catch(() => setError("تعذّر تحميل المشاريع المؤرشفة."));
  };

  useEffect(load, []);

  const restore = async (p: ArchivedProject) => {
    setBusyId(p.id);
    try {
      await restoreProject(p.id);
      setProjects((prev) => prev?.filter((x) => x.id !== p.id) ?? null);
      // Bring the project (and every goal that was hidden along with it)
      // back into the local store — see refreshFromServer's own comment.
      await refreshFromServer();
    } catch {
      alert("تعذّرت استعادة المشروع.");
    } finally {
      setBusyId(null);
    }
  };

  const forceDelete = async (p: ArchivedProject) => {
    setConfirmDelete(null);
    setBusyId(p.id);
    try {
      await forceDeleteProject(p.id);
      setProjects((prev) => prev?.filter((x) => x.id !== p.id) ?? null);
    } catch {
      alert("تعذّر حذف المشروع.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = (projects ?? []).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  if (projects === null && !error) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-ink-soft" size={26} />
      </div>
    );
  }

  if (error) {
    return <p className="py-16 text-center text-sm text-ink-soft">{error}</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2">
        <Search size={15} className="text-ink-soft" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث في الأرشفة..."
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Archive className="mx-auto mb-3 text-ink-soft/40" size={40} />
          <p className="text-sm text-ink-soft">{projects?.length === 0 ? "ماكو مشاريع مؤرشفة." : "ماكو نتائج مطابقة."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="px-4 py-3 font-medium">المشروع</th>
                <th className="px-4 py-3 font-medium">الحالة قبل الأرشفة</th>
                <th className="px-4 py-3 font-medium">تاريخ الأرشفة</th>
                <th className="px-4 py-3 font-medium">أرشفة بواسطة</th>
                <th className="px-4 py-3 font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-ink/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: (p.color || "#6366f1") + "22", color: p.color || "#6366f1" }}
                      >
                        <FolderDot size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{p.name}</p>
                        {p.description && <p className="truncate text-xs text-ink-soft">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressRing value={p.progressPct} size={34} stroke={4} color={p.color || undefined} />
                      <span className="text-xs text-ink-soft">
                        {p.completedCount}/{p.goalCount}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                    {p.archivedAt
                      ? new Date(p.archivedAt).toLocaleString("ar-EG", { year: "numeric", month: "short", day: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      <MemberAvatar member={{ name: p.archivedByName, avatar: "", color: "#1F6E5C" }} size={22} />
                      {p.archivedByName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setViewingId(p.id)}
                        title="عرض"
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5"
                      >
                        <Eye size={13} />
                        عرض
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => restore(p)}
                        title="استعادة"
                        className="rounded-md p-1.5 text-terrace-600 transition-colors duration-150 hover:bg-terrace-500/10 disabled:opacity-50"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => setConfirmDelete(p)}
                        title="حذف نهائي"
                        className="rounded-md p-1.5 text-clay transition-colors duration-150 hover:bg-clay/10 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingId && <ArchivedProjectViewer projectId={viewingId} onClose={() => setViewingId(null)} />}

      {confirmDelete && (
        <ConfirmModal
          icon={Trash2}
          destructive
          title="حذف المشروع نهائيًا"
          message={`حذف "${confirmDelete.name}" نهائيًا؟ هذا الإجراء لا يمكن التراجع عنه — راح يمسح المشروع وكل أهدافه ومهامه من قاعدة البيانات نهائيًا.`}
          confirmLabel="حذف نهائي"
          cancelLabel="إلغاء"
          onConfirm={() => forceDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function ArchivedGoalsTab() {
  const { goals, archiveGoal, deleteGoal } = useStore();
  const archived = goals.filter((g) => g.archived);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="space-y-2.5">
      {archived.length === 0 && (
        <div className="py-16 text-center">
          <Archive className="mx-auto mb-3 text-ink-soft/40" size={40} />
          <p className="text-sm text-ink-soft">ماكو أهداف مؤرشفة.</p>
        </div>
      )}
      {archived.map((g) => (
        <div
          key={g.id}
          className="terrace-card flex items-center gap-3 border border-line bg-card p-3 transition-colors duration-150 hover:bg-ink/[0.02]"
          style={{ borderInlineStartWidth: 3, borderInlineStartColor: g.color }}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: priorityColor(g.priority) }} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{g.name}</p>
            {g.tag && <span className="text-xs text-ink-soft">{g.tag}</span>}
          </div>
          <button
            onClick={() => archiveGoal(g.id, false)}
            title="استعادة"
            className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600"
          >
            <ArchiveRestore size={16} />
          </button>
          <button
            onClick={() => setConfirmDelete({ id: g.id, name: g.name })}
            title="حذف"
            className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      {confirmDelete && (
        <ConfirmModal
          icon={Trash2}
          destructive
          title="حذف الهدف نهائيًا"
          message={`حذف "${confirmDelete.name}" نهائيًا؟ هذا الإجراء لا يمكن التراجع عنه.`}
          confirmLabel="حذف نهائي"
          cancelLabel="إلغاء"
          onConfirm={() => {
            deleteGoal(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
