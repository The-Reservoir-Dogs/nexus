import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// kodwai-style: rectangular, mono, uppercase, letter-spaced.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-mono uppercase tracking-[0.12em] font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canon focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-50 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        // primary = solid terracotta (kodwai CTA)
        aurora:
          "bg-canon text-cream border border-canon shadow-cta hover:-translate-y-0.5 hover:shadow-lift",
        primary:
          "bg-canon text-cream border border-canon shadow-cta hover:-translate-y-0.5 hover:shadow-lift",
        fork: "bg-fork text-cream border border-fork hover:-translate-y-0.5 hover:shadow-lift",
        success: "bg-fork text-cream border border-fork hover:-translate-y-0.5",
        danger: "bg-canon text-cream border border-canon hover:-translate-y-0.5",
        outline:
          "bg-transparent text-text border border-line-2 hover:border-canon hover:text-canon",
        ghost: "bg-transparent text-body hover:bg-panel-2 tracking-normal normal-case",
      },
      size: {
        sm: "h-9 px-3 text-[11px]",
        md: "h-11 px-5 text-[12px]",
        lg: "h-12 px-7 text-[13px]",
        icon: "h-10 w-10 tracking-normal",
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
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
