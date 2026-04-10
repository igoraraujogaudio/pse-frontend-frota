import React, { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchableSelectProps {
  items: Array<{ id: string; nome: string; codigo?: string; categoria?: string; estoque?: number; unidade?: string; disabled?: boolean }>
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  options?: Array<{ value: string; label: string; description: string }>
}

export function SearchableSelect({
  items,
  value,
  onValueChange,
  placeholder = "Digite para buscar...",
  className,
  disabled = false,
  options // eslint-disable-line @typescript-eslint/no-unused-vars
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredItems, setFilteredItems] = useState(items)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filtrar itens baseado no termo de busca
  useEffect(() => {
    console.log('🔍 [SearchableSelect] Filtrando itens:', {
      searchTerm,
      totalItems: items.length,
      items: items.map(i => ({ id: i.id, nome: i.nome, codigo: i.codigo }))
    })
    
    if (!searchTerm.trim()) {
      setFilteredItems(items)
      return
    }

    const searchLower = searchTerm.toLowerCase().trim()
    const filtered = items.filter(item => {
      const nome = item.nome?.toLowerCase() || ''
      const codigo = item.codigo?.toLowerCase() || ''
      const categoria = item.categoria?.toLowerCase() || ''
      
      const matchNome = nome.includes(searchLower)
      const matchCodigo = codigo.includes(searchLower)
      const matchCategoria = categoria.includes(searchLower)
      
      const isMatch = matchNome || matchCodigo || matchCategoria
      
      if (isMatch) {
        console.log('✅ [SearchableSelect] Item encontrado:', {
          nome: item.nome,
          codigo: item.codigo,
          categoria: item.categoria,
          matchNome,
          matchCodigo,
          matchCategoria
        })
      }
      
      return isMatch
    })

    console.log('📋 [SearchableSelect] Resultados filtrados:', filtered.length)
    setFilteredItems(filtered)
  }, [searchTerm, items])

  // Encontrar item selecionado
  const selectedItem = items.find(item => item.id === value)

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleItemSelect = (itemId: string) => {
    onValueChange(itemId)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = () => {
    onValueChange('')
    setSearchTerm('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={isOpen ? searchTerm : (selectedItem?.nome || '')}
          onChange={(e) => {
            setSearchTerm(e.target.value)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false)
              setSearchTerm('')
            }
          }}
          disabled={disabled}
          className="pl-10 pr-20"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="h-6 w-6 p-0"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </div>
      </div>

      {isOpen && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-hidden">
          <CardContent className="p-0">
            {filteredItems.length > 0 ? (
              <div className="max-h-60 overflow-y-auto">
                {filteredItems.map((item, index) => {
                  // Só desabilitar se explicitamente marcado como disabled
                  // Não desabilitar automaticamente por estoque (deixa isso para quem usa o componente)
                  const isDisabled = item.disabled === true
                  const estoqueAtual = item.estoque || 0
                  
                  return (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      onClick={() => handleItemSelect(item.id)}
                      className={cn(
                        "w-full px-3 py-2 text-left transition-colors",
                        !isDisabled && "hover:bg-muted cursor-pointer",
                        isDisabled && "opacity-50 cursor-not-allowed bg-gray-50",
                        value === item.id && !isDisabled && "bg-muted"
                      )}
                      aria-disabled={isDisabled}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn("font-medium", isDisabled && "text-gray-400")}>{item.nome}</div>
                        {item.estoque !== undefined && (
                          <div className={cn(
                            "text-sm font-semibold ml-2",
                            estoqueAtual > 0 ? "text-blue-600" : "text-red-600"
                          )}>
                            Estoque: {item.estoque} {item.unidade || ''}
                            {isDisabled && " (Indisponível)"}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {item.codigo && (
                          <div className={cn("text-sm", isDisabled ? "text-gray-400" : "text-muted-foreground")}>
                            Código: {item.codigo}
                          </div>
                        )}
                        {item.categoria && (
                          <div className={cn("text-xs", isDisabled ? "text-gray-400" : "text-muted-foreground")}>
                            {item.categoria}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-muted-foreground">
                <div className="text-sm">Nenhum item encontrado</div>
                <div className="text-xs">Tente buscar por nome, código ou categoria</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
