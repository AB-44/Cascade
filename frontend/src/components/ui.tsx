import { cn } from "../utils/cn";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/* ---- useMountTransition ------------------------------------------------
   Keeps a conditionally-rendered element mounted for one extra tick so it
   can play an exit animation instead of vanishing the instant its
   condition flips to false. Usage:

   const mounted = useMountTransition(open, 150);
   if (!mounted) return null;
   <div className={open ? "animate-slide-down" : "animate-slide-up-out"}> */
export function useMountTransition(shouldMount: boolean, exitDurationMs: number) {
  const [mounted, setMounted] = useState(shouldMount);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (shouldMount) {
      setMounted(true);
    } else {
      timeout = setTimeout(() => setMounted(false), exitDurationMs);
    }
    return () => clearTimeout(timeout);
  }, [shouldMount, exitDurationMs]);

  return mounted;
}

export function ProgressBar({ value, color = "#1F6E5C", className }: { value: number; color?: string; className?: string }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("water-channel h-2.5 w-full rounded-full", className)}>
      <div
        className="water-fill rounded-full"
        style={{ width: `${v}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, #C9973B))` }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 44,
  stroke = 5,
  color = "#1F6E5C",
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  const gradId = `ring-${color.replace("#", "")}`;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--color-gold-500) 65%, transparent)" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-line"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        stroke={`url(#${gradId})`}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function IconButton({
  children,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-terrace-50 hover:text-ink dark:hover:bg-terrace-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ---- Select ------------------------------------------------------------
   A modern replacement for native <select>, which renders with plain OS
   chrome (flat highlight color, system font, no rounding) regardless of
   how the rest of the app is styled. Options can be flat or grouped under
   a heading. Fully keyboard-navigable; menu is anchored to the trigger and
   uses the shared .animate-menu-in entrance (origin at the trigger, not
   the viewport center — see apple-design skill, spatial consistency). --- */
export type SelectOption = { value: string; label: string };
export type SelectGroup = { label: string; options: SelectOption[] };

export function Select({
  value,
  onChange,
  options,
  groups,
  title,
  className,
  menuClassName,
  disabled,
  fullWidth,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  groups?: SelectGroup[];
  title?: string;
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const flatOptions = groups ? groups.flatMap((g) => g.options) : options;
  const selected = flatOptions.find((o) => o.value === value) ?? flatOptions[0];

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      const idx = flatOptions.findIndex((o) => o.value === value);
      setActiveIndex(idx >= 0 ? idx : 0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  const commit = (opt: SelectOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = flatOptions[activeIndex];
      if (opt) commit(opt);
    }
  };

  let runningIndex = -1;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex cursor-pointer items-center gap-1 whitespace-nowrap bg-transparent py-1 text-sm font-medium text-ink outline-none disabled:cursor-not-allowed disabled:opacity-50",
          fullWidth && "w-full justify-between",
          className,
        )}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          size={14}
          className={cn("shrink-0 text-ink-soft transition-transform", open && "rotate-180")}
        />
      </button>

      {open && !disabled && (
        <div
          ref={listRef}
          role="listbox"
          className={cn(
            "absolute start-0 top-full z-40 mt-2 max-h-72 min-w-[220px] overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-lg animate-menu-in",
            fullWidth && "w-full",
            menuClassName,
          )}
          style={{ ["--menu-origin" as string]: "top left" }}
        >
          {groups
            ? groups.map((group, gi) => (
                <div key={gi} className={gi > 0 ? "mt-1.5 border-t border-line pt-1.5" : ""}>
                  {group.label && (
                    <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                      {group.label}
                    </div>
                  )}
                  {group.options.map((opt) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    return (
                      <SelectRow
                        key={opt.value}
                        opt={opt}
                        idx={idx}
                        active={idx === activeIndex}
                        selected={opt.value === value}
                        onHover={setActiveIndex}
                        onCommit={commit}
                      />
                    );
                  })}
                </div>
              ))
            : options.map((opt) => {
                runningIndex += 1;
                const idx = runningIndex;
                return (
                  <SelectRow
                    key={opt.value}
                    opt={opt}
                    idx={idx}
                    active={idx === activeIndex}
                    selected={opt.value === value}
                    onHover={setActiveIndex}
                    onCommit={commit}
                  />
                );
              })}
        </div>
      )}
    </div>
  );
}

function SelectRow({
  opt,
  idx,
  active,
  selected,
  onHover,
  onCommit,
}: {
  opt: SelectOption;
  idx: number;
  active: boolean;
  selected: boolean;
  onHover: (i: number) => void;
  onCommit: (opt: SelectOption) => void;
}) {
  return (
    <button
      type="button"
      data-index={idx}
      role="option"
      aria-selected={selected}
      onMouseEnter={() => onHover(idx)}
      onClick={() => onCommit(opt)}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition-colors",
        active ? "bg-terrace-50 text-ink" : "text-ink",
        selected && "font-semibold",
      )}
    >
      <span className="min-w-[16px]">
        {selected && <Check size={14} className="text-terrace-600" />}
      </span>
      <span className="truncate">{opt.label}</span>
    </button>
  );
}
