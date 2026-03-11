import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/ui/lib/cn.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/5 text-white/80",
        accent: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
        danger: "border-rose-500/30 bg-rose-500/10 text-rose-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
