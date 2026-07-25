import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium font-mono",
  {
    variants: {
      variant: {
        canon: "bg-canon/15 text-canon border border-canon/30",
        fork: "bg-fork/15 text-fork border border-fork/30",
        neutral: "bg-panel-2 text-muted border border-line",
        success: "bg-success/15 text-success border border-success/30",
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
