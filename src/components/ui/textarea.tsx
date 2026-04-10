import * as React from "react"

import { cn, normalizeText } from "@/lib/utils"

function Textarea({ className, onChange, value, ...props }: React.ComponentProps<"textarea">) {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const transformedValue = normalizeText(e.target.value)
    const newEvent = {
      ...e,
      target: {
        ...e.target,
        value: transformedValue
      }
    } as React.ChangeEvent<HTMLTextAreaElement>
    
    onChange?.(newEvent)
  }

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm uppercase",
        className
      )}
      onChange={handleChange}
      value={value}
      {...props}
    />
  )
}

export { Textarea }
