import * as React from "react"

import { cn, normalizeText } from "@/lib/utils"

function Input({ className, type, onChange, value, ...props }: React.ComponentProps<"input">) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Não aplicar transformação em campos de senha, email, number, date, etc
    // Também não aplicar em campos de nome (id contém 'nome', 'name', 'password', 'senha')
    // E não aplicar em campos de múltiplos prefixos (que contêm vírgulas)
    const skipTransform = ['password', 'email', 'number', 'date', 'datetime-local', 'time', 'month', 'week', 'file', 'hidden', 'color', 'range']
    const inputId = (props as { id?: string }).id || ''
    const isNameField = inputId.toLowerCase().includes('nome') || inputId.toLowerCase().includes('name')
    const isPasswordField = inputId.toLowerCase().includes('password') || inputId.toLowerCase().includes('senha')
    const isPrefixosField = inputId.toLowerCase().includes('prefixos') // Campos de múltiplos prefixos contêm vírgulas
    const isCodigoField = inputId.toLowerCase().includes('codigo') // Campos de código devem aceitar minúsculas
    
    if (!skipTransform.includes(type || 'text') && !isNameField && !isPasswordField && !isPrefixosField && !isCodigoField) {
      const transformedValue = normalizeText(e.target.value)
      const newEvent = {
        ...e,
        target: {
          ...e.target,
          value: transformedValue
        }
      } as React.ChangeEvent<HTMLInputElement>
      
      onChange?.(newEvent)
    } else {
      onChange?.(e)
    }
  }

  // Determinar se deve aplicar uppercase baseado no tipo e id do campo
  const inputId = (props as { id?: string }).id || ''
  const isPasswordField = type === 'password' || inputId.toLowerCase().includes('password') || inputId.toLowerCase().includes('senha')
  const isEmailField = type === 'email' || inputId.toLowerCase().includes('email')
  const isNameField = inputId.toLowerCase().includes('nome') || inputId.toLowerCase().includes('name')
  const isPrefixosField = inputId.toLowerCase().includes('prefixos') // Campos de múltiplos prefixos não devem ter uppercase
  const isCodigoField = inputId.toLowerCase().includes('codigo') // Campos de código não devem ter uppercase
  const shouldUppercase = !isPasswordField && !isEmailField && !isNameField && !isPrefixosField && !isCodigoField

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        shouldUppercase && "uppercase",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      onChange={handleChange}
      value={value}
      {...props}
    />
  )
}

export { Input }
