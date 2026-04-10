'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { baseService } from '@/services/baseService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Filter, Search, User, Clock, Download, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import type { UsuarioBase, UsuarioContrato } from '@/types/contratos'
import type { HistoricoFuncionario } from '@/types'


export default function HistoricoFuncionariosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.HISTORICO_MOVIMENTACOES,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_ESTOQUE
    ]}>
      <HistoricoFuncionariosContent />
    </ProtectedRoute>
  );
}

function HistoricoFuncionariosContent() {
  const { user } = useAuth()
  const { notify } = useNotification()
  const queryClient = useQueryClient()
  const { userContratos, userBases } = useUnifiedPermissions()
  
  const [exporting, setExporting] = useState(false)
  const [filtros, setFiltros] = useState({
    funcionario: '',
    matricula: '',
    item: '',
    tipo_movimentacao: 'todos',
    status: 'todos',
    data_inicio: '',
    data_fim: '',
    base_id: '',
    contrato_id: ''
  })

  // React Query para bases
  const { data: bases = [] } = useQuery({
    queryKey: ['bases-historico-funcionarios'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })

  // Filtrar bases e contratos que o usuário tem acesso
  const filteredBases = React.useMemo(() => {
    if (!user) return []
    return bases.filter(base => 
      userBases.some(ub => (ub as UsuarioBase).base_id === base.id && (ub as UsuarioBase).ativo)
    )
  }, [bases, userBases, user])

  const filteredContratos = React.useMemo(() => {
    if (!user) return []
    return userContratos
      .filter(uc => (uc as UsuarioContrato).ativo)
      .map(uc => (uc as UsuarioContrato).contrato)
      .filter((contrato): contrato is NonNullable<typeof contrato> => contrato != null)
  }, [userContratos, user])

  // Definir tipo completo do histórico com relacionamentos
  interface HistoricoCompleto extends HistoricoFuncionario {
    responsavel_entrega_user?: { id: string; nome: string };
    responsavel_devolucao_user?: { id: string; nome: string };
    base?: {
      id: string;
      nome: string;
      contrato_id?: string;
      contrato?: { id: string; nome: string; codigo: string };
    };
  }

  // React Query para histórico de funcionários
  const { data: historico = [] as HistoricoCompleto[], isLoading: loading } = useQuery<HistoricoCompleto[]>({
    queryKey: ['historico-funcionarios', filtros],
    queryFn: async () => {
      console.log('📊 [WEB] Carregando histórico de funcionários...')
      
      // Se há filtro de contrato, primeiro buscar os IDs das bases desse contrato
      let baseIdsParaFiltro: string[] = []
      if (filtros.contrato_id) {
        const { data: basesDoContrato, error: errorBases } = await supabase
          .from('bases')
          .select('id')
          .eq('contrato_id', filtros.contrato_id)
        
        if (errorBases) {
          console.error('Erro ao buscar bases do contrato:', errorBases)
        } else {
          baseIdsParaFiltro = basesDoContrato?.map(b => b.id) || []
          // Se não houver bases para o contrato, retornar array vazio
          if (baseIdsParaFiltro.length === 0) {
            return []
          }
        }
      }
      
      // Construir query com filtros
      // Nota: Requer foreign key 'historico_funcionarios_base_id_fkey' entre historico_funcionarios e bases
      // Execute o script CORRIGIR_FK_HISTORICO_FUNCIONARIOS_BASES.sql se o erro PGRST200 ocorrer
      let query = supabase
        .from('historico_funcionarios')
        .select(`
          *,
          funcionario:usuarios!historico_funcionarios_funcionario_id_fkey(id, nome, matricula),
          item:itens_estoque(id, nome, codigo, categoria),
          responsavel_entrega_user:usuarios!historico_funcionarios_responsavel_entrega_fkey(id, nome),
          responsavel_devolucao_user:usuarios!historico_funcionarios_responsavel_devolucao_fkey(id, nome),
          solicitante_original:usuarios!historico_funcionarios_solicitante_original_id_fkey(id, nome, matricula),
          base:bases!historico_funcionarios_base_id_fkey(
            id, 
            nome, 
            contrato_id,
            contrato:contratos(id, nome, codigo)
          )
        `)

      // Filtrar apenas bases que o usuário tem acesso
      const userBaseIds = userBases.filter(ub => (ub as UsuarioBase).ativo).map(ub => (ub as UsuarioBase).base_id)
      if (userBaseIds.length > 0) {
        query = query.in('base_id', userBaseIds)
      }

      // Aplicar filtros
      // Se base_id está definido, usar ele (mais específico)
      // Caso contrário, se contrato_id está definido, usar os IDs das bases do contrato
      if (filtros.base_id) {
        query = query.eq('base_id', filtros.base_id)
      } else if (filtros.contrato_id && baseIdsParaFiltro.length > 0) {
        // Filtrar por contrato usando os IDs das bases (alternativa ao base.contrato_id)
        query = query.in('base_id', baseIdsParaFiltro)
      }
      
      if (filtros.tipo_movimentacao && filtros.tipo_movimentacao !== 'todos') {
        query = query.eq('tipo_movimentacao', filtros.tipo_movimentacao)
      }
      
      if (filtros.status && filtros.status !== 'todos') {
        query = query.eq('status', filtros.status)
      }
      
      // Corrigir filtros de data - converter para formato ISO e ajustar timezone
      if (filtros.data_inicio) {
        // Adicionar hora 00:00:00 no timezone local
        const dataInicio = new Date(filtros.data_inicio)
        dataInicio.setHours(0, 0, 0, 0)
        const dataInicioISO = dataInicio.toISOString()
        query = query.gte('data_entrega', dataInicioISO)
      }
      
      if (filtros.data_fim) {
        // Adicionar hora 23:59:59 no timezone local para incluir o dia inteiro
        const dataFim = new Date(filtros.data_fim)
        dataFim.setHours(23, 59, 59, 999)
        const dataFimISO = dataFim.toISOString()
        query = query.lte('data_entrega', dataFimISO)
      }

      const { data, error } = await query.order('data_entrega', { ascending: false })

      if (error) throw error
      
      // Transformar os dados para garantir que os relacionamentos sejam objetos únicos
      interface HistoricoRow {
        solicitante_original?: unknown[] | unknown;
        responsavel_entrega_user?: unknown[] | unknown;
        responsavel_devolucao_user?: unknown[] | unknown;
        funcionario?: unknown[] | unknown;
        [key: string]: unknown;
      }

      const transformedData = (data || []).map((item: HistoricoRow) => ({
        ...item,
        solicitante_original: Array.isArray(item.solicitante_original) 
          ? item.solicitante_original[0] 
          : item.solicitante_original,
        responsavel_entrega_user: Array.isArray(item.responsavel_entrega_user) 
          ? item.responsavel_entrega_user[0] 
          : item.responsavel_entrega_user,
        responsavel_devolucao_user: Array.isArray(item.responsavel_devolucao_user) 
          ? item.responsavel_devolucao_user[0] 
          : item.responsavel_devolucao_user,
        funcionario: Array.isArray(item.funcionario) 
          ? item.funcionario[0] 
          : item.funcionario
      })) as unknown as HistoricoCompleto[]
      
      // Aplicar filtros de texto no frontend (funcionário, matrícula e item)
      let filteredData: HistoricoCompleto[] = transformedData
      
      if (filtros.funcionario) {
        filteredData = filteredData.filter(h => 
          h.funcionario?.nome?.toLowerCase().includes(filtros.funcionario.toLowerCase())
        )
      }
      
      if (filtros.matricula) {
        filteredData = filteredData.filter(h => 
          h.funcionario?.matricula?.toLowerCase().includes(filtros.matricula.toLowerCase())
        )
      }
      
      if (filtros.item) {
        filteredData = filteredData.filter(h => 
          h.item?.nome?.toLowerCase().includes(filtros.item.toLowerCase())
        )
      }
      
      console.log('✅ [WEB] Histórico carregado:', filteredData.length, 'registros')
      return filteredData
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  })

  const aplicarFiltros = () => {
    // Os filtros são aplicados automaticamente via React Query quando os filtros mudam
    // Este botão força a atualização imediata
    queryClient.invalidateQueries({ queryKey: ['historico-funcionarios', filtros] })
  }

  const exportarExcel = async () => {
    try {
      setExporting(true)
      
      const dadosExcel = historico.map(h => {
        // Para devoluções, mostrar data_devolucao; para outros tipos, mostrar data_entrega
        const dataExibicao = h.tipo_movimentacao === 'devolucao' && h.data_devolucao 
          ? h.data_devolucao 
          : h.data_entrega
        
        return {
        'Data': dataExibicao ? new Date(dataExibicao).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : '',
        'Data Entrega': h.data_entrega ? new Date(h.data_entrega).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : '',
        'Funcionário': h.funcionario?.nome || '',
        'Matrícula': h.funcionario?.matricula || '',
        'Item': h.item?.nome || '',
        'Código': h.item?.codigo || '',
        'Categoria': h.item?.categoria || '',
        'Quantidade': h.quantidade || 0,
        'Tipo Movimentação': h.tipo_movimentacao || '',
        'Status': h.status || '',
        'Condição Entrega': h.condicao_entrega || '',
        'Condição Devolução': h.condicao_devolucao || '',
        'Observações Entrega': h.observacoes_entrega || '',
        'Observações Devolução': h.observacoes_devolucao || '',
        'Responsável Entrega': h.responsavel_entrega_user?.nome || '',
        'Responsável Devolução': h.responsavel_devolucao_user?.nome || '',
        'Solicitante Original': h.solicitante_original?.nome || '',
        'Data Devolução': h.data_devolucao ? new Date(h.data_devolucao).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : '',
        'Criado em': h.criado_em ? new Date(h.criado_em).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : '',
        'Atualizado em': h.atualizado_em ? new Date(h.atualizado_em).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : ''
        }
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dadosExcel)
      
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 12 }, // Data Entrega
        { wch: 25 }, // Funcionário
        { wch: 15 }, // Matrícula
        { wch: 30 }, // Item
        { wch: 15 }, // Código
        { wch: 15 }, // Categoria
        { wch: 12 }, // Quantidade
        { wch: 15 }, // Tipo Movimentação
        { wch: 15 }, // Status
        { wch: 15 }, // Condição Entrega
        { wch: 15 }, // Condição Devolução
        { wch: 30 }, // Observações Entrega
        { wch: 30 }, // Observações Devolução
        { wch: 20 }, // Responsável Entrega
        { wch: 20 }, // Responsável Devolução
        { wch: 20 }, // Solicitante Original
        { wch: 12 }, // Data Devolução
        { wch: 12 }, // Criado em
        { wch: 12 }  // Atualizado em
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Histórico Funcionários')
      
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      const nomeArquivo = `Historico_Funcionarios_${dataAtual}.xlsx`
      
      XLSX.writeFile(wb, nomeArquivo)
      notify('Relatório de histórico exportado com sucesso!', 'success')
    } catch (error) {
      console.error('❌ [WEB] Erro ao exportar histórico:', error)
      notify('Erro ao exportar relatório de histórico', 'error')
    } finally {
      setExporting(false)
    }
  }


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_uso': return 'bg-green-100 text-green-800'
      case 'devolvido': return 'bg-blue-100 text-blue-800'
      case 'perdido': return 'bg-red-100 text-red-800'
      case 'danificado': return 'bg-orange-100 text-orange-800'
      case 'vencido': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'entrega': return 'bg-green-100 text-green-800'
      case 'devolucao': return 'bg-blue-100 text-blue-800'
      case 'troca': return 'bg-purple-100 text-purple-800'
      case 'substituicao': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <User className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Histórico de Funcionários</h1>
            <p className="text-gray-600">Controle de entregas e devoluções de itens</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="contrato">Contrato</Label>
              <Select value={filtros.contrato_id || 'todos'} onValueChange={(v) => setFiltros(prev => ({ ...prev, contrato_id: v === 'todos' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os contratos</SelectItem>
                  {filteredContratos.map(contrato => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome} ({contrato.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="base">Base</Label>
              <Select value={filtros.base_id || 'todos'} onValueChange={(v) => setFiltros(prev => ({ ...prev, base_id: v === 'todos' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as bases</SelectItem>
                  {filteredBases.map((base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome} ({base.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="matricula">Matrícula</Label>
              <Input
                id="matricula"
                placeholder="Matrícula do funcionário"
                value={filtros.matricula}
                onChange={(e) => setFiltros(prev => ({ ...prev, matricula: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="item">Item</Label>
              <Input
                id="item"
                placeholder="Nome do item"
                value={filtros.item}
                onChange={(e) => setFiltros(prev => ({ ...prev, item: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="tipo">Tipo de Movimentação</Label>
              <Select value={filtros.tipo_movimentacao} onValueChange={(v) => setFiltros(prev => ({ ...prev, tipo_movimentacao: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                  <SelectItem value="troca">Troca</SelectItem>
                  <SelectItem value="substituicao">Substituição</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={filtros.status} onValueChange={(v) => setFiltros(prev => ({ ...prev, status: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="em_uso">Em Uso</SelectItem>
                  <SelectItem value="devolvido">Devolvido</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                  <SelectItem value="danificado">Danificado</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={filtros.data_inicio}
                onChange={(e) => setFiltros(prev => ({ ...prev, data_inicio: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={filtros.data_fim}
                onChange={(e) => setFiltros(prev => ({ ...prev, data_fim: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={aplicarFiltros}>
              <Search className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
            <Button variant="outline" onClick={() => setFiltros({
              funcionario: '',
              matricula: '',
              item: '',
              tipo_movimentacao: 'todos',
              status: 'todos',
              data_inicio: '',
              data_fim: '',
              base_id: '',
              contrato_id: ''
            })}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exportação */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Exportar:</span>
            </div>
            <Button 
              variant="outline" 
              onClick={exportarExcel}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando histórico...</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Histórico ({historico.length} registros)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((h) => {
                    // Para devoluções, mostrar data_devolucao; para outros tipos, mostrar data_entrega
                    const dataExibicao = h.tipo_movimentacao === 'devolucao' && h.data_devolucao 
                      ? h.data_devolucao 
                      : h.data_entrega
                    
                    return (
                    <TableRow key={h.id}>
                      <TableCell>
                        {dataExibicao ? new Date(dataExibicao).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) : '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{h.funcionario?.nome || '-'}</div>
                          <div className="text-sm text-gray-500">{h.funcionario?.matricula || '-'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{h.item?.nome || '-'}</div>
                          <div className="text-sm text-gray-500">{h.item?.codigo || '-'}</div>
                        </div>
                      </TableCell>
                      <TableCell>{h.quantidade}</TableCell>
                      <TableCell>
                        <Badge className={getTipoColor(h.tipo_movimentacao)}>
                          {h.tipo_movimentacao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(h.status)}>
                          {h.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{h.responsavel_entrega_user?.nome || '-'}</TableCell>
                      <TableCell>{h.solicitante_original?.nome || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {h.observacoes_entrega || '-'}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}