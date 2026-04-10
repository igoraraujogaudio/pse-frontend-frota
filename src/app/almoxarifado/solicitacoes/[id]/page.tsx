'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { estoqueService } from '@/services/estoqueService'
import { duplaAprovacaoService } from '@/services/duplaAprovacaoService'
import { baseService } from '@/services/baseService'
import { inventarioService } from '@/services/inventarioService'
import type { InventarioFuncionario, InventarioEquipe } from '@/types/almoxarifado'
import { SignatureRenderer } from '@/components/SignatureRenderer'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Loader2, Package } from 'lucide-react'
import { useNotification } from '@/contexts/NotificationContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { DialogFooter } from '@/components/ui/dialog'
import { DialogDescription } from '@/components/ui/dialog'
import { useQueryClient } from '@tanstack/react-query'

export default function DetalhesSolicitacaoPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_ITEM,
      PERMISSION_CODES.ALMOXARIFADO.APROVAR_SOLICITACAO,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_ENTREGA,
    ]}>
      <DetalhesSolicitacaoContent />
    </ProtectedRoute>
  )
}

function DetalhesSolicitacaoContent() {
  const params = useParams()
  const router = useRouter()
  const { notify } = useNotification()
  const { user } = useAuth()
  const { hasPermission } = useModularPermissions()
  const queryClient = useQueryClient()
  const id = params?.id as string
  const [inventarioModalOpen, setInventarioModalOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [approveQty, setApproveQty] = useState('')
  const [approveObs, setApproveObs] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [simpleReturnOpen, setSimpleReturnOpen] = useState(false)
  const [simpleReturnReason, setSimpleReturnReason] = useState('')
  const [simpleReturnQuantity, setSimpleReturnQuantity] = useState('')
  const [deliverQty, setDeliverQty] = useState('')
  const [deliverObs, setDeliverObs] = useState('')
  const [deliverBaseId, setDeliverBaseId] = useState('')
  const [deliverNumeroLaudo, setDeliverNumeroLaudo] = useState('')
  const [deliverValidadeLaudo, setDeliverValidadeLaudo] = useState('')
  const [deliverNumerosRastreabilidade, setDeliverNumerosRastreabilidade] = useState<string[]>([])
  const [deliverNumeroCa, setDeliverNumeroCa] = useState('')
  const [deliverValidadeCa, setDeliverValidadeCa] = useState('')
  
  // Handler para mudança de data com máscara DD/MM/YYYY
  const handleValidadeLaudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '') // Remove tudo que não é dígito
    
    // Limita a 8 dígitos (DDMMAAAA)
    if (value.length > 8) {
      value = value.slice(0, 8)
    }
    
    // Aplica máscara DD/MM/YYYY
    let formatted = value
    if (value.length > 0) {
      formatted = value.slice(0, 2)
      if (value.length > 2) {
        formatted += '/' + value.slice(2, 4)
      }
      if (value.length > 4) {
        formatted += '/' + value.slice(4, 8)
      }
    }
    
    // Armazena no formato DD/MM/YYYY para exibição
    setDeliverValidadeLaudo(formatted)
  }
  
  // Handler para mudança de data de validade do CA com máscara DD/MM/YYYY
  const handleValidadeCaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 8) {
      value = value.slice(0, 8)
    }
    let formatted = value
    if (value.length > 0) {
      formatted = value.slice(0, 2)
      if (value.length > 2) {
        formatted += '/' + value.slice(2, 4)
      }
      if (value.length > 4) {
        formatted += '/' + value.slice(4, 8)
      }
    }
    setDeliverValidadeCa(formatted)
  }
  
  // Função para validar se a data é válida
  const isValidDate = (dateStr: string): boolean => {
    if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      return false
    }
    
    const [day, month, year] = dateStr.split('/').map(Number)
    
    // Validar ano (entre 1900 e 2100)
    if (year < 1900 || year > 2100) {
      return false
    }
    
    // Validar mês (1-12)
    if (month < 1 || month > 12) {
      return false
    }
    
    // Validar dia baseado no mês
    const daysInMonth = new Date(year, month, 0).getDate()
    if (day < 1 || day > daysInMonth) {
      return false
    }
    
    // Criar objeto Date e verificar se é válido
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day
  }
  
  // Função para converter DD/MM/YYYY para YYYY-MM-DD antes de enviar
  // Mantém o fuso horário brasileiro (UTC-3)
  const convertDateForSubmit = (dateStr: string): string => {
    if (!dateStr) return ''
    // Se está no formato DD/MM/YYYY, converte para YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/')
      // Retorna no formato YYYY-MM-DD (data local brasileira)
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    // Se já está no formato YYYY-MM-DD, retorna como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }
    return dateStr
  }

  // Buscar solicitação
  const { data: solicitacao, isLoading, error } = useQuery({
    queryKey: ['solicitacao', id],
    queryFn: () => estoqueService.getSolicitacaoById(id),
    enabled: !!id,
  })

  // Buscar bases
  const { data: bases = [] } = useQuery({
    queryKey: ['bases-ativas'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000,
  })

  // Buscar inventário do destinatário
  const { data: inventarioItems = [] } = useQuery({
    queryKey: ['inventario-destinatario', solicitacao?.id, solicitacao?.destinatario_id, solicitacao?.destinatario_equipe?.id],
    queryFn: async () => {
      if (!solicitacao) return []
      
      // Só tentar buscar inventário se houver destinatário identificado
      if (solicitacao.destinatario_equipe?.id) {
        try {
          console.log('🏢 [INVENTARIO] Buscando inventário da equipe:', solicitacao.destinatario_equipe.id)
          return await inventarioService.getInventarioByEquipe(solicitacao.destinatario_equipe.id)
        } catch (err) {
          console.warn('⚠️ [INVENTARIO] Não foi possível carregar inventário da equipe:', err)
          return []
        }
      } else if (solicitacao.destinatario_id) {
        try {
          console.log('👤 [INVENTARIO] Buscando inventário do destinatário:', solicitacao.destinatario_id)
          // Tentar buscar inventário - pode falhar se o ID não for compatível
          const inventario = await inventarioService.getInventarioByFuncionario(solicitacao.destinatario_id)
          return inventario || []
        } catch (err: unknown) {
          // Se o erro for relacionado a tipo de dados ou relacionamento, apenas retornar vazio
          const error = err as { code?: string; message?: string }
          if (error?.code === '42804' || error?.code === '22P02' || error?.message?.includes('invalid input')) {
            console.warn('⚠️ [INVENTARIO] Destinatário não possui inventário ou ID incompatível')
            return []
          }
          console.warn('⚠️ [INVENTARIO] Erro ao carregar inventário do destinatário:', err)
          return []
        }
      }
      
      return []
    },
    enabled: !!solicitacao && (!!solicitacao.destinatario_id || !!solicitacao.destinatario_equipe?.id),
    staleTime: 2 * 60 * 1000,
    retry: false, // Não tentar novamente em caso de erro
  })

  // Mutations para rejeitar e devolver
  const rejectMutation = useMutation({
    mutationFn: async ({ motivo }: { motivo: string }) => {
      if (!solicitacao || !user) throw new Error('Dados inválidos')
      return await duplaAprovacaoService.rejeitarSolicitacao({
        solicitacaoId: solicitacao.id,
        rejeitadorId: user.id,
        motivo: motivo,
        tipoRejeicao: 'almoxarifado'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao', id] })
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
      notify('Solicitação rejeitada com sucesso', 'success')
      setRejectOpen(false)
      setRejectReason('')
    },
    onError: (error: Error | unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao rejeitar solicitação'
      notify(message, 'error')
    }
  })

  const approveMutation = useMutation({
    mutationFn: async ({ quantidade, observacoes }: { quantidade: number, observacoes?: string }) => {
      if (!solicitacao || !user) throw new Error('Dados inválidos')
      return await estoqueService.aprovarSolicitacao(
        solicitacao.id,
        user.id,
        quantidade,
        observacoes
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao', id] })
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
      notify('Solicitação aprovada com sucesso', 'success')
      setApproveOpen(false)
      setApproveQty('')
      setApproveObs('')
    },
    onError: (error: Error | unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao aprovar solicitação'
      notify(message, 'error')
    }
  })

  const cancelMutation = useMutation({
    mutationFn: async ({ motivo }: { motivo: string }) => {
      if (!solicitacao || !user) throw new Error('Dados inválidos')
      return await estoqueService.cancelarSolicitacaoAprovada(
        solicitacao.id,
        motivo,
        user.id
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao', id] })
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
      notify('Solicitação cancelada com sucesso', 'success')
      setCancelOpen(false)
      setCancelReason('')
    },
    onError: (error: Error | unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao cancelar solicitação'
      notify(message, 'error')
    }
  })

  const deliverMutation = useMutation({
    mutationFn: async ({ quantidade, baseId, observacoes, numeroLaudo, validadeLaudo, numerosRastreabilidade, numeroCa, validadeCa }: { 
      quantidade: number, 
      baseId: string, 
      observacoes?: string,
      numeroLaudo?: string,
      validadeLaudo?: string,
      numerosRastreabilidade?: string[],
      numeroCa?: string,
      validadeCa?: string
    }) => {
      if (!solicitacao || !user) throw new Error('Dados inválidos')
      return await estoqueService.entregarItem(
        solicitacao.id,
        user.id,
        quantidade,
        'novo',
        observacoes || '',
        numeroLaudo,
        validadeLaudo ? convertDateForSubmit(validadeLaudo) : undefined,
        undefined, // dataVencimento removido - usar validade_laudo
        baseId,
        undefined, // biometricData
        numerosRastreabilidade,
        numeroCa,
        validadeCa ? convertDateForSubmit(validadeCa) : undefined
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao', id] })
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
      notify('Item entregue com sucesso', 'success')
      setDeliverOpen(false)
      setDeliverQty('')
      setDeliverObs('')
      setDeliverBaseId('')
      setDeliverNumeroLaudo('')
      setDeliverValidadeLaudo('')
      setDeliverNumerosRastreabilidade([])
      setDeliverNumeroCa('')
      setDeliverValidadeCa('')
    },
    onError: (error: Error | unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao entregar item'
      notify(message, 'error')
    }
  })

  const returnMutation = useMutation({
    mutationFn: async ({ motivo, observacoes, novoItemId }: { motivo: string, observacoes?: string, novoItemId?: string }) => {
      if (!solicitacao || !user) throw new Error('Dados inválidos')
      const quantidadeFixa = solicitacao.quantidade_entregue || solicitacao.quantidade_aprovada || solicitacao.quantidade_solicitada
      if (!quantidadeFixa) {
        throw new Error('Não foi possível determinar a quantidade entregue')
      }
      if (novoItemId) {
        // Troca com novo item
        if (!novoItemId) {
          throw new Error('Novo item é obrigatório para troca')
        }
        return await estoqueService.processarDevolucaoComTroca(
          solicitacao.id,
          solicitacao.item_id,
          novoItemId,
          quantidadeFixa,
          motivo,
          observacoes || '',
          user.id
        )
      } else {
        // Devolução simples - usar processarDevolucaoComTroca sem novo item (devolução)
        const quantidadeDevolver = parseInt(simpleReturnQuantity) || quantidadeFixa
        if (quantidadeDevolver > quantidadeFixa) {
          throw new Error(`Quantidade inválida! Máximo permitido: ${quantidadeFixa} item(s)`)
        }
        // Para devolução simples, usar o mesmo item_id como novo item
        return await estoqueService.processarDevolucaoComTroca(
          solicitacao.id,
          solicitacao.item_id,
          solicitacao.item_id, // Mesmo item para devolução
          quantidadeDevolver,
          motivo || '',
          observacoes || '',
          user.id
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao', id] })
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
      notify('Devolução/Troca processada com sucesso', 'success')
      setSimpleReturnOpen(false)
      setSimpleReturnReason('')
      setSimpleReturnQuantity('')
    },
    onError: (error: Error | unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao processar devolução/troca'
      notify(message, 'error')
    }
  })

  const handleReject = () => {
    if (!rejectReason || rejectReason.trim().length < 10) {
      notify('Motivo da rejeição deve ter pelo menos 10 caracteres', 'error')
      return
    }
    rejectMutation.mutate({ motivo: rejectReason.trim() })
  }

  const handleApprove = () => {
    if (!approveQty || approveQty.trim() === '') {
      notify('Quantidade é obrigatória', 'error')
      return
    }
    const q = parseInt(approveQty)
    if (isNaN(q) || q < 1) {
      notify('Quantidade deve ser um número maior que zero', 'error')
      return
    }
    if (q > (solicitacao?.quantidade_solicitada || 0)) {
      notify(`Quantidade aprovada (${q}) não pode ser maior que solicitada (${solicitacao?.quantidade_solicitada || 0})`, 'error')
      return
    }
    approveMutation.mutate({ quantidade: q, observacoes: approveObs || undefined })
  }

  const handleCancel = () => {
    if (!cancelReason || cancelReason.trim().length < 10) {
      notify('Motivo do cancelamento deve ter pelo menos 10 caracteres', 'error')
      return
    }
    cancelMutation.mutate({ motivo: cancelReason.trim() })
  }

  const handleDeliver = () => {
    if (!deliverQty || deliverQty.trim() === '') {
      notify('Quantidade é obrigatória', 'error')
      return
    }
    if (!deliverBaseId || deliverBaseId.trim() === '') {
      notify('Selecione a base de origem para a entrega', 'error')
      return
    }
    const q = parseInt(deliverQty)
    if (isNaN(q) || q < 1) {
      notify('Quantidade deve ser um número maior que zero', 'error')
      return
    }
    if (q > (solicitacao?.quantidade_aprovada || 0)) {
      notify(`Quantidade a entregar (${q}) não pode ser maior que aprovada (${solicitacao?.quantidade_aprovada || 0})`, 'error')
      return
    }
    if (solicitacao?.item?.requer_laudo) {
      if (!deliverNumeroLaudo || deliverNumeroLaudo.trim() === '') {
        notify('Este item requer laudo. Preencha o número do laudo.', 'error')
        return
      }
      if (!deliverValidadeLaudo || deliverValidadeLaudo.trim() === '') {
        notify('Este item requer laudo. Preencha a validade do laudo.', 'error')
        return
      }
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(deliverValidadeLaudo)) {
        notify('Data de validade do laudo inválida. Use o formato DD/MM/AAAA.', 'error')
        return
      }
      if (!isValidDate(deliverValidadeLaudo)) {
        notify('Data de validade do laudo inválida. Verifique se a data existe.', 'error')
        return
      }
    }
    if (solicitacao?.item?.requer_rastreabilidade) {
      const qty = parseInt(deliverQty) || 0
      if (deliverNumerosRastreabilidade.length < qty) {
        notify(`Este item requer rastreabilidade individual. Preencha os ${qty} números de rastreabilidade.`, 'error')
        return
      }
      const vazios = deliverNumerosRastreabilidade.some(n => !n || n.trim() === '')
      if (vazios) {
        notify('Todos os números de rastreabilidade devem ser preenchidos.', 'error')
        return
      }
    }
    if (solicitacao?.item?.requer_ca) {
      if (!deliverNumeroCa || deliverNumeroCa.trim() === '') {
        notify('Este item requer CA. Preencha o número do CA.', 'error')
        return
      }
      if (!deliverValidadeCa || deliverValidadeCa.trim() === '') {
        notify('Este item requer CA. Preencha a validade do CA.', 'error')
        return
      }
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(deliverValidadeCa)) {
        notify('Data de validade do CA inválida. Use o formato DD/MM/AAAA.', 'error')
        return
      }
      if (!isValidDate(deliverValidadeCa)) {
        notify('Data de validade do CA inválida. Verifique se a data existe.', 'error')
        return
      }
    }

    // Processar entrega diretamente
    deliverMutation.mutate({
      quantidade: q,
      baseId: deliverBaseId,
      observacoes: deliverObs || undefined,
      numeroLaudo: deliverNumeroLaudo || undefined,
      validadeLaudo: deliverValidadeLaudo ? convertDateForSubmit(deliverValidadeLaudo) : undefined,
      numerosRastreabilidade: deliverNumerosRastreabilidade.length > 0 ? deliverNumerosRastreabilidade : undefined,
      numeroCa: deliverNumeroCa || undefined,
      validadeCa: deliverValidadeCa || undefined
    })
  }

  const handleSimpleReturn = () => {
    if (!simpleReturnReason || simpleReturnReason.trim().length < 10) {
      notify('Motivo da devolução deve ter pelo menos 10 caracteres', 'error')
      return
    }
    if (!simpleReturnQuantity) {
      notify('Quantidade é obrigatória', 'error')
      return
    }
    const quantidadeEntregue = solicitacao?.quantidade_entregue || solicitacao?.quantidade_aprovada || 0
    const quantidadeDevolver = parseInt(simpleReturnQuantity)
    if (quantidadeDevolver > quantidadeEntregue) {
      notify(`Quantidade inválida! Máximo permitido: ${quantidadeEntregue} item(s)`, 'error')
      return
    }
    returnMutation.mutate({ 
      motivo: simpleReturnReason.trim(),
      observacoes: undefined,
      novoItemId: undefined
    })
  }

  // Verificar se pode aprovar, rejeitar, cancelar ou devolver
  // Nota: Não verificamos hasPermission aqui porque o ProtectedRoute já garante o acesso
  // e a página de listagem também não verifica permissão para exibir os botões
  const canApprove = solicitacao && 
    solicitacao.status === 'pendente' &&
    !solicitacao.aprovado_almoxarifado_por

  const canReject = solicitacao && 
    solicitacao.status === 'pendente' &&
    !solicitacao.aprovado_almoxarifado_por

  const canCancel = solicitacao && 
    (solicitacao.status === 'aprovada' || solicitacao.status === 'aguardando_estoque')

  const canDeliver = solicitacao && 
    solicitacao.status === 'aprovada' &&
    hasPermission(PERMISSION_CODES.ALMOXARIFADO.CONTROLE_ENTREGA)

  const canReturn = solicitacao && 
    solicitacao.status === 'entregue'

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  if (error || !solicitacao) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">Erro ao carregar solicitação</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  // Função para formatar data
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Timeline steps baseado nas datas da solicitação
  const getTimelineSteps = () => {
    const steps = [
      { label: 'Solicitada', key: 'pendente', date: solicitacao.criado_em, completed: true },
      { label: 'Aprovada Almoxarifado', key: 'aprovada_almox', date: solicitacao.aprovado_almoxarifado_em, completed: !!solicitacao.aprovado_almoxarifado_em },
      { label: 'Aprovada SESMT', key: 'aprovada_sesmt', date: solicitacao.aprovado_sesmt_em, completed: !!solicitacao.aprovado_sesmt_em },
      { label: 'Entregue', key: 'entregue', date: solicitacao.entregue_em, completed: !!solicitacao.entregue_em },
    ]

    if (solicitacao.status === 'rejeitada') {
      steps.push({ label: 'Rejeitada', key: 'rejeitada', date: solicitacao.atualizado_em, completed: true })
    }

    return steps.filter(s => s.date || s.completed)
  }

  const timelineSteps = getTimelineSteps()
  const currentStatus = solicitacao.status
  const currentIdx = timelineSteps.findIndex(s => s.key === currentStatus || (currentStatus === 'aprovada' && s.key === 'aprovada_sesmt'))

  return (
    <div className="container mx-auto p-6 max-w-[95vw]">
      {/* Botão Voltar */}
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Solicitações
        </Button>
      </div>

      {/* HEADER */}
      <div className={`p-6 rounded-t-lg ${
        solicitacao.status === 'aprovada' ? 'bg-gradient-to-r from-green-500 to-green-600' : 
        solicitacao.status === 'pendente' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 
        solicitacao.status === 'entregue' ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 
        solicitacao.status === 'rejeitada' ? 'bg-gradient-to-r from-red-500 to-red-600' :
        solicitacao.status === 'aguardando_estoque' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
        'bg-gradient-to-r from-gray-500 to-gray-600'
      } text-white`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="text-center">
            {solicitacao.destinatario_equipe ? (
              <div className="flex gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">EQUIPE</div>
                  <div className="bg-orange-500 text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg border-2 border-orange-600">
                    <div className="flex items-center justify-center gap-1">
                      <span>🏢</span>
                      <span className="truncate">{solicitacao.destinatario_equipe.nome}</span>
                    </div>
                  </div>
                </div>
                {solicitacao.responsavel_equipe && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">RESPONSÁVEL</div>
                    <div className="bg-blue-500 text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg border-2 border-blue-600">
                      <div className="flex items-center justify-center gap-1">
                        <span>👨‍💼</span>
                        <span className="truncate">{solicitacao.responsavel_equipe.nome}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">DESTINATÁRIO</div>
                <div className="bg-blue-800 text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg border-2 border-blue-900">
                  <div className="flex items-center justify-center gap-1">
                    <span>👤</span>
                    <span className="truncate">{solicitacao.destinatario?.nome || solicitacao.destinatario_id || 'Destinatário não informado'}</span>
                  </div>
                  {solicitacao.destinatario?.matricula && (
                    <div className="text-xs opacity-90 mt-1 text-center">
                      Mat: {solicitacao.destinatario.matricula}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="text-center">
            <div className="flex items-center gap-3 justify-center">
              {/* Número da Solicitação */}
              {solicitacao.numero_solicitacao && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">NÚMERO DA SOLICITAÇÃO</div>
                  <div className="bg-white text-gray-900 font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg border-2 border-gray-300">
                    📋 {solicitacao.numero_solicitacao}
                  </div>
                </div>
              )}
              {/* Base de Entrega */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">BASE DE ENTREGA</div>
                <div className="bg-red-500 text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg border-2 border-red-600">
                  🏢 {bases.find(b => b.id === solicitacao.base_id)?.nome || 'N/A'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">STATUS</div>
            <div className={`text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-lg border-2 ${
              solicitacao.status === 'aprovada' ? 'bg-green-500 border-green-600' : 
              solicitacao.status === 'pendente' ? 'bg-yellow-500 border-yellow-600' : 
              solicitacao.status === 'entregue' ? 'bg-purple-500 border-purple-600' : 
              solicitacao.status === 'rejeitada' ? 'bg-red-500 border-red-600' :
              solicitacao.status === 'aguardando_estoque' ? 'bg-orange-500 border-orange-600' :
              'bg-gray-500 border-gray-600'
            }`}>
              {solicitacao.status === 'aprovada' ? '✅' : 
               solicitacao.status === 'pendente' ? '⏳' : 
               solicitacao.status === 'entregue' ? '📦' : 
               solicitacao.status === 'rejeitada' ? '❌' :
               solicitacao.status === 'aguardando_estoque' ? '⏰' :
               '❓'} {solicitacao.status.toUpperCase()}
            </div>
          </div>
        </div>
      </div>


      {/* CONTEÚDO */}
      <div className="bg-white rounded-b-lg shadow-lg p-6">
        {/* Layout em grid de 4 colunas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Coluna 1 - Informações Básicas */}
          <div className="space-y-6 md:pr-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-base">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Solicitante
              </div>
              <div className="text-gray-700 text-sm font-medium">
                {solicitacao.solicitante?.nome || solicitacao.solicitante_id || 'Não informado'}
              </div>
              {solicitacao.solicitante?.matricula && (
                <div className="text-xs text-gray-500 mt-1">
                  Matrícula: {solicitacao.solicitante.matricula}
                </div>
              )}
            </div>

            {/* Entregue via Supervisor */}
            {solicitacao.entregue_a_supervisor_id && solicitacao.supervisor_entrega && (
              <div>
                <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-base">
                  <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  Entregue ao Supervisor
                </div>
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 text-lg">👷</span>
                    <div>
                      <div className="text-sm font-semibold text-amber-800">
                        {solicitacao.supervisor_entrega.nome}
                      </div>
                      {solicitacao.supervisor_entrega.matricula && (
                        <div className="text-xs text-amber-600">
                          Mat: {solicitacao.supervisor_entrega.matricula}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">
                    ⚠️ Item retirado pelo supervisor em nome do destinatário
                  </div>
                </div>
              </div>
            )}

            {/* Assinatura */}
            {solicitacao.assinatura_digital && (
              <div>
                <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-base">
                  <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Assinatura Digital
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3 overflow-hidden">
                  <div className="w-full max-w-full overflow-hidden">
                    <SignatureRenderer 
                      signatureData={solicitacao.assinatura_digital}
                      width={280}
                      height={100}
                      className="w-full max-w-full h-auto"
                    />
                  </div>
                  {solicitacao.assinatura_nome && (
                    <div className="text-xs text-gray-600 mt-2">
                      <span className="font-medium">Assinado por:</span> {solicitacao.assinatura_nome}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Coluna 2+3 - Inventário do Destinatário - Card Resumido */}
          <div className="md:col-span-2 flex flex-col">
            <div 
              className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-[1.02]"
              onClick={() => setInventarioModalOpen(true)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg">Inventário do Destinatário</div>
                    <div className="text-sm text-gray-600">
                      {solicitacao.destinatario_equipe ? solicitacao.destinatario_equipe.nome : solicitacao.destinatario?.nome || 'Destinatário'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{inventarioItems.length}</div>
                  <div className="text-xs text-gray-600 font-medium">itens</div>
                </div>
              </div>
              
              {inventarioItems.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    // Agrupar itens por categoria para mostrar resumo
                    const itensPorCategoria = inventarioItems.reduce((acc, item) => {
                      const categoria = (item as { item_estoque?: { categoria?: string }; categoria?: string }).item_estoque?.categoria || 
                                      (item as { item_estoque?: { categoria?: string }; categoria?: string }).categoria || 
                                      'Outros'
                      if (!acc[categoria]) {
                        acc[categoria] = []
                      }
                      acc[categoria].push(item as InventarioFuncionario & InventarioEquipe)
                      return acc
                    }, {} as Record<string, typeof inventarioItems>)

                    return Object.entries(itensPorCategoria).slice(0, 3).map(([categoria, itens]) => (
                      <div key={categoria} className="bg-white rounded-lg p-3 border border-blue-100">
                        <div className="text-xs font-bold text-gray-600 mb-1 uppercase">
                          {categoria === 'epi' ? '🦺 EPI' : 
                           categoria === 'ferramental' ? '🔧 Ferramental' :
                           categoria === 'consumivel' ? '📦 Consumível' :
                           categoria}
                        </div>
                        <div className="text-lg font-bold text-blue-600">{itens.length}</div>
                        <div className="text-xs text-gray-500">itens</div>
                      </div>
                    ))
                  })()}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Nenhum item no inventário
                </div>
              )}
              
              <div className="mt-4 text-center">
                <span className="text-sm text-blue-600 font-medium hover:underline">
                  Clique para ver todos os itens →
                </span>
              </div>
            </div>
          </div>

          {/* Coluna 4 - Informações Adicionais */}
          <div className="space-y-6 md:pl-4">
            {/* Dupla Aprovação */}
            <div>
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-base">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Dupla Aprovação
              </div>
              <div className="space-y-2">
                <div className={`p-2 rounded-lg border ${
                  solicitacao.aprovado_almoxarifado_por 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full ${
                      solicitacao.aprovado_almoxarifado_por 
                        ? 'bg-green-500' 
                        : 'bg-gray-400'
                    }`}></div>
                    <span className="text-xs font-bold text-gray-600">🏢 ALMOXARIFADO</span>
                  </div>
                  <div className="text-xs font-semibold">
                    {solicitacao.aprovado_almoxarifado_por ? (
                      <span className="text-green-700">✓ APROVADO</span>
                    ) : (
                      <span className="text-gray-500">⏳ PENDENTE</span>
                    )}
                  </div>
                </div>
                <div className={`p-2 rounded-lg border ${
                  solicitacao.status === 'rejeitada' && solicitacao.motivo_rejeicao
                    ? 'bg-red-50 border-red-300'
                    : solicitacao.aprovado_sesmt_por 
                    ? 'bg-blue-50 border-blue-300' 
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full ${
                      solicitacao.status === 'rejeitada' && solicitacao.motivo_rejeicao
                        ? 'bg-red-500'
                        : solicitacao.aprovado_sesmt_por 
                        ? 'bg-blue-500' 
                        : 'bg-gray-400'
                    }`}></div>
                    <span className="text-xs font-bold text-gray-600">🛡️ SESMT</span>
                  </div>
                  <div className="text-xs font-semibold">
                    {solicitacao.status === 'rejeitada' && solicitacao.motivo_rejeicao ? (
                      <span className="text-red-700">✗ REJEITADO</span>
                    ) : solicitacao.aprovado_sesmt_por ? (
                      <span className="text-blue-700">✓ APROVADO</span>
                    ) : (
                      <span className="text-gray-500">⏳ PENDENTE</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Histórico */}
            <div>
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-base">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Histórico
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <ul className="flex flex-col gap-3 text-sm text-gray-800">
                  {timelineSteps.map((step, idx) => (
                    <li key={step.key} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        idx <= currentIdx ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{step.label}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(step.date)} {step.date && new Date(step.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {solicitacao.base && (
              <div>
                <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-base">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  Base
                </div>
                <div className="text-sm text-gray-700 font-medium">
                  {solicitacao.base.nome}
                </div>
              </div>
            )}

            {solicitacao.status === 'rejeitada' && solicitacao.motivo_rejeicao && (
              <div>
                <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-base">
                  <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Motivo da Rejeição
                </div>
                <div className="text-sm text-red-800 bg-red-50 p-2 rounded border border-red-200">
                  {solicitacao.motivo_rejeicao}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Item, Tipo, Quantidade, Evidência, Motivo e Ações em linha */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className={`grid grid-cols-1 ${canApprove || canReject || canDeliver || canReturn ? 'md:grid-cols-[1fr_auto_1.05fr_auto_1.5fr_auto]' : 'md:grid-cols-[1fr_auto_1.05fr_auto_1.5fr]'} gap-[1.404rem]`}>
            {/* Item */}
            <div className="flex-1">
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-sm">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                </svg>
                Item
              </div>
              <div className="text-gray-900 font-bold text-sm">{solicitacao.item?.nome || 'Item'}</div>
              {solicitacao.item?.codigo && (
                <div className="text-xs text-gray-600">Código: {solicitacao.item.codigo}</div>
              )}
            </div>

            {/* Tipo */}
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-sm">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                </svg>
                Tipo
              </div>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                solicitacao.tipo_troca === 'fornecimento' ? 'bg-green-100 text-green-700' :
                solicitacao.tipo_troca === 'troca' ? 'bg-blue-100 text-blue-700' :
                'bg-red-100 text-red-700'
              }`}>
                {solicitacao.tipo_troca === 'fornecimento' ? 'Fornecimento' :
                 solicitacao.tipo_troca === 'troca' ? 'Troca' :
                 'Desconto'}
              </span>
            </div>

            {/* Quantidade */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-sm">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Quantidade
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                <div className="flex gap-2">
                  <div className="flex-1 bg-blue-50 border border-blue-200 rounded p-1.5 text-center">
                    <div className="text-xs font-bold text-blue-600">SOLICITADA</div>
                    <div className="text-base font-bold text-blue-800">{solicitacao.quantidade_solicitada}</div>
                  </div>
                  {solicitacao.quantidade_aprovada && (
                    <div className="flex-1 bg-green-50 border border-green-200 rounded p-1.5 text-center">
                      <div className="text-xs font-bold text-green-600">APROVADA</div>
                      <div className="text-base font-bold text-green-800">{solicitacao.quantidade_aprovada}</div>
                    </div>
                  )}
                  {solicitacao.quantidade_entregue && (
                    <div className="flex-1 bg-purple-50 border border-purple-200 rounded p-1.5 text-center">
                      <div className="text-xs font-bold text-purple-600">ENTREGUE</div>
                      <div className="text-base font-bold text-purple-800">{solicitacao.quantidade_entregue}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Evidência */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-sm">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                Evidência
              </div>
              <div className="flex-1 flex items-start">
                {solicitacao.evidencia_url ? (
                  <button
                    onClick={() => window.open(solicitacao.evidencia_url, '_blank')}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                    title="Ver evidência"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>Ver</span>
                  </button>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-2">Sem evidência</div>
                )}
              </div>
            </div>

            {/* Motivo */}
            <div className="flex-1">
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-sm">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                </svg>
                Motivo
              </div>
              <div className="text-gray-700 text-sm line-clamp-3">{solicitacao.motivo_solicitacao}</div>
            </div>

            {/* Ações - Aprovar/Rejeitar/Entregar/Devolver */}
            {(canApprove || canReject || canDeliver || canReturn) && (
              <div className="flex-shrink-0 flex flex-col">
                <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Ações
                </div>
                <div className="flex flex-col gap-2">
                  {/* Aprovar e Rejeitar lado a lado */}
                  {(canApprove || canReject) && (
                    <div className="flex gap-2">
                      {canApprove && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setApproveQty(solicitacao?.quantidade_solicitada?.toString() || '')
                            setApproveOpen(true)
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          Aprovar
                        </Button>
                      )}
                      {canReject && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setRejectOpen(true)}
                          className="flex-1"
                        >
                          Rejeitar
                        </Button>
                      )}
                    </div>
                  )}
                  {canDeliver && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setDeliverQty(solicitacao?.quantidade_aprovada?.toString() || '')
                        setDeliverOpen(true)
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      Entregar
                    </Button>
                  )}
                  {canReturn && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSimpleReturnOpen(true)}
                      className="w-full text-purple-600 border-purple-600 hover:bg-purple-50"
                    >
                      Devolver/Trocar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botões de Ação - Embaixo, lado esquerdo */}
        {canCancel && (
          <div className="mt-6 flex gap-3 justify-start">
            <Button
              variant="destructive"
              onClick={() => setCancelOpen(true)}
            >
              Cancelar
            </Button>
          </div>
        )}

      </div>

      {/* Modal de Inventário */}
      <Dialog open={inventarioModalOpen} onOpenChange={setInventarioModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Inventário do Destinatário
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {inventarioItems.length > 0 ? (
              <div className="space-y-6">
                {(() => {
                  // Agrupar itens por categoria
                  const itensPorCategoria = inventarioItems.reduce((acc, item) => {
                    const categoria = (item as { item_estoque?: { categoria?: string }; categoria?: string }).item_estoque?.categoria || 
                                    (item as { item_estoque?: { categoria?: string }; categoria?: string }).categoria || 
                                    'Outros'
                    if (!acc[categoria]) {
                      acc[categoria] = []
                    }
                    acc[categoria].push(item as InventarioFuncionario & InventarioEquipe)
                    return acc
                  }, {} as Record<string, Array<InventarioFuncionario & InventarioEquipe>>)

                  return Object.entries(itensPorCategoria).map(([categoria, itens]) => (
                    <div key={categoria} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-gray-300">
                        <span className="text-lg font-bold text-gray-800 capitalize">
                          {categoria === 'epi' ? '🦺 EPI' : 
                           categoria === 'ferramental' ? '🔧 Ferramental' :
                           categoria === 'consumivel' ? '📦 Consumível' :
                           categoria}
                        </span>
                        <span className="text-sm text-gray-500">({itens.length} {itens.length === 1 ? 'item' : 'itens'})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {itens.map((item) => {
                          const itemEstoque = (item as InventarioFuncionario & { item_estoque?: { nome?: string; codigo?: string; categoria?: string } }).item_estoque || 
                                             (item as InventarioEquipe & { item_estoque?: { nome?: string; codigo?: string; categoria?: string } }).item_estoque
                          const quantidade = (item as InventarioFuncionario).quantidade || (item as InventarioEquipe).quantidade_total || 0
                          const dataEntrega = (item as InventarioFuncionario).data_entrega || (item as InventarioEquipe).data_entrega
                          return (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900 mb-1">{itemEstoque?.nome || 'Item'}</div>
                                  {itemEstoque?.codigo && (
                                    <div className="text-xs text-gray-500 mb-2">Código: {itemEstoque.codigo}</div>
                                  )}
                                  {dataEntrega && (
                                    <div className="text-xs text-gray-400">
                                      Entregue em: {formatDate(dataEntrega)}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-2xl font-bold text-blue-600">{quantidade}</div>
                                  <div className="text-xs text-gray-500">quantidade</div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum item no inventário</p>
                <p className="text-sm mt-2">O destinatário não possui itens em seu inventário</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Rejeição */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>Informe o motivo da rejeição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-sm">Motivo</div>
              <Textarea 
                value={rejectReason} 
                onChange={e => setRejectReason(e.target.value)} 
                rows={3}
                placeholder="Digite o motivo da rejeição..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectReason('') }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? 'Rejeitando...' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Entrega */}
      <Dialog open={deliverOpen} onOpenChange={(open) => {
        if (!open) {
          setDeliverQty('')
          setDeliverObs('')
          setDeliverBaseId('')
          setDeliverNumeroLaudo('')
          setDeliverValidadeLaudo('')
          setDeliverNumerosRastreabilidade([])
          setDeliverNumeroCa('')
          setDeliverValidadeCa('')
        }
        setDeliverOpen(open)
      }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Entregar Item</DialogTitle>
            <DialogDescription>Confirme a quantidade e observações da entrega.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-2">
            {/* Informações do item */}
            {solicitacao && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="text-sm font-medium text-gray-700">
                  📦 {solicitacao.item?.nome}
                </div>
                <div className="text-sm text-gray-600">
                  👤 Para: {solicitacao.solicitante?.nome}
                </div>
                <div className="text-sm text-gray-600">
                  ✅ Aprovada: {solicitacao.quantidade_aprovada} unidades
                </div>
                {Boolean(solicitacao.item?.requer_laudo) && (
                  <div className="text-sm text-blue-600 font-medium">
                    ⚠️ Este item requer laudo técnico
                  </div>
                )}
                {Boolean(solicitacao.item?.requer_ca) && (
                  <div className="text-sm text-amber-600 font-medium">
                    🛡️ Este item requer CA (Certificado de Aprovação)
                  </div>
                )}
                {Boolean(solicitacao.item?.requer_rastreabilidade) && (
                  <div className="text-sm text-purple-600 font-medium">
                    🔍 Este item requer rastreabilidade individual
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-3">
              {/* Seleção de Base */}
              <div className="space-y-1.5">
                <div className="text-sm font-medium">Base de origem *</div>
                <select 
                  value={deliverBaseId} 
                  onChange={e => setDeliverBaseId(e.target.value)}
                  className={`w-full p-2 border rounded-md ${!deliverBaseId ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="">Selecione a base...</option>
                  {bases.map(base => (
                    <option key={base.id} value={base.id}>
                      {base.nome} ({base.codigo})
                    </option>
                  ))}
                </select>
                {bases.length === 0 && (
                  <div className="text-xs text-red-600">
                    Nenhuma base disponível para entrega
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-sm font-medium">Quantidade a entregar *</div>
                <Input 
                  value={deliverQty} 
                  onChange={e => setDeliverQty(e.target.value)} 
                  type="number" 
                  placeholder="Digite a quantidade"
                  min="1"
                  max={solicitacao?.quantidade_aprovada || 0}
                  className={!deliverQty ? 'border-red-300' : ''}
                />
                <div className="text-xs text-gray-500">
                  Máximo: {solicitacao?.quantidade_aprovada || 0} unidades
                </div>
              </div>
              
              {/* Campos de Laudo (se necessário) */}
              {Boolean(solicitacao?.item?.requer_laudo) && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                    <div className="text-sm font-medium text-blue-800">
                      ⚠️ Este item requer laudo técnico. Preencha os dados abaixo.
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">Número do Laudo *</div>
                    <Input 
                      value={deliverNumeroLaudo} 
                      onChange={e => setDeliverNumeroLaudo(e.target.value)} 
                      placeholder="Ex: L001/2024"
                      className={!deliverNumeroLaudo ? 'border-red-300' : ''}
                      required
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">Validade do Laudo *</div>
                    <Input 
                      type="text"
                      value={deliverValidadeLaudo}
                      onChange={handleValidadeLaudoChange}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className={!deliverValidadeLaudo ? 'border-red-300' : ''}
                      required
                    />
                    <p className="text-xs text-gray-500">Digite a data no formato DD/MM/AAAA (ex: 18/12/2024)</p>
                  </div>
                </>
              )}

              {/* Campos de CA - Certificado de Aprovação (se necessário) */}
              {Boolean(solicitacao?.item?.requer_ca) && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                    <div className="text-sm font-medium text-amber-800">
                      🛡️ Este item requer CA (Certificado de Aprovação). Preencha os dados abaixo.
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">Número do CA *</div>
                    <Input 
                      value={deliverNumeroCa} 
                      onChange={e => setDeliverNumeroCa(e.target.value)} 
                      placeholder="Ex: CA 12345"
                      className={!deliverNumeroCa ? 'border-red-300' : ''}
                      required
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">Validade do CA *</div>
                    <Input 
                      type="text"
                      value={deliverValidadeCa}
                      onChange={handleValidadeCaChange}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className={!deliverValidadeCa ? 'border-red-300' : ''}
                      required
                    />
                    <p className="text-xs text-gray-500">Digite a data no formato DD/MM/AAAA (ex: 18/12/2025)</p>
                  </div>
                </>
              )}

              {/* Campos de Rastreabilidade INDIVIDUAL (se necessário) */}
              {Boolean(solicitacao?.item?.requer_rastreabilidade) && deliverQty && parseInt(deliverQty) > 0 && (
                <>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-2">
                    <div className="text-sm font-medium text-purple-800">
                      🔍 Este item requer rastreabilidade individual. Informe o número de rastreabilidade para cada unidade ({parseInt(deliverQty)} un.).
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    {Array.from({ length: parseInt(deliverQty) || 0 }, (_, i) => (
                      <div key={i} className="space-y-1">
                        <div className="text-xs font-medium text-gray-600">Unidade {i + 1} de {parseInt(deliverQty)} *</div>
                        <Input 
                          value={deliverNumerosRastreabilidade[i] || ''} 
                          onChange={e => {
                            const novosNumeros = [...deliverNumerosRastreabilidade]
                            novosNumeros[i] = e.target.value
                            setDeliverNumerosRastreabilidade(novosNumeros)
                          }} 
                          placeholder={`Nº rastreabilidade unidade ${i + 1}`}
                          className={!deliverNumerosRastreabilidade[i] ? 'border-red-300 bg-white' : 'bg-white'}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              <div className="space-y-1.5">
                <div className="text-sm font-medium">Observações</div>
                <Textarea 
                  value={deliverObs} 
                  onChange={e => setDeliverObs(e.target.value)} 
                  rows={3}
                  placeholder="Observações sobre a entrega..."
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => {
              setDeliverOpen(false)
              setDeliverQty('')
              setDeliverObs('')
              setDeliverBaseId('')
              setDeliverNumeroLaudo('')
              setDeliverValidadeLaudo('')
              setDeliverNumerosRastreabilidade([])
              setDeliverNumeroCa('')
              setDeliverValidadeCa('')
            }}>
              Cancelar
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-600/90" 
              onClick={handleDeliver}
              disabled={deliverMutation.isPending}
            >
              {deliverMutation.isPending ? 'Entregando...' : 'Entregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Aprovação */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Solicitação</DialogTitle>
            <DialogDescription>Informe a quantidade aprovada e observações (opcional).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Quantidade Aprovada</div>
              <Input
                type="number"
                value={approveQty}
                onChange={e => setApproveQty(e.target.value)}
                min="1"
                max={solicitacao?.quantidade_solicitada || 0}
                placeholder="Digite a quantidade aprovada"
              />
              <div className="text-xs text-gray-500">
                Quantidade solicitada: {solicitacao?.quantidade_solicitada || 0}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Observações (opcional)</div>
              <Textarea
                value={approveObs}
                onChange={e => setApproveObs(e.target.value)}
                rows={3}
                placeholder="Digite observações sobre a aprovação..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveOpen(false); setApproveQty(''); setApproveObs('') }}>
              Cancelar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700" 
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Aprovando...' : 'Confirmar Aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Cancelamento */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Solicitação</DialogTitle>
            <DialogDescription>Informe o motivo do cancelamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-sm">Motivo</div>
              <Textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Digite o motivo do cancelamento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelReason('') }}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Modal de Devolução/Troca */}
      <Dialog open={simpleReturnOpen} onOpenChange={setSimpleReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver/Trocar Item</DialogTitle>
            <DialogDescription>
              Devolver ou trocar o item {solicitacao?.item?.nome} que foi entregue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {solicitacao && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="text-sm font-medium text-gray-700">
                  📦 {solicitacao.item?.nome}
                </div>
                <div className="text-xs text-gray-500">
                  Quantidade entregue: <span className="font-medium text-green-600">{solicitacao.quantidade_entregue || solicitacao.quantidade_aprovada || 0}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <div className="text-sm font-medium">Quantidade a Devolver/Trocar *</div>
              <Input
                type="number"
                min="1"
                max={solicitacao?.quantidade_entregue || solicitacao?.quantidade_aprovada || 0}
                value={simpleReturnQuantity}
                onChange={(e) => setSimpleReturnQuantity(e.target.value)}
                placeholder={`Ex: ${solicitacao?.quantidade_entregue || solicitacao?.quantidade_aprovada || 1}`}
              />
              <p className="text-xs text-gray-500">
                Máximo: {solicitacao?.quantidade_entregue || solicitacao?.quantidade_aprovada || 0} item(s)
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Motivo da Devolução/Troca *</div>
              <Textarea
                value={simpleReturnReason}
                onChange={(e) => setSimpleReturnReason(e.target.value)}
                placeholder="Ex: Item não atende às necessidades, tamanho incorreto, especificação errada, etc..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSimpleReturnOpen(false)
              setSimpleReturnReason('')
              setSimpleReturnQuantity('')
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSimpleReturn}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!simpleReturnReason || !simpleReturnQuantity || simpleReturnReason.length < 10 || returnMutation.isPending}
            >
              {returnMutation.isPending ? 'Processando...' : 'Confirmar Devolução/Troca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}




