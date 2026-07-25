import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] font-semibold",
  {
    variants: {
      variant: {
        canon: "bg-canon/10 text-canon border border-canon/25",
        fork: "bg-fork/10 text-fork border border-fork/25",
        neutral: "bg-panel-2 text-muted border border-line-2",
        success: "bg-fork/10 text-fork border border-fork/25",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
