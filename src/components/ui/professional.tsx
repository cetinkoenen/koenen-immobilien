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
    <section className="relative overflow-hidden rounded-[24px] border border-white/70 bg-white/82 p-5 shadow-[0_18px_45px_rgba(55,65,81,0.08)] backdrop-blur md:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-200 to-transparent" />
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#66758a]">
          {eyebrow}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-[#111827] md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-[#5c6a7e]">
              {description}
            </p>
          ) : null}
          {meta.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {meta.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex min-h-9 items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 text-xs font-black text-slate-700 shadow-sm"
                >
                  <span className="uppercase tracking-[0.14em] text-[#718096]">{item.label}</span>
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
  slate: "border-slate-200/80 bg-white/84 text-slate-950",
  green: "border-teal-200/80 bg-[#edf8f4] text-[#145a4d]",
  amber: "border-[#ecd7a2] bg-[#fbf6e8] text-[#76521d]",
  red: "border-[#efc6d2] bg-[#fff0f4] text-[#8f2442]",
  blue: "border-[#bdd7e3] bg-[#eef7fa] text-[#1f5368]",
  violet: "border-[#d7d2f6] bg-[#f3f1ff] text-[#46318d]",
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
    <div className={cn("rounded-[22px] border p-4 shadow-[0_14px_34px_rgba(51,65,85,0.07)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(51,65,85,0.10)]", kpiToneClasses[tone])}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] opacity-68">
            {label}
          </p>
          <div className="mt-3 text-xl font-black tracking-tight md:text-2xl">
            {value}
          </div>
        </div>
        {Icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/72 shadow-sm ring-1 ring-white/70">
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
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f4] text-[#255f6f] ring-1 ring-teal-100 transition group-hover:bg-[#255f6f] group-hover:text-white">
          <Icon size={20} />
        </div>
        {badge ? (
          <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#66758a]">
            {badge}
          </span>
        ) : (
          <ArrowRight size={18} className="mt-2 text-slate-400 transition group-hover:text-[#255f6f]" />
        )}
      </div>
      <h2 className="mt-5 text-lg font-black text-slate-950">{label}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#5c6a7e]">{description}</p>
    </>
  );

  if (disabled) {
    return (
      <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-5 text-slate-500 shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      className="group rounded-[22px] border border-white/70 bg-white/84 p-5 text-slate-900 no-underline shadow-[0_14px_34px_rgba(51,65,85,0.07)] backdrop-blur transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_18px_44px_rgba(51,65,85,0.10)]"
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
    <div className="rounded-[22px] border border-dashed border-slate-300 bg-white/72 p-6 text-center shadow-sm">
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
    <section className="rounded-[24px] border border-white/70 bg-white/84 p-5 shadow-[0_14px_34px_rgba(51,65,85,0.07)] backdrop-blur md:p-6">
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#66758a]">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-[#5c6a7e]">{description}</p>
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
