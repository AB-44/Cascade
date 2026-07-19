import { useState } from "react";
import { Loader2, Waves } from "lucide-react";
import { login, register, ApiError } from "../lib/api";

export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError(null);
  };

  const inputCls =
    "w-full rounded-lg border border-line bg-basin px-3 py-2 text-sm text-ink outline-none transition focus:border-terrace-500 focus:ring-2 focus:ring-terrace-500/15";

  return (
    <div className="grid min-h-screen bg-basin text-ink lg:grid-cols-[1.1fr_1fr]">
      {/* Hero: terraced cascade illustration — the app's signature moment */}
      <div className="relative hidden overflow-hidden bg-terrace-900 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10 flex items-center gap-2 text-terrace-50">
          <Waves size={20} />
          <span className="font-mono-num text-xs tracking-[0.3em] uppercase">Cascade</span>
        </div>

        <div className="relative z-10">
          <h1 className="font-display text-6xl leading-[1.05] text-terrace-50">
            أهدافك تتدرّج،
            <br />
            <span className="text-gold-500">خطوة بعد خطوة</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-terrace-200">
            كل هدف كبير ينحدر إلى أهداف فرعية أصغر، مثل مصاطب تتدرّج على منحدر — كاسكيد يرتّبها لك بوضوح.
          </p>
        </div>

        {/* terrace illustration */}
        <svg viewBox="0 0 480 220" className="relative z-10 w-full" fill="none">
          <path d="M0 220V150 L120 150 L120 105 L240 105 L240 60 L360 60 L360 20 L480 20 V220 Z" fill="var(--color-terrace-800)" opacity="0.6" />
          <path d="M0 220V170 L120 170 L120 130 L240 130 L240 90 L360 90 L360 50 L480 50 V220 Z" fill="var(--color-terrace-700)" opacity="0.8" />
          <path
            d="M0 190 C 40 190, 60 150, 120 150 C 160 150, 200 112, 240 112 C 280 112, 300 68, 360 68 C 410 68, 430 30, 480 30"
            stroke="var(--color-gold-500)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.9"
          />
          <circle cx="120" cy="150" r="4" fill="var(--color-gold-500)" />
          <circle cx="240" cy="112" r="4" fill="var(--color-gold-500)" />
          <circle cx="360" cy="68" r="4" fill="var(--color-gold-500)" />
        </svg>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-terrace-600 text-terrace-50">
              <Waves size={20} />
            </div>
          </div>

          <h2 className="font-display text-3xl text-ink">
            {mode === "login" ? "أهلاً من جديد" : "لنبدأ التدرّج"}
          </h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            {mode === "login" ? "سجّل الدخول للوصول إلى خارطة أهدافك" : "أنشئ حسابك وابدأ ترتيب أهدافك"}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-3.5">
            {mode === "register" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">الاسم</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">كلمة المرور</label>
              <input
                type="password"
                required
                minLength={mode === "register" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {mode === "register" && <p className="mt-1 text-[11px] text-ink-soft">8 أحرف على الأقل</p>}
            </div>

            {error && (
              <p className="rounded-lg border border-clay/20 bg-clay/10 px-3 py-2 text-xs text-clay">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-terrace-600 px-3 py-2.5 text-sm font-semibold text-terrace-50 transition hover:bg-terrace-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-ink-soft">
            {mode === "login" ? (
              <>
                ما عندك حساب؟{" "}
                <button type="button" onClick={() => switchMode("register")} className="font-semibold text-terrace-600 hover:underline">
                  أنشئ حساب جديد
                </button>
              </>
            ) : (
              <>
                عندك حساب بالفعل؟{" "}
                <button type="button" onClick={() => switchMode("login")} className="font-semibold text-terrace-600 hover:underline">
                  سجّل الدخول
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
