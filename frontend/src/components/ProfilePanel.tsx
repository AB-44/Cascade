import { useRef, useState } from "react";
import { useClosing } from "../lib/useClosing";
import {
  X,
  User as UserIcon,
  Mail,
  Camera,
  Trash2,
  ShieldCheck,
  KeyRound,
  Target as TargetIcon,
  CheckCircle2,
  CalendarDays,
  LogOut,
  Loader2,
  Check,
} from "lucide-react";
import { useStore } from "../store";
import { t } from "../lib/i18n";
import {
  getStoredUser,
  updateProfile,
  updatePassword,
  logout,
  ApiError,
  type CurrentUser,
} from "../lib/api";

export const AVATAR_COLORS = [
  "#1F6E5C",
  "#C9973B",
  "#6366f1",
  "#06b6d4",
  "#22c55e",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
];

export function UserAvatar({
  user,
  size = 32,
}: {
  user: Pick<CurrentUser, "name" | "avatar" | "avatar_color">;
  size?: number;
}) {
  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = user.name?.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: user.avatar_color || AVATAR_COLORS[0],
        fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  );
}

export default function ProfilePanel({ onClose }: { onClose: () => void }) {
  const { closing, requestClose } = useClosing(onClose);
  const { goals, lang } = useStore();
  const [user, setUser] = useState<CurrentUser | null>(() => getStoredUser());
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [color, setColor] = useState(user?.avatar_color || AVATAR_COLORS[0]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  if (!user) return null;

  const assignedGoals = goals.filter((g) => !g.archived && g.assignedTo === user.name);
  const completedGoals = assignedGoals.filter((g) => g.status === "Completed");
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(lang === "ar" ? "ar" : "en-US", {
        year: "numeric",
        month: "long",
      })
    : null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setProfileMsg({ type: "err", text: "الصورة كبيرة جدًا (٢ ميجابايت كحد أقصى)" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 240;
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

  const saveProfile = async () => {
    if (!name.trim() || !email.trim()) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        email: email.trim(),
        avatar: avatar || null,
        avatar_color: color,
      });
      setUser(updated);
      setProfileMsg({ type: "ok", text: t(lang, "profileUpdated") });
    } catch (err) {
      setProfileMsg({ type: "err", text: err instanceof ApiError ? err.message : "فشل الحفظ" });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!currentPw || !newPw) return;
    if (newPw !== confirmPw) {
      setPwMsg({ type: "err", text: t(lang, "passwordMismatch") });
      return;
    }
    setSavingPw(true);
    setPwMsg(null);
    try {
      await updatePassword(currentPw, newPw, confirmPw);
      setPwMsg({ type: "ok", text: t(lang, "passwordUpdated") });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwMsg({ type: "err", text: err instanceof ApiError ? err.message : "فشل التحديث" });
    } finally {
      setSavingPw(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft";

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
              <UserIcon size={18} strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold leading-tight text-ink">
                {t(lang, "myProfile")}
              </h2>
              <p className="text-xs text-ink-soft">{t(lang, "profileSubtitle")}</p>
            </div>
          </div>
          <button
            onClick={requestClose}
            className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink"
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Avatar + account info */}
          <section className="terrace-card border border-line bg-basin-2/40 p-5">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <UserAvatar user={{ name, avatar, avatar_color: color }} size={96} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -end-1 flex h-9 w-9 items-center justify-center rounded-full bg-terrace-600 text-white shadow-lg ring-4 ring-card transition-colors duration-150 hover:bg-terrace-700"
                  title={t(lang, "changePhoto")}
                >
                  <Camera size={16} />
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ink/5"
                >
                  <Camera size={13} /> {t(lang, "changePhoto")}
                </button>
                {avatar && (
                  <button
                    onClick={() => setAvatar("")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
                  >
                    <Trash2 size={13} /> {t(lang, "removePhoto2")}
                  </button>
                )}
              </div>
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
                          boxShadow: active ? `0 0 0 2px var(--color-basin-2), 0 0 0 4px ${c}` : "none",
                          transform: active ? "scale(1.1)" : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-3.5">
              <div>
                <label className={labelCls}>{t(lang, "fullName")}</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{t(lang, "emailAddress")}</label>
                <div className="relative">
                  <Mail size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    type="email"
                    className={`${inputCls} ps-8`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {profileMsg && (
                <p
                  className={`rounded-lg px-3 py-2 text-xs ${
                    profileMsg.type === "ok"
                      ? "bg-terrace-500/12 text-terrace-700"
                      : "border border-clay/20 bg-clay/10 text-clay"
                  }`}
                >
                  {profileMsg.text}
                </p>
              )}

              <button
                onClick={saveProfile}
                disabled={savingProfile || !name.trim() || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-terrace-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              >
                {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {t(lang, "saveChanges")}
              </button>
            </div>
          </section>

          {/* Activity stats */}
          <section className="mt-4 grid grid-cols-2 gap-3">
            <div className="terrace-card border border-line bg-basin-2/40 p-4">
              <div className="flex items-center gap-2 text-terrace-600">
                <TargetIcon size={16} />
                <span className="font-mono-num text-2xl font-semibold text-ink">{assignedGoals.length}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{t(lang, "assignedToYou")}</p>
            </div>
            <div className="terrace-card border border-line bg-basin-2/40 p-4">
              <div className="flex items-center gap-2 text-terrace-600">
                <CheckCircle2 size={16} />
                <span className="font-mono-num text-2xl font-semibold text-ink">{completedGoals.length}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{t(lang, "completedLabel")}</p>
            </div>
            {memberSince && (
              <div className="col-span-2 flex items-center gap-2 rounded-lg px-1 py-1 text-xs text-ink-soft">
                <CalendarDays size={13} />
                {t(lang, "memberSince")} {memberSince}
              </div>
            )}
          </section>

          {/* Security */}
          <section className="mt-4 terrace-card border border-line bg-basin-2/40 p-5">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <ShieldCheck size={17} className="text-terrace-600" />
              {t(lang, "security")}
            </h3>
            <div className="space-y-3.5">
              <div>
                <label className={labelCls}>{t(lang, "currentPassword")}</label>
                <input
                  type="password"
                  className={inputCls}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className={labelCls}>{t(lang, "newPassword")}</label>
                <input
                  type="password"
                  minLength={8}
                  className={inputCls}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className={labelCls}>{t(lang, "confirmPassword")}</label>
                <input
                  type="password"
                  minLength={8}
                  className={inputCls}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {pwMsg && (
                <p
                  className={`rounded-lg px-3 py-2 text-xs ${
                    pwMsg.type === "ok"
                      ? "bg-terrace-500/12 text-terrace-700"
                      : "border border-clay/20 bg-clay/10 text-clay"
                  }`}
                >
                  {pwMsg.text}
                </p>
              )}

              <button
                onClick={savePassword}
                disabled={savingPw || !currentPw || !newPw || !confirmPw}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-50"
              >
                {savingPw ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                {t(lang, "updatePassword")}
              </button>
            </div>
          </section>

          {/* Sign out */}
          <section className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-clay/20 bg-clay/5 p-4">
            <div>
              <p className="text-sm font-semibold text-ink">{t(lang, "signOutOfAccount")}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{t(lang, "logoutDesc")}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                window.location.reload();
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-clay px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:opacity-90"
            >
              <LogOut size={15} />
              {t(lang, "logout")}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
