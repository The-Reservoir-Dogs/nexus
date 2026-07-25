import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        aurora:
          "bg-aurora bg-[length:200%_200%] text-ink hover:animate-aurora-pan focus-visible:ring-accent shadow-glow-accent",
        primary:
          "bg-canon text-ink hover:brightness-110 focus-visible:ring-canon shadow-glow-canon",
        fork: "bg-fork text-white hover:brightness-110 focus-visible:ring-fork shadow-glow-fork",
        success: "bg-success text-ink hover:brightness-110 focus-visible:ring-success",
        danger: "bg-danger text-ink hover:brightness-110 focus-visible:ring-danger",
        ghost: "bg-transparent text-text hover:bg-panel-2 focus-visible:ring-line",
        outline:
          "border border-line bg-transparent text-text hover:bg-panel-2 focus-visible:ring-line",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
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
