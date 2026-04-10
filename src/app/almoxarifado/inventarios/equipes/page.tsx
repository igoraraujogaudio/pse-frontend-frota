'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Loader2, 
  Users, 
  Search,
  FileText,
  ChevronRight,
  Building,
  Briefcase,
  X,
} from 'lucide-react'
import { baseService } from '@/services/baseService'
import { teamService } from '@/services/teamService'
import { inventarioService } from '@/services/inventarioService'
import { contratoService } from '@/services/contratoService'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import type { Base } from '@/types'

interface Equipe {
  id: string
  nome: string
  operacao: string
  contrato_id?: string
  contrato?: { id: string; nome: string }
  base_id?: string
  base?: Base
}


export default function InventarioEquipesPage() {
  const { userContratoIds } = useAuth()
  const router = useRouter()
  
  // Estados de filtros - inputValue para resposta imediata, searchTerm para filtro com debounce
  const [selectedContrato, setSelectedContrato] = useState<string>('todos')
  const [selectedOperacao, setSelectedOperacao] = useState<string>('todos')
  const [inputValue, setInputValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  

  // React Query para dados básicos
  const { data: bases = [], isLoading: basesLoading } = useQuery({
    queryKey: ['bases-inventario-equipes'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })

  const { data: contratos = [], isLoading: contratosLoading } = useQuery({
    queryKey: ['contratos-inventario-equipes', userContratoIds],
    queryFn: async () => {
      const todosContratos = await contratoService.getContratosAtivos()
      // Filtrar apenas contratos permitidos ao usuário
      if (!userContratoIds || userContratoIds.length === 0) {
        return todosContratos
      }
      return todosContratos.filter(contrato => userContratoIds.includes(contrato.id))
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const { data: equipes = [], isLoading: equipesLoading } = useQuery({
    queryKey: ['equipes-inventario', userContratoIds, contratos, bases],
    queryFn: async () => {
      const equipesData = await teamService.getAll()
      
      // Filtrar equipes por contratos do usuário
      const equipesFiltradasPorContrato = equipesData.filter(equipe => {
        if (!userContratoIds || userContratoIds.length === 0) return true
        return userContratoIds.includes(equipe.contrato_id || '')
      })
      
      // Mapear para o formato esperado
      return equipesFiltradasPorContrato.map(equipe => ({
        id: equipe.id,
        nome: equipe.nome,
        operacao: equipe.operacao,
        contrato_id: equipe.contrato_id || undefined,
        contrato: contratos.find(c => c.id === equipe.contrato_id),
        base_id: equipe.base_id || undefined,
        base: bases.find(b => b.id === equipe.base_id)
      }))
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !basesLoading && !contratosLoading,
  })

  // Extrair operações únicas das equipes
  const operacoesUnicas = useMemo(() => {
    const operacoes = new Set<string>()
    equipes.forEach(equipe => {
      if (equipe.operacao) {
        operacoes.add(equipe.operacao)
      }
    })
    return Array.from(operacoes).sort()
  }, [equipes])


  const { data: inventarios = [], isLoading: inventariosLoading } = useQuery({
    queryKey: ['inventarios-equipes'],
    queryFn: async () => {
      const inventariosExistentes = await inventarioService.getInventarioEquipes()
      
      // Retornar inventários existentes (agrupados por equipe será feito na página de detalhes)
      return inventariosExistentes
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    enabled: !!(equipes as Record<string, unknown>[]).length,
  })

  const loading = basesLoading || contratosLoading || equipesLoading || inventariosLoading

  // Debounce do termo de busca para otimizar performance
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setSearchTerm(inputValue)
    }, 150) // Debounce reduzido para 150ms para melhor responsividade

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [inputValue])


  const handleContratoChange = useCallback((contratoId: string) => {
    setSelectedContrato(contratoId)
  }, [])

  const handleOperacaoChange = useCallback((operacao: string) => {
    setSelectedOperacao(operacao)
  }, [])

  const verInventarioEquipe = useCallback((equipe: Equipe) => {
    router.push(`/almoxarifado/inventarios/equipes/${equipe.id}?nome=${encodeURIComponent(equipe.nome)}&operacao=${encodeURIComponent(equipe.operacao || 'N/A')}&base=${encodeURIComponent(equipe.base?.nome || 'N/A')}`)
  }, [router])

  const clearSearch = useCallback(() => {
    setInputValue('')
    setSearchTerm('')
  }, [])

  const filteredEquipes = useMemo(() => {
    if (!equipes || (equipes as Record<string, unknown>[]).length === 0) {
      return []
    }
    
    const termo = searchTerm.toLowerCase()
    return (equipes as Record<string, unknown>[]).filter((equipe: Record<string, unknown>) => {
      const matchesSearch = !termo || 
        (equipe.nome as string).toLowerCase().includes(termo) ||
        (equipe.operacao as string).toLowerCase().includes(termo) ||
        ((equipe.base as Record<string, unknown>)?.nome as string)?.toLowerCase().includes(termo) ||
        ((equipe.contrato as Record<string, unknown>)?.nome as string)?.toLowerCase().includes(termo)
      const matchesContrato = selectedContrato === 'todos' || equipe.contrato_id === selectedContrato
      const matchesOperacao = selectedOperacao === 'todos' || equipe.operacao === selectedOperacao
      
      return matchesSearch && matchesContrato && matchesOperacao
    })
  }, [equipes, selectedContrato, selectedOperacao, searchTerm])

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="mr-4"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
              <h1 className="text-lg font-semibold text-gray-900">
                Inventários de Equipes
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros e Search Bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Select value={selectedContrato} onValueChange={handleContratoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Contratos</SelectItem>
                  {contratos.map(contrato => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={selectedOperacao} onValueChange={handleOperacaoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por operação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Operações</SelectItem>
                  {operacoesUnicas.map(operacao => (
                    <SelectItem key={operacao} value={operacao}>
                      {operacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por nome, operação ou base..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="pl-10 pr-10"
              />
              {inputValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading inicial */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando equipes...</span>
        </div>
      )}

      {/* Lista de Equipes */}
      {!loading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-4">
            {filteredEquipes.map((equipe: Record<string, unknown>) => {
              const equipeObj = equipe as unknown as Equipe
              // Contar itens do inventário desta equipe
              const itensInventarioEquipe = inventarios.filter(inv => inv.equipe_id === equipe.id)
              const totalItens = itensInventarioEquipe.length
              const quantidadeTotal = itensInventarioEquipe.reduce((total, inv) => total + (inv.quantidade_total || 0), 0)
              
              // Contadores detalhados
              const itensComLaudo = itensInventarioEquipe.filter(inv => inv.numero_laudo).length
              
              return (
                <Card 
                  key={equipe.id as string} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => verInventarioEquipe(equipeObj)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Users className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {equipe.nome as string}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1 flex-wrap gap-y-1">
                            <div className="flex items-center text-xs text-gray-500">
                              <Briefcase className="h-3 w-3 mr-1" />
                              {equipe.operacao as string || 'N/A'}
                            </div>
                            {(() => {
                              const baseNome = (equipe.base as { nome?: string } | undefined)?.nome
                              return baseNome ? (
                                <div className="flex items-center text-xs text-gray-500">
                                  <Building className="h-3 w-3 mr-1" />
                                  {baseNome}
                                </div>
                              ) : null
                            })()}
                            {(() => {
                              const contratoNome = (equipe.contrato as { nome?: string } | undefined)?.nome
                              return contratoNome ? (
                                <div className="flex items-center text-xs text-gray-500">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {contratoNome}
                                </div>
                              ) : null
                            })()}
                          </div>
                        </div>
                        {/* Contadores */}
                        {totalItens > 0 && (
                          <div className="flex items-center space-x-3 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                            <div className="text-center">
                              <div className="font-semibold text-gray-900">{totalItens}</div>
                              <div className="text-gray-500">Itens</div>
                            </div>
                            <div className="h-8 w-px bg-gray-300" />
                            <div className="text-center">
                              <div className="font-semibold text-gray-900">{quantidadeTotal}</div>
                              <div className="text-gray-500">Total</div>
                            </div>
                            {itensComLaudo > 0 && (
                              <>
                                <div className="h-8 w-px bg-gray-300" />
                                <div className="text-center">
                                  <div className="font-semibold text-blue-600">{itensComLaudo}</div>
                                  <div className="text-gray-500">Laudo</div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 ml-2 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Empty State */}
          {filteredEquipes.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {inputValue ? 'Nenhuma equipe encontrada' : 'Nenhuma equipe disponível'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {inputValue 
                  ? 'Tente ajustar os termos de busca'
                  : 'Não há equipes cadastradas no seu contrato'
                }
              </p>
            </div>
          )}

          {/* Footer Info */}
          {!loading && filteredEquipes.length > 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">
                {filteredEquipes.length} equipe{filteredEquipes.length !== 1 ? 's' : ''} encontrada{filteredEquipes.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

