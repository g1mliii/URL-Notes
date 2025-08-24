import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[rgba(255,255,255,0.86)] placeholder-[rgba(255,255,255,0.56)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,122,255,0.2)] focus-visible:border-[rgba(0,122,255,1)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
