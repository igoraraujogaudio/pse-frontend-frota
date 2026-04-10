'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Loader2, 
  UserCheck, 
  Search,
  ChevronRight,
  Users,
  User as UserIcon,
  Briefcase,
  Building,
  X,
} from 'lucide-react'
import { userService } from '@/services/userService'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface Funcionario {
  id: string
  nome: string
  matricula?: string
  cargo?: string
  operacao?: string
  email?: string
  status?: string
}

export default function InventarioFuncionariosPage() {
  const { userContratoIds } = useAuth()
  const router = useRouter()
  
  // Estados principais - inputValue para resposta imediata, searchTerm para filtro com debounce
  const [inputValue, setInputValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  

  // React Query para funcionários
  const { data: funcionarios = [], isLoading: loading } = useQuery({
    queryKey: ['funcionarios-inventario', userContratoIds],
    queryFn: async () => {
      console.log('🔄 Carregando funcionários para inventário...')
      
      // Carregar funcionários (apenas não demitidos)
      const todosUsuarios = await userService.getAll()
      const funcionariosAtivos = todosUsuarios.filter(func => 
        func.status !== 'demitido' && 
        (userContratoIds.length === 0 || userContratoIds.includes(func.contrato_origem_id || ''))
      )
      
      console.log('✅ Funcionários carregados:', funcionariosAtivos.length)
      return funcionariosAtivos
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })


  // Debounce do termo de busca - reduzido para melhor responsividade
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setSearchTerm(inputValue)
    }, 50) // Debounce muito reduzido (50ms) para quase resposta instantânea

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [inputValue])

  // Funcionários filtrados - otimizado com busca case-insensitive pré-processada
  const funcionariosFiltrados = useMemo(() => {
    if (!inputValue.trim()) {
      return funcionarios
    }

    const termo = inputValue.toLowerCase()
    // Pré-processar strings uma vez para melhor performance
    return funcionarios.filter(funcionario => {
      const nomeLower = funcionario.nome.toLowerCase()
      const matriculaLower = funcionario.matricula?.toLowerCase() || ''
      const cargoLower = funcionario.cargo?.toLowerCase() || ''
      const operacaoLower = funcionario.operacao?.toLowerCase() || ''
      
      return nomeLower.includes(termo) ||
             matriculaLower.includes(termo) ||
             cargoLower.includes(termo) ||
             operacaoLower.includes(termo)
    })
  }, [funcionarios, inputValue])

  const verInventarioFuncionario = useCallback((funcionario: Funcionario) => {
    router.push(`/almoxarifado/inventarios/funcionarios/${funcionario.id}?nome=${encodeURIComponent(funcionario.nome)}&matricula=${encodeURIComponent(funcionario.matricula || 'N/A')}&cargo=${encodeURIComponent(funcionario.cargo || 'N/A')}`)
  }, [router])

  const clearSearch = useCallback(() => {
    setInputValue('')
    setSearchTerm('')
  }, [])

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
                Inventários de Funcionários
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por nome, matrícula ou cargo..."
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

      {/* Loading inicial */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando funcionários...</span>
        </div>
      )}

      {/* Lista de Funcionários */}
      {!loading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-4">
            {funcionariosFiltrados.map((funcionario) => (
              <Card 
                key={funcionario.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => verInventarioFuncionario(funcionario)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <UserIcon className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {funcionario.nome}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center text-xs text-gray-500">
                            <UserCheck className="h-3 w-3 mr-1" />
                            {funcionario.matricula || 'N/A'}
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Briefcase className="h-3 w-3 mr-1" />
                            {funcionario.cargo || 'N/A'}
                          </div>
                          {funcionario.operacao && (
                            <div className="flex items-center text-xs text-gray-500">
                              <Building className="h-3 w-3 mr-1" />
                              {funcionario.operacao}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {funcionariosFiltrados.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchTerm ? 'Nenhum funcionário encontrado' : 'Nenhum funcionário disponível'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm 
                  ? 'Tente ajustar os termos de busca'
                  : 'Não há funcionários cadastrados no seu contrato'
                }
              </p>
            </div>
          )}

          {/* Footer Info */}
          {!loading && funcionariosFiltrados.length > 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">
                {funcionariosFiltrados.length} funcionário{funcionariosFiltrados.length !== 1 ? 's' : ''} encontrado{funcionariosFiltrados.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}