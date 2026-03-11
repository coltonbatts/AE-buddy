import { cn } from "@/ui/lib/cn.js";

export function SectionHeading(props: { eyebrow: string; title: string; subtitle?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", props.className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200/70">{props.eyebrow}</span>
      <h2 className="text-lg font-semibold text-white">{props.title}</h2>
      {props.subtitle ? <p className="text-sm text-white/55">{props.subtitle}</p> : null}
    </div>
  );
}
