"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, ref) => {
    return (
      <div className="relative flex items-center justify-center w-5 h-5">
        <input
          type="checkbox"
          className={cn(
            "peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10",
            className
          )}
          ref={ref}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <div className="w-5 h-5 border border-primary rounded bg-transparent peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring flex items-center justify-center transition-colors pointer-events-none">
          <Check className="h-3.5 w-3.5 opacity-0 peer-checked:opacity-100 transition-opacity" />
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
