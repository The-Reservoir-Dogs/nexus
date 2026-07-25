import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// GitHub-style: compact, sans, medium weight, 6px radius, subtle borders.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fork/50 disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        aurora: "bg-accent text-white border border-white/10 hover:bg-accent-hover",
        primary: "bg-accent text-white border border-white/10 hover:bg-accent-hover",
        fork: "bg-fork text-white border border-white/10 hover:brightness-110",
        success: "bg-accent text-white border border-white/10 hover:bg-accent-hover",
        danger: "bg-panel-2 text-danger border border-line-2 hover:border-danger/60 hover:bg-danger/10",
        outline: "bg-panel text-text border border-line-2 hover:bg-panel-2",
        ghost: "bg-transparent text-body hover:bg-panel-2 hover:text-text",
        ai: "bg-ai/15 text-ai border border-ai/40 hover:bg-ai/25",
        pill: "bg-panel text-body border border-line-2 hover:bg-panel-2 hover:text-text",
      },
      size: {
        sm: "h-7 px-2.5 text-[12px]",
        md: "h-8 px-3 text-[13px]",
        lg: "h-9 px-4 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
