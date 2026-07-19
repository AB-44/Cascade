import { useState, useRef } from "react";
import {
  X,
  Plus,
  Users,
  Pencil,
  Trash2,
  Upload,
  Camera,
  Mail,
  Briefcase,
  Target as TargetIcon,
  Map,
  BadgeCheck,
} from "lucide-react";
import { useStore } from "../store";
import { t, tFormat } from "../lib/i18n";
import { useClosing } from "../lib/useClosing";
import type { TeamMember } from "../types";

interface Props {
  onClose: () => void;
  onOpenRoadmap?: (memberId: string) => void;
}

const AVATAR_COLORS = [
  "#6366f1", "#06b6d4", "#22c55e", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6",
];

export default function TeamPanel({ onClose, onOpenRoadmap }: Props) {
  const { closing, requestClose } = useClosing(onClose);
  const { members, addMember, updateMember, deleteMember, goals, lang } = useStore();
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [creating, setCreating] = useState(false);

  const goalsByMember = (memberName: string) =>
    goals.filter((g) => !g.archived && g.assignedTo === memberName).length;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px] ${closing ? "" : "animate-fade-in"}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`terrace-card flex h-full w-full max-w-lg flex-col overflow-hidden !rounded-none bg-card shadow-2xl ${closing ? "animate-panel-out" : "animate-panel-in"}`}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-basin-2/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
              <Users size={18} strokeWidth={2.25} />
            </div>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold leading-tight text-ink">
              {t(lang, "teamMembers")}
              <span className="rounded-full bg-terrace-500/12 px-2 py-0.5 text-xs font-medium text-terrace-700">
                {members.length}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setCreating(true);
                setEditing(null);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97]"
            >
              <Plus size={16} /> {t(lang, "addMember")}
            </button>
            <button
              onClick={requestClose}
              className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {members.length === 0 && !creating && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-terrace-500/12 text-terrace-600">
                <Users size={32} />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">
                {t(lang, "noMembersYet")}
              </h3>
              <p className="mt-1 max-w-xs text-sm text-ink-soft">
                {t(lang, "noMembersDesc")}
              </p>
              <button
                onClick={() => setCreating(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-terrace-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.98]"
              >
                <Plus size={16} /> {t(lang, "addFirstMember")}
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {members.map((member) => {
              const assigned = goalsByMember(member.name);
              return (
                <div
                  key={member.id}
                  className="group terrace-card flex items-center gap-3 border border-line bg-basin-2/40 p-3 transition-all duration-150 hover:border-terrace-500/40 hover:bg-basin-2/70"
                >
                  <div className="relative shrink-0">
                    <MemberAvatar member={member} size={48} />
                    {member.hasAccount && (
                      <span
                        title={t(lang, "hasAccountTip")}
                        className="absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-terrace-600 text-white ring-2 ring-card"
                      >
                        <BadgeCheck size={11} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-ink">
                        {member.name}
                      </h3>
                      {assigned > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-terrace-500/12 px-2 py-0.5 text-[10px] font-medium text-terrace-700"
                          title={t(lang, "assignedGoals")}
                        >
                          <TargetIcon size={10} /> {assigned}
                        </span>
                      )}
                    </div>
                    {member.role && (
                      <p className="flex items-center gap-1 truncate text-xs text-ink-soft">
                        <Briefcase size={11} /> {member.role}
                      </p>
                    )}
                    {member.email && (
                      <p className="flex items-center gap-1 truncate text-xs text-ink-soft">
                        <Mail size={11} /> {member.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      onClick={() => onOpenRoadmap?.(member.id)}
                      title={t(lang, "openRoadmap")}
                      className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600"
                    >
                      <Map size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setEditing(member);
                        setCreating(false);
                      }}
                      title={t(lang, "edit")}
                      className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(tFormat(lang, "confirmDeleteMember", { name: member.name }))) {
                          deleteMember(member.id);
                        }
                      }}
                      title={t(lang, "delete")}
                      className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {(creating || editing) && (
          <MemberForm
            member={editing}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSave={(data) => {
              if (editing) {
                updateMember(editing.id, data);
              } else {
                addMember(data);
              }
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function MemberForm({
  member,
  onClose,
  onSave,
}: {
  member: TeamMember | null;
  onClose: () => void;
  onSave: (data: Omit<TeamMember, "id" | "createdAt">) => void;
}) {
  const { lang } = useStore();
  const [name, setName] = useState(member?.name || "");
  const [role, setRole] = useState(member?.role || "");
  const [email, setEmail] = useState(member?.email || "");
  const [avatar, setAvatar] = useState(member?.avatar || "");
  const [color, setColor] = useState(
    member?.color || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image too large (max 2MB)");
      return;
    }
    // resize & convert to data URL
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = img.width * scale;
        const h = img.height * scale;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        setAvatar(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), role: role.trim(), email: email.trim(), avatar, color });
  };

  const inputCls =
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15";
  const labelCls =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft";

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="terrace-card w-full max-w-md overflow-hidden bg-card shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-line bg-basin-2/50 px-5 py-4">
          <h3 className="font-display text-lg font-semibold text-ink">
            {member ? t(lang, "editMember") : t(lang, "newMember")}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Avatar uploader */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <MemberAvatar
                member={member?.hasAccount ? member : ({ name, avatar, color } as TeamMember)}
                size={96}
              />
              {!member?.hasAccount && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -end-1 flex h-9 w-9 items-center justify-center rounded-full bg-terrace-600 text-white shadow-lg ring-4 ring-card transition-colors duration-150 hover:bg-terrace-700"
                  title={t(lang, "uploadPhoto")}
                >
                  <Camera size={16} />
                </button>
              )}
            </div>

            {member?.hasAccount ? (
              <p className="flex items-center gap-1.5 rounded-lg bg-terrace-500/10 px-3 py-1.5 text-xs text-terrace-700">
                <BadgeCheck size={13} /> {t(lang, "hasAccountTip")}
              </p>
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ink/5"
                  >
                    <Upload size={13} /> {t(lang, "uploadPhoto")}
                  </button>
                  {avatar && (
                    <button
                      onClick={() => setAvatar("")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
                    >
                      <Trash2 size={13} /> {t(lang, "removePhoto")}
                    </button>
                  )}
                </div>

                {/* Color picker (used when no avatar) */}
                {!avatar && (
                  <div className="flex gap-2 animate-slide-down">
                    {AVATAR_COLORS.map((c) => {
                      const active = color === c;
                      return (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className="relative flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
                          style={{
                            backgroundColor: c,
                            boxShadow: active ? `0 0 0 2px var(--color-card), 0 0 0 4px ${c}` : "none",
                            transform: active ? "scale(1.1)" : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className={labelCls}>{t(lang, "memberName")} *</label>
            <input
              autoFocus
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, "teammateName")}
            />
          </div>

          <div>
            <label className={labelCls}>{t(lang, "memberRole")}</label>
            <input
              className={inputCls}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={t(lang, "memberRolePlaceholder")}
            />
          </div>

          <div>
            <label className={labelCls}>{t(lang, "memberEmail")}</label>
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t(lang, "memberEmailPlaceholder")}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line bg-basin-2/50 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink active:scale-[0.97]"
          >
            {t(lang, "cancel")}
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-lg bg-terrace-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            {t(lang, "save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MemberAvatar({
  member,
  size = 32,
}: {
  member: Pick<TeamMember, "name" | "avatar" | "color" | "linkedAvatar" | "linkedAvatarColor">;
  size?: number;
}) {
  // A linked, registered account's own profile photo/color takes priority
  // over whatever avatar was set manually for this team-member label, so
  // everyone's picture stays in sync with what they set on their profile.
  const avatar = member.linkedAvatar || member.avatar;
  const color = member.linkedAvatarColor || member.color;

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={member.name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = member.name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: color || "#6366f1",
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}
