import type { Origin } from "@/lib/types";
import { ORIGIN_LABELS } from "@/lib/config";

// Classes statiques (pour que Tailwind JIT les détecte).
export const ORIGIN_BADGE: Record<Origin, string> = {
  local: "bg-blue-100 text-blue-800 border-blue-200",
  italian: "bg-green-100 text-green-800 border-green-200",
  asian: "bg-red-100 text-red-800 border-red-200",
  world: "bg-amber-100 text-amber-800 border-amber-200",
};

export const ORIGIN_DOT: Record<Origin, string> = {
  local: "bg-blue-500",
  italian: "bg-green-500",
  asian: "bg-red-500",
  world: "bg-amber-500",
};

export function OriginBadge({ origin }: { origin: Origin }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ORIGIN_BADGE[origin]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ORIGIN_DOT[origin]}`} />
      {ORIGIN_LABELS[origin]}
    </span>
  );
}

export function Tag({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ${className}`}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
