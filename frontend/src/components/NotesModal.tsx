import { useEffect, useRef, useState } from "react";
import { StickyNote, X, Search, Plus, Trash2, Image as ImageIcon, Upload, Lightbulb } from "lucide-react";
import type { TaskNote } from "../types";
import { uid } from "../lib/storage";
import { t, tFormat } from "../lib/i18n";
import { fileToResizedDataUrl, MAX_IMAGES_PER_ITEM } from "./TaskDetailPanel";

const NOTE_DOT_PALETTE = [
  "var(--color-terrace-500)",
  "var(--color-gold-500)",
  "#8B7FD1",
  "var(--color-clay)",
];

export default function NotesModal({
  notesList,
  lang,
  onSave,
  onClose,
}: {
  notesList: TaskNote[];
  lang: "en" | "ar";
  onSave: (notes: TaskNote[]) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<TaskNote[]>(notesList);
  const [activeId, setActiveId] = useState<string | null>(notesList[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeIndex = notes.findIndex((n) => n.id === activeId);
  const active = activeIndex >= 0 ? notes[activeIndex] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSaveAndClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const handleSaveAndClose = () => {
    // drop notes the user created but left completely empty
    const cleaned = notes.filter((n) => n.title.trim() || n.body.trim() || n.images.length > 0);
    onSave(cleaned);
    onClose();
  };

  const updateActive = (patch: Partial<TaskNote>) => {
    if (!active) return;
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, ...patch } : n)));
  };

  const addNote = () => {
    const note: TaskNote = { id: uid(), title: "", body: "", images: [], createdAt: new Date().toISOString() };
    setNotes((prev) => [...prev, note]);
    setActiveId(note.id);
    setSearch("");
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const addImagesToActive = async (files: FileList) => {
    if (!active) return;
    const room = MAX_IMAGES_PER_ITEM - active.images.length;
    if (room <= 0) {
      alert(t(lang, "maxImagesReached"));
      return;
    }
    const toProcess = Array.from(files).slice(0, room);
    const added: string[] = [];
    for (const file of toProcess) {
      if (file.size > 5 * 1024 * 1024) {
        alert(t(lang, "imageTooLarge"));
        continue;
      }
      try {
        added.push(await fileToResizedDataUrl(file));
      } catch (e) {
        console.error(e);
        alert(t(lang, "imageAddFailed"));
      }
    }
    if (added.length === 0) return;
    updateActive({ images: [...active.images, ...added] });
  };

  const removeImageFromActive = (idx: number) => {
    if (!active) return;
    updateActive({ images: active.images.filter((_, i) => i !== idx) });
  };

  const query = search.trim().toLowerCase();
  const filteredNotes = query
    ? notes.filter((n) => n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query))
    : notes;
  const canAddMore = (active?.images.length ?? 0) < MAX_IMAGES_PER_ITEM;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && handleSaveAndClose()}
    >
      <div className="terrace-card relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden bg-card shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
              <StickyNote size={16} />
            </span>
            {t(lang, "notesModalTitle")}
          </h2>
          <button
            onClick={handleSaveAndClose}
            className="rounded-lg bg-basin-2 p-2 text-ink-soft transition-colors duration-150 hover:bg-ink/10 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* notes list panel */}
          <div className="flex w-full shrink-0 flex-col border-line md:w-72 md:border-e">
            <div className="flex items-center gap-2 px-4 pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                {t(lang, "notesListTitle")}
                <span className="rounded-full bg-terrace-500/12 px-2 py-0.5 text-[11px] font-medium text-terrace-700">
                  {notes.length}
                </span>
              </h3>
            </div>
            <div className="px-4 pt-3">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-ink-soft/50"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t(lang, "notesSearchPlaceholder")}
                  className="w-full rounded-lg border border-line bg-basin-2/40 py-2 ps-8 pe-3 text-xs text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/50 focus:border-terrace-400"
                />
              </div>
              <button
                onClick={addNote}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-terrace-400/50 py-2 text-xs font-semibold text-terrace-600 transition-colors duration-150 hover:bg-terrace-500/10"
              >
                <Plus size={14} /> {t(lang, "newNote")}
              </button>
            </div>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
              {filteredNotes.length === 0 ? (
                <p className="mt-6 text-center text-xs text-ink-soft/70">
                  {notes.length === 0 ? t(lang, "noNotesYet") : t(lang, "noNotesMatch")}
                </p>
              ) : (
                filteredNotes.map((n) => {
                  const idx = notes.findIndex((x) => x.id === n.id);
                  const isActive = n.id === activeId;
                  return (
                    <button
                      key={n.id}
                      onClick={() => setActiveId(n.id)}
                      className={`group block w-full rounded-xl border px-3 py-2.5 text-start transition-colors duration-150 ${
                        isActive ? "border-terrace-500 bg-terrace-500/8" : "border-line hover:border-terrace-400/50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-mono-num text-[11px] font-semibold text-ink-soft/50">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-ink">
                              {n.title.trim() || t(lang, "untitledNote")}
                            </span>
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: NOTE_DOT_PALETTE[idx % NOTE_DOT_PALETTE.length] }}
                            />
                          </div>
                          <p className="mt-0.5 text-[11px] text-ink-soft/70">
                            {new Date(n.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : undefined, {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            ·{" "}
                            {new Date(n.createdAt).toLocaleTimeString(lang === "ar" ? "ar-EG" : undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {n.body && <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{n.body}</p>}
                          <div className="mt-1.5 flex items-center justify-between">
                            {n.images.length > 0 ? (
                              <span className="flex items-center gap-1 text-[11px] text-ink-soft/70">
                                <ImageIcon size={11} /> {n.images.length}
                              </span>
                            ) : (
                              <span />
                            )}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNote(n.id);
                              }}
                              className="rounded-md p-1 text-ink-soft/50 opacity-0 transition-opacity duration-150 hover:bg-clay/10 hover:text-clay group-hover:opacity-100"
                              title={t(lang, "deleteNote")}
                            >
                              <Trash2 size={12} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <p className="flex items-center gap-1.5 border-t border-line px-4 py-3 text-[11px] text-ink-soft/70">
              <Lightbulb size={12} className="shrink-0 text-gold-500" />
              {t(lang, "switchNotesHint")}
            </p>
          </div>

          {/* editor panel */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {active ? (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-ink-soft">{t(lang, "notesModalSubtitle")}</p>
                  <span className="shrink-0 rounded-full bg-terrace-500/12 px-2 py-0.5 text-[11px] font-medium text-terrace-700">
                    {tFormat(lang, "noteOf", { current: activeIndex + 1, total: notes.length })}
                  </span>
                </div>

                <input
                  value={active.title}
                  onChange={(e) => updateActive({ title: e.target.value })}
                  placeholder={t(lang, "noteTitlePlaceholder")}
                  className="mt-3 w-full rounded-lg border border-line bg-basin-2/40 px-3 py-2 text-sm font-semibold text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/50 placeholder:font-normal focus:border-terrace-400"
                />

                <div className="relative mt-2">
                  <textarea
                    autoFocus
                    value={active.body}
                    onChange={(e) => updateActive({ body: e.target.value.slice(0, 1000) })}
                    placeholder={t(lang, "itemNotesPlaceholder")}
                    rows={8}
                    maxLength={1000}
                    className="w-full resize-y rounded-lg border border-line bg-basin-2/40 px-3 py-2.5 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/50 focus:border-terrace-400"
                  />
                  <span className="pointer-events-none absolute bottom-2 end-3 font-mono-num text-[11px] text-ink-soft/50">
                    {active.body.length} / 1000
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-semibold text-ink">{t(lang, "notesImagesLabel")}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{t(lang, "notesImagesHint")}</p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {active.images.map((src, i) => (
                      <div key={i} className="group/image relative">
                        <img src={src} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
                        <button
                          onClick={() => removeImageFromActive(i)}
                          className="absolute -end-1 -top-1 rounded-full bg-ink/60 p-0.5 text-white opacity-0 transition-opacity duration-150 group-hover/image:opacity-100 hover:bg-clay"
                          title={t(lang, "removeImage")}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {canAddMore && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        if (e.dataTransfer.files?.length) addImagesToActive(e.dataTransfer.files);
                      }}
                      className={`mt-2 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center transition-colors duration-150 ${
                        dragOver ? "border-terrace-500 bg-terrace-500/5" : "border-line"
                      }`}
                    >
                      <Upload size={18} className="text-ink-soft/50" />
                      <p className="text-xs text-ink-soft">{t(lang, "dragDropOr")}</p>
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-terrace-600 transition-colors duration-150 hover:bg-terrace-500/10"
                      >
                        {t(lang, "chooseImages")}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) addImagesToActive(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-4 text-center">
                <StickyNote size={32} className="text-ink-soft/30" />
                <p className="text-sm font-medium text-ink-soft">{t(lang, "noNotesYet")}</p>
                <p className="text-xs text-ink-soft/70">{t(lang, "noNotesYetHint")}</p>
                <button
                  onClick={addNote}
                  className="mt-2 flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700"
                >
                  <Plus size={14} /> {t(lang, "newNote")}
                </button>
              </div>
            )}

            <div className="flex gap-2.5 border-t border-line px-5 py-4">
              <button
                onClick={handleSaveAndClose}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-terrace-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.98]"
              >
                {t(lang, "saveNote")}
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 active:scale-[0.98]"
              >
                {t(lang, "cancel")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
