import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,122,255,0.2)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[rgba(0,122,255,1)] text-white hover:bg-[rgba(0,122,255,0.8)] shadow-[0_2px_7px_rgba(0,0,0,0.12)]",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 shadow-[0_2px_7px_rgba(0,0,0,0.12)]",
        outline:
          "border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.86)] hover:bg-[rgba(255,255,255,0.14)] backdrop-blur-[24px]",
        secondary:
          "bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.86)] hover:bg-[rgba(255,255,255,0.14)] backdrop-blur-[24px]",
        ghost: "text-[rgba(255,255,255,0.86)] hover:bg-[rgba(255,255,255,0.14)]",
        link: "text-[rgba(0,122,255,1)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
