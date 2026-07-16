import { NavLink } from "react-router-dom";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: Array<{ label: string; value: ReactNode }>;
  children?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, meta = [], children }: PageHeaderProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          {eyebrow}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
          {meta.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {meta.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex min-h-9 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700"
                >
                  <span className="uppercase tracking-[0.14em] text-slate-500">{item.label}</span>
                  <span>{item.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
    </section>
  );
}

type KpiTone = "slate" | "green" | "amber" | "red" | "blue" | "violet";

const kpiToneClasses: Record<KpiTone, string> = {
  slate: "border-slate-200 bg-white text-slate-950",
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-900",
  blue: "border-sky-200 bg-sky-50 text-sky-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900",
};

export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
}) {
  return (
    <div className={cn("rounded-[22px] border p-4 shadow-sm", kpiToneClasses[tone])}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">
            {label}
          </p>
          <div className="mt-3 text-xl font-black tracking-tight md:text-2xl">
            {value}
          </div>
        </div>
        {Icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70">
            <Icon size={19} />
          </div>
        ) : null}
      </div>
      {detail ? <div className="mt-3 text-sm font-bold opacity-75">{detail}</div> : null}
    </div>
  );
}

export function ModuleCard({
  to,
  label,
  description,
  icon: Icon,
  badge,
  disabled = false,
}: {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 transition group-hover:bg-slate-900 group-hover:text-white">
          <Icon size={20} />
        </div>
        {badge ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
            {badge}
          </span>
        ) : (
          <ArrowRight size={18} className="mt-2 text-slate-400 transition group-hover:text-slate-900" />
        )}
      </div>
      <h2 className="mt-5 text-lg font-black text-slate-950">{label}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
    </>
  );

  if (disabled) {
    return (
      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 text-slate-500 shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      className="group rounded-[22px] border border-slate-200 bg-white p-5 text-slate-900 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      {content}
    </NavLink>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export function SectionPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

export function InfoList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; tone?: KpiTone }>;
}) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex min-h-12 items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm font-black",
            kpiToneClasses[item.tone ?? "slate"],
          )}
        >
          <span className="text-slate-600">{item.label}</span>
          <span className="text-right text-slate-950">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
