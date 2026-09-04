import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      tone: {
        default: "bg-surface-2 text-muted",
        engg: "bg-engg/15 text-engg",
        snt: "bg-snt/15 text-snt",
        trd: "bg-trd/15 text-trd",
        ok: "bg-ok/15 text-ok",
        caution: "bg-caution/15 text-caution",
        danger: "bg-danger/15 text-danger",
        solid: "bg-primary/10 text-primary",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
