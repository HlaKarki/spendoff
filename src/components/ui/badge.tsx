import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
  {
    variants: {
      tone: {
        leader: "border-current text-gold",
        closed: "border-current text-muted",
        pending: "border-dashed border-current text-gold",
        danger: "border-current text-stamp",
      },
    },
    defaultVariants: { tone: "closed" },
  },
);

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
