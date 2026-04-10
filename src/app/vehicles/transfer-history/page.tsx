'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import * as XLSX from 'xlsx'
import { 
  ArrowsRightLeftIcon, 
  MagnifyingGlassIcon, 
  CalendarIcon,
  UserIcon,
  TruckIcon,
  FunnelIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface TransferHistoryItem {
  id: string
  veiculo_id: string
  base_origem_id: string
  base_destino_id: string
  usuario_id: string
  data_transferencia: string
  observacoes?: string
  contrato_origem?: { id: string; nome: string }
  contrato_destino?: { id: string; nome: string }
  usuario?: { id: string; nome: string }
  veiculo?: { id: string; placa: string; modelo?: string; marca?: string }
}

export default function VehicleTransferHistoryPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA,
      PERMISSION_CODES.VEICULOS.RELATORIO_FROTA
    ]}>
      <VehicleTransferHistoryContent />
    </ProtectedRoute>
  )
}

function VehicleTransferHistoryContent() {
  const { notify } = useNotification()
  const { userContratoIds } = useAuth()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [contratoFilter, setContratoFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([])
  const [allContratos, setAllContratos] = useState<Array<{ id: string; nome: string }>>([])
  const [exportingHistory, setExportingHistory] = useState(false)

  // Carregar contratos
  useEffect(() => {
    const loadContratos = async () => {
      try {
        const { data, error } = await supabase
          .from('contratos')
          .select('id, nome')
          .eq('status', 'ativo')
          .order('nome')
        
        if (error) throw error
        setAllContratos(data || [])
      } catch (error) {
        console.error('Erro ao carregar contratos:', error)
      }
    }
    loadContratos()
  }, [])

  // Carregar histórico de transferências
  const loadTransferHistory = useCallback(async () => {
    try {
      setLoading(true)
      
      const query = supabase
        .from('logs_transferencia_veiculo')
        .select(`
          *,
          usuario:usuarios(id, nome),
          veiculo:veiculos(id, placa, modelo, marca_equipamento)
        `)
        .order('data_transferencia', { ascending: false })
        .limit(500) // Limitar a 500 registros mais recentes

      // Filtrar por contratos do usuário se aplicável
      if (userContratoIds && userContratoIds.length > 0) {
        // Buscar veículos dos contratos do usuário
        const { data: veiculos } = await supabase
          .from('veiculos')
          .select('id')
          .in('contrato_id', userContratoIds)
        
        if (veiculos && veiculos.length > 0) {
          const veiculoIds = veiculos.map(v => v.id)
          // Dividir em batches de 100 para evitar URL muito longa
          const batchSize = 100
          const batches = []
          for (let i = 0; i < veiculoIds.length; i += batchSize) {
            batches.push(veiculoIds.slice(i, i + batchSize))
          }
          
          // Buscar histórico para cada batch e combinar resultados
          const allTransfers: TransferHistoryItem[] = []
          for (const batch of batches) {
            const { data: batchData, error: batchError } = await supabase
              .from('logs_transferencia_veiculo')
              .select(`
                *,
                usuario:usuarios(id, nome),
                veiculo:veiculos(id, placa, modelo, marca_equipamento)
              `)
              .in('veiculo_id', batch)
              .order('data_transferencia', { ascending: false })
              .limit(500)
            
            if (batchError) {
              console.error('Erro ao buscar batch:', batchError)
            } else if (batchData) {
              allTransfers.push(...batchData)
            }
          }
          
          // Ordenar todos os resultados por data
          allTransfers.sort((a, b) => 
            new Date(b.data_transferencia).getTime() - new Date(a.data_transferencia).getTime()
          )
          
          // Limitar a 500 mais recentes
          const data = allTransfers.slice(0, 500)
          
          // Buscar dados dos contratos para cada transferência
          if (data && data.length > 0) {
            const contratoIds = new Set<string>()
            data.forEach((transfer: TransferHistoryItem) => {
              if (transfer.base_origem_id) contratoIds.add(transfer.base_origem_id)
              if (transfer.base_destino_id) contratoIds.add(transfer.base_destino_id)
            })

            if (contratoIds.size > 0) {
              const { data: contratos } = await supabase
                .from('contratos')
                .select('id, nome')
                .in('id', Array.from(contratoIds))

              if (contratos) {
                data.forEach((transfer: TransferHistoryItem) => {
                  transfer.contrato_origem = contratos.find((c: { id: string; nome: string }) => c.id === transfer.base_origem_id)
                  transfer.contrato_destino = contratos.find((c: { id: string; nome: string }) => c.id === transfer.base_destino_id)
                })
              }
            }
          }

          setTransferHistory(data || [])
          setLoading(false)
          return
        } else {
          // Se não há veículos, não há histórico para mostrar
          setTransferHistory([])
          setLoading(false)
          return
        }
      }

      const { data, error } = await query

      if (error) throw error

      // Buscar dados dos contratos para cada transferência
      if (data && data.length > 0) {
        const contratoIds = new Set<string>()
        data.forEach((transfer: TransferHistoryItem) => {
          if (transfer.base_origem_id) contratoIds.add(transfer.base_origem_id)
          if (transfer.base_destino_id) contratoIds.add(transfer.base_destino_id)
        })

        if (contratoIds.size > 0) {
          const { data: contratos } = await supabase
            .from('contratos')
            .select('id, nome')
            .in('id', Array.from(contratoIds))

          if (contratos) {
            data.forEach((transfer: TransferHistoryItem) => {
              transfer.contrato_origem = contratos.find((c: { id: string; nome: string }) => c.id === transfer.base_origem_id)
              transfer.contrato_destino = contratos.find((c: { id: string; nome: string }) => c.id === transfer.base_destino_id)
            })
          }
        }
      }

      setTransferHistory(data || [])
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
      notify('Erro ao carregar histórico de transferências', 'error')
    } finally {
      setLoading(false)
    }
  }, [userContratoIds, notify])

  useEffect(() => {
    loadTransferHistory()
  }, [loadTransferHistory])

  // Filtrar histórico
  const filteredHistory = transferHistory.filter((transfer) => {
    // Filtro por busca (placa, modelo, marca)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const placa = transfer.veiculo?.placa?.toLowerCase() || ''
      const modelo = transfer.veiculo?.modelo?.toLowerCase() || ''
      const marca = (transfer.veiculo as { marca_equipamento?: string } | undefined)?.marca_equipamento?.toLowerCase() || ''
      const observacoes = transfer.observacoes?.toLowerCase() || ''
      
      if (!placa.includes(searchLower) && 
          !modelo.includes(searchLower) && 
          !marca.includes(searchLower) &&
          !observacoes.includes(searchLower)) {
        return false
      }
    }

    // Filtro por contrato
    if (contratoFilter !== 'all') {
      const origemMatch = transfer.base_origem_id === contratoFilter
      const destinoMatch = transfer.base_destino_id === contratoFilter
      if (!origemMatch && !destinoMatch) return false
    }

    // Filtro por data
    if (dateFilter !== 'all') {
      const transferDate = new Date(transfer.data_transferencia)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - transferDate.getTime()) / (1000 * 60 * 60 * 24))

      if (dateFilter === 'today' && daysDiff !== 0) return false
      if (dateFilter === 'week' && daysDiff > 7) return false
      if (dateFilter === 'month' && daysDiff > 30) return false
      if (dateFilter === 'year' && daysDiff > 365) return false
    }

    return true
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Função para exportar histórico de transferências para Excel
  const exportHistoryToExcel = () => {
    try {
      setExportingHistory(true)

      const dataToExport = filteredHistory.map((transfer) => ({
        'Placa': transfer.veiculo?.placa || 'N/A',
        'Modelo': transfer.veiculo?.modelo || '',
        'Marca': (transfer.veiculo as { marca_equipamento?: string } | undefined)?.marca_equipamento || '',
        'Contrato Origem': transfer.contrato_origem?.nome || 'N/A',
        'Contrato Destino': transfer.contrato_destino?.nome || 'N/A',
        'Data Transferência': formatDate(transfer.data_transferencia),
        'Usuário': transfer.usuario?.nome || 'N/A',
        'Observações': transfer.observacoes || ''
      }))

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Histórico Transferências')

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 12 }, // Placa
        { wch: 20 }, // Modelo
        { wch: 15 }, // Marca
        { wch: 25 }, // Contrato Origem
        { wch: 25 }, // Contrato Destino
        { wch: 20 }, // Data Transferência
        { wch: 25 }, // Usuário
        { wch: 50 }  // Observações
      ]
      worksheet['!cols'] = colWidths

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `historico-transferencias-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      notify('Histórico exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar histórico:', error)
      notify('Erro ao exportar histórico', 'error')
    } finally {
      setExportingHistory(false)
    }
  }


  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <ArrowsRightLeftIcon className="h-8 w-8 text-blue-600" />
              Histórico de Transferências de Veículos
            </h1>
            <p className="text-gray-600 mt-2">
              Visualize todas as transferências de veículos entre contratos
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportHistoryToExcel}
              disabled={exportingHistory || filteredHistory.length === 0}
            >
              <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
              {exportingHistory ? 'Exportando...' : 'Exportar Histórico'}
            </Button>
            <Link href="/vehicles">
              <Button variant="outline">
                Voltar para Veículos
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Buscar por placa, modelo, marca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={contratoFilter} onValueChange={setContratoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os contratos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os contratos</SelectItem>
                  {allContratos.map((contrato) => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as datas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as datas</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                  <SelectItem value="year">Último ano</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setContratoFilter('all')
                  setDateFilter('all')
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{filteredHistory.length}</div>
              <p className="text-sm text-gray-600">Transferências encontradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {new Set(filteredHistory.map(t => t.veiculo_id)).size}
              </div>
              <p className="text-sm text-gray-600">Veículos únicos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {transferHistory.length}
              </div>
              <p className="text-sm text-gray-600">Total de registros</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lista de Transferências */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-gray-500">
              Carregando histórico...
            </div>
          </CardContent>
        </Card>
      ) : filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-gray-500">
              <ArrowsRightLeftIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">Nenhuma transferência encontrada</p>
              <p className="text-sm mt-2">
                {searchTerm || contratoFilter !== 'all' || dateFilter !== 'all'
                  ? 'Tente ajustar os filtros'
                  : 'Ainda não há transferências registradas'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((transfer) => (
            <Card key={transfer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Link 
                        href={`/vehicles/${transfer.veiculo_id}`}
                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                      >
                        <TruckIcon className="h-5 w-5" />
                        <span className="font-bold text-lg">
                          {transfer.veiculo?.placa || 'N/A'}
                        </span>
                        {transfer.veiculo?.marca && transfer.veiculo?.modelo && (
                          <span className="text-sm text-gray-500">
                            {transfer.veiculo.marca} {transfer.veiculo.modelo}
                          </span>
                        )}
                      </Link>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-normal">
                          {transfer.contrato_origem?.nome || 'Contrato origem'}
                        </Badge>
                        <ArrowsRightLeftIcon className="h-4 w-4 text-gray-400" />
                        <Badge variant="outline" className="font-normal">
                          {transfer.contrato_destino?.nome || 'Contrato destino'}
                        </Badge>
                      </div>
                    </div>

                    {transfer.observacoes && (
                      <p className="text-sm text-gray-600 mb-3">{transfer.observacoes}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        {formatDate(transfer.data_transferencia)}
                      </span>
                      {transfer.usuario?.nome && (
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-4 w-4" />
                          {transfer.usuario.nome}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

