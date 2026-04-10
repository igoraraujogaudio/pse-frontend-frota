'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventarioService } from '@/services/inventarioService'
import { estoqueService } from '@/services/estoqueService'
import { fichaEpiPdfService } from '@/services/fichaEpiPdfService'
import { fichaEpcPdfService } from '@/services/fichaEpcPdfService'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNotification } from '@/contexts/NotificationContext'
import {
    Search,
    Users,
    Package,
    FileText,
    Eye,
    History,
    Fingerprint,
    ChevronLeft,
    AlertCircle
} from 'lucide-react'
import Link from 'next/link'

// Tipos internos
interface FuncionarioComInventario {
    funcionario_id: string
    funcionario_nome: string
    funcionario_matricula?: string
    total_itens: number
    ultima_entrega?: string
    ultima_biometria?: string
}

interface ItemInventarioFuncionario {
    id: string
    codigo: string
    nome: string
    categoria: string
    quantidade: number
    data_entrega: string
    data_vencimento?: string
    validade_laudo?: string
    status: string
}

interface HistoricoItem {
    id: string
    data: string
    data_devolucao?: string
    tipo: string
    item_nome: string
    quantidade: number
    responsavel?: string
}

interface EquipeComInventario {
    equipe_id: string
    equipe_nome: string
    total_itens: number
    itens_disponiveis: number
    itens_em_uso: number
}

export default function SESMTInventariosPage() {
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selectedFuncionario, setSelectedFuncionario] = useState<FuncionarioComInventario | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [modalTab, setModalTab] = useState<'inventario' | 'historico'>('inventario')
    const [inventarioFuncionario, setInventarioFuncionario] = useState<ItemInventarioFuncionario[]>([])
    const [historicoFuncionario, setHistoricoFuncionario] = useState<HistoricoItem[]>([])
    const [ultimaBiometria, setUltimaBiometria] = useState<string | null>(null)
    const [loadingModal, setLoadingModal] = useState(false)
    const [generatingPdf, setGeneratingPdf] = useState(false)
    const [selectedEquipe, setSelectedEquipe] = useState<EquipeComInventario | null>(null)
    const [equipeModalOpen, setEquipeModalOpen] = useState(false)
    const [inventarioEquipeDetalhes, setInventarioEquipeDetalhes] = useState<{ codigo: string; nome: string; quantidade_total: number; quantidade_em_uso: number; data_entrega: string; numero_ca?: string; validade_laudo?: string }[]>([])
    const [loadingEquipeModal, setLoadingEquipeModal] = useState(false)
    const [generatingEpcPdf, setGeneratingEpcPdf] = useState(false)

    const { notify } = useNotification()

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 300)
        return () => clearTimeout(timer)
    }, [search])

    // Buscar inventário de funcionários
    const { data: inventarioFuncionarios = [], isLoading: loadingFuncionarios } = useQuery({
        queryKey: ['sesmt-inventario-funcionarios'],
        queryFn: async () => {
            const inventarios = await inventarioService.getInventarioFuncionarios()

            // Agrupar por funcionário
            const agrupado = inventarios.reduce((acc, inv) => {
                const funcId = inv.funcionario_id
                if (!acc[funcId]) {
                    acc[funcId] = {
                        funcionario_id: funcId,
                        funcionario_nome: inv.funcionario?.nome || 'N/A',
                        funcionario_matricula: inv.funcionario?.matricula,
                        total_itens: 0,
                        ultima_entrega: inv.data_entrega
                    }
                }
                acc[funcId].total_itens++
                if (inv.data_entrega > (acc[funcId].ultima_entrega || '')) {
                    acc[funcId].ultima_entrega = inv.data_entrega
                }
                return acc
            }, {} as Record<string, FuncionarioComInventario>)

            const funcionariosArray = Object.values(agrupado)
            const funcionarioIds = funcionariosArray.map(f => f.funcionario_id)

            // Buscar biometria em uma única chamada bulk (usa service_role, bypassa RLS)
            if (funcionarioIds.length > 0) {
                try {
                    const res = await fetch('/api/biometric/templates/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_ids: funcionarioIds })
                    })
                    if (res.ok) {
                        const json = await res.json()
                        const porUsuario: Record<string, string> = json.data || {}
                        for (const func of funcionariosArray) {
                            if (porUsuario[func.funcionario_id]) {
                                func.ultima_biometria = porUsuario[func.funcionario_id]
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao buscar biometrias:', error)
                }
            }

            return funcionariosArray
        }
    })


    // Buscar inventário de equipes
    const { data: inventarioEquipes = [], isLoading: loadingEquipes } = useQuery({
        queryKey: ['sesmt-inventario-equipes'],
        queryFn: async () => {
            const inventarios = await inventarioService.getInventarioEquipes()

            // Agrupar por equipe
            const agrupado = inventarios.reduce((acc, inv) => {
                const eqId = inv.equipe_id
                if (!acc[eqId]) {
                    acc[eqId] = {
                        equipe_id: eqId,
                        equipe_nome: inv.equipe?.nome || 'N/A',
                        total_itens: 0,
                        itens_disponiveis: 0,
                        itens_em_uso: 0
                    }
                }
                acc[eqId].total_itens += inv.quantidade_total
                acc[eqId].itens_disponiveis += inv.quantidade_disponivel
                acc[eqId].itens_em_uso += inv.quantidade_em_uso
                return acc
            }, {} as Record<string, EquipeComInventario>)

            return Object.values(agrupado)
        }
    })

    // Filtrar funcionários
    const filteredFuncionarios = useMemo(() => {
        if (!debouncedSearch.trim()) return inventarioFuncionarios
        const searchLower = debouncedSearch.toLowerCase()
        return inventarioFuncionarios.filter(f =>
            f.funcionario_nome.toLowerCase().includes(searchLower) ||
            f.funcionario_matricula?.toLowerCase().includes(searchLower)
        )
    }, [inventarioFuncionarios, debouncedSearch])

    // Filtrar equipes
    const filteredEquipes = useMemo(() => {
        if (!debouncedSearch.trim()) return inventarioEquipes
        const searchLower = debouncedSearch.toLowerCase()
        return inventarioEquipes.filter(e =>
            e.equipe_nome.toLowerCase().includes(searchLower)
        )
    }, [inventarioEquipes, debouncedSearch])

    // Abrir modal de detalhes do funcionário
    async function openFuncionarioDetails(funcionario: FuncionarioComInventario) {
        setSelectedFuncionario(funcionario)
        setModalOpen(true)
        setModalTab('inventario')
        setLoadingModal(true)

        try {
            // Carregar inventário
            const invData = await inventarioService.getInventarioByFuncionario(funcionario.funcionario_id)
            setInventarioFuncionario(invData.map(inv => ({
                id: inv.id,
                codigo: inv.item_estoque?.codigo || '',
                nome: inv.item_estoque?.nome || '',
                categoria: inv.item_estoque?.categoria || '',
                quantidade: inv.quantidade,
                data_entrega: inv.data_entrega,
                data_vencimento: inv.data_vencimento,
                validade_laudo: inv.validade_laudo,
                status: inv.status
            })))


            // Carregar histórico
            const histData = await estoqueService.getHistoricoFuncionario(funcionario.funcionario_id)
            setHistoricoFuncionario(histData.map(h => ({
                id: h.id,
                data: h.data_entrega,
                data_devolucao: h.data_devolucao,
                tipo: h.tipo_movimentacao,
                item_nome: h.item?.nome || '',
                quantidade: h.quantidade,
                responsavel: h.tipo_movimentacao === 'devolucao'
                    ? (h.responsavel_devolucao || h.responsavel_entrega)
                    : h.responsavel_entrega
            })))

            // Buscar última biometria
            const biometria = await fichaEpiPdfService.buscarUltimaValidacaoBiometrica(funcionario.funcionario_id)
            setUltimaBiometria(biometria?.data || null)

        } catch (error) {
            console.error('Erro ao carregar detalhes:', error)
            notify('Erro ao carregar detalhes do funcionário', 'error')
        } finally {
            setLoadingModal(false)
        }
    }

    // Gerar PDF da ficha de EPI
    async function gerarFichaEpi() {
        if (!selectedFuncionario) return

        setGeneratingPdf(true)
        try {
            await fichaEpiPdfService.visualizarFichaEpi(selectedFuncionario.funcionario_id)
            notify('Ficha de EPI gerada com sucesso!', 'success')
        } catch (error) {
            console.error('Erro ao gerar ficha:', error)
            notify('Erro ao gerar ficha de EPI', 'error')
        } finally {
            setGeneratingPdf(false)
        }
    }

    // Abrir modal de detalhes da equipe
    async function openEquipeDetails(equipe: EquipeComInventario) {
        setSelectedEquipe(equipe)
        setEquipeModalOpen(true)
        setLoadingEquipeModal(true)

        try {
            const invData = await inventarioService.getInventarioByEquipe(equipe.equipe_id)
            setInventarioEquipeDetalhes(invData.map(inv => ({
                codigo: inv.item_estoque?.codigo || '',
                nome: inv.item_estoque?.nome || '',
                quantidade_total: inv.quantidade_total,
                quantidade_em_uso: inv.quantidade_em_uso,
                data_entrega: inv.data_entrega,
                numero_ca: (inv as unknown as Record<string, unknown>).numero_ca as string | undefined,
                validade_laudo: inv.validade_laudo
            })))
        } catch (error) {
            console.error('Erro ao carregar detalhes da equipe:', error)
            notify('Erro ao carregar detalhes da equipe', 'error')
        } finally {
            setLoadingEquipeModal(false)
        }
    }

    // Gerar PDF da ficha de EPC
    async function gerarFichaEpc() {
        if (!selectedEquipe) return

        setGeneratingEpcPdf(true)
        try {
            await fichaEpcPdfService.visualizarFichaEpc(selectedEquipe.equipe_id)
            notify('Ficha de EPC gerada com sucesso!', 'success')
        } catch (error) {
            console.error('Erro ao gerar ficha:', error)
            notify('Erro ao gerar ficha de EPC', 'error')
        } finally {
            setGeneratingEpcPdf(false)
        }
    }

    // Formatar data
    function formatarData(data?: string) {
        if (!data) return '-'
        try {
            return new Date(data).toLocaleDateString('pt-BR')
        } catch {
            return data
        }
    }

    // Formatar data/hora
    function formatarDataHora(data?: string) {
        if (!data) return 'Nunca validou'
        try {
            const d = new Date(data)
            return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`
        } catch {
            return data
        }
    }

    // Estatísticas
    const stats = useMemo(() => ({
        totalFuncionarios: inventarioFuncionarios.length,
        totalEquipes: inventarioEquipes.length,
        totalItensFuncionarios: inventarioFuncionarios.reduce((acc, f) => acc + f.total_itens, 0),
        totalItensEquipes: inventarioEquipes.reduce((acc, e) => acc + e.total_itens, 0)
    }), [inventarioFuncionarios, inventarioEquipes])

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Link href="/sesmt" className="hover:text-blue-600 flex items-center gap-1">
                        <ChevronLeft className="h-4 w-4" />
                        Voltar ao SESMT
                    </Link>
                </div>
                <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-blue-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Inventários</h1>
                        <p className="text-gray-600">Visualize o inventário de EPIs de funcionários e equipes</p>
                    </div>
                </div>
            </div>

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalFuncionarios}</div>
                        <p className="text-xs text-muted-foreground">com itens em posse</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Itens Funcionários</CardTitle>
                        <Package className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.totalItensFuncionarios}</div>
                        <p className="text-xs text-muted-foreground">itens distribuídos</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Equipes</CardTitle>
                        <Users className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{stats.totalEquipes}</div>
                        <p className="text-xs text-muted-foreground">com inventário</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Itens Equipes</CardTitle>
                        <Package className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats.totalItensEquipes}</div>
                        <p className="text-xs text-muted-foreground">itens em equipes</p>
                    </CardContent>
                </Card>
            </div>

            {/* Busca */}
            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por nome, matrícula ou equipe..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="funcionarios" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="funcionarios" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Funcionários ({filteredFuncionarios.length})
                    </TabsTrigger>
                    <TabsTrigger value="equipes" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Equipes ({filteredEquipes.length})
                    </TabsTrigger>
                </TabsList>

                {/* Tab Funcionários */}
                <TabsContent value="funcionarios">
                    <Card>
                        <CardContent className="pt-6">
                            {loadingFuncionarios ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                </div>
                            ) : filteredFuncionarios.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                    <p>Nenhum funcionário com inventário encontrado</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Nome</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Matrícula</th>
                                                <th className="text-center py-3 px-4 font-medium text-gray-600">Itens</th>
                                                <th className="text-center py-3 px-4 font-medium text-gray-600">Última Entrega</th>
                                                <th className="text-center py-3 px-4 font-medium text-gray-600">Última Biometria</th>
                                                <th className="text-center py-3 px-4 font-medium text-gray-600">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredFuncionarios.map((funcionario) => (
                                                <tr key={funcionario.funcionario_id} className="border-b hover:bg-gray-50">
                                                    <td className="py-3 px-4 font-medium">{funcionario.funcionario_nome}</td>
                                                    <td className="py-3 px-4 text-gray-600">{funcionario.funcionario_matricula || '-'}</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge variant="secondary">{funcionario.total_itens}</Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-sm text-gray-600">
                                                        {formatarData(funcionario.ultima_entrega)}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {funcionario.ultima_biometria ? (
                                                            <Badge className="bg-green-100 text-green-800">
                                                                <Fingerprint className="h-3 w-3 mr-1" />
                                                                {formatarData(funcionario.ultima_biometria)}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-yellow-600">
                                                                <AlertCircle className="h-3 w-3 mr-1" />
                                                                Nunca
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openFuncionarioDetails(funcionario)}
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            Detalhes
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab Equipes */}
                <TabsContent value="equipes">
                    <Card>
                        <CardContent className="pt-6">
                            {loadingEquipes ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                </div>
                            ) : filteredEquipes.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                    <p>Nenhuma equipe com inventário encontrada</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Equipe</th>
                                                <th className="text-center py-3 px-4 font-medium text-gray-600">Total Itens</th>
                                                <th className="text-center py-3 px-4 font-medium text-gray-600">Disponíveis</th>
                                                <th className="text-center py-3 px-4 font-medium text-gray-600">Em Uso</th>
                                                <th className="text-center py-3 px-4 font-medium text-gray-600">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEquipes.map((equipe) => (
                                                <tr key={equipe.equipe_id} className="border-b hover:bg-gray-50">
                                                    <td className="py-3 px-4 font-medium">{equipe.equipe_nome}</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge variant="secondary">{equipe.total_itens}</Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge className="bg-green-100 text-green-800">{equipe.itens_disponiveis}</Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge className="bg-blue-100 text-blue-800">{equipe.itens_em_uso}</Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openEquipeDetails(equipe)}
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            Detalhes
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal de Detalhes do Funcionário */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            {selectedFuncionario?.funcionario_nome}
                            {selectedFuncionario?.funcionario_matricula && (
                                <Badge variant="outline">{selectedFuncionario.funcionario_matricula}</Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {loadingModal ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Última Biometria */}
                            <div className={`p-4 rounded-lg ${ultimaBiometria ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                                <div className="flex items-center gap-2">
                                    <Fingerprint className={`h-5 w-5 ${ultimaBiometria ? 'text-green-600' : 'text-yellow-600'}`} />
                                    <span className="font-medium">Última Validação Biométrica:</span>
                                    <span className={ultimaBiometria ? 'text-green-700' : 'text-yellow-700'}>
                                        {formatarDataHora(ultimaBiometria || undefined)}
                                    </span>
                                </div>
                            </div>

                            {/* Tabs do Modal */}
                            <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as 'inventario' | 'historico')}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="inventario" className="flex items-center gap-2">
                                        <Package className="h-4 w-4" />
                                        Inventário Atual ({inventarioFuncionario.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="historico" className="flex items-center gap-2">
                                        <History className="h-4 w-4" />
                                        Histórico ({historicoFuncionario.length})
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="inventario" className="mt-4">
                                    {inventarioFuncionario.length === 0 ? (
                                        <p className="text-center text-gray-500 py-4">Nenhum item em posse</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-gray-50">
                                                        <th className="text-left py-2 px-3">Código</th>
                                                        <th className="text-left py-2 px-3">Item</th>
                                                        <th className="text-center py-2 px-3">Qtd</th>
                                                        <th className="text-center py-2 px-3">Entrega</th>
                                                        <th className="text-center py-2 px-3">Validade</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {inventarioFuncionario.map((item) => (
                                                        <tr key={item.id} className="border-b">
                                                            <td className="py-2 px-3">{item.codigo}</td>
                                                            <td className="py-2 px-3">{item.nome}</td>
                                                            <td className="py-2 px-3 text-center">{item.quantidade}</td>
                                                            <td className="py-2 px-3 text-center">{formatarData(item.data_entrega)}</td>
                                                            <td className="py-2 px-3 text-center">{formatarData(item.validade_laudo)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="historico" className="mt-4">
                                    {historicoFuncionario.length === 0 ? (
                                        <p className="text-center text-gray-500 py-4">Nenhum histórico encontrado</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-gray-50">
                                                        <th className="text-left py-2 px-3">Data</th>
                                                        <th className="text-left py-2 px-3">Tipo</th>
                                                        <th className="text-left py-2 px-3">Item</th>
                                                        <th className="text-center py-2 px-3">Qtd</th>
                                                        <th className="text-left py-2 px-3">Responsável</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {historicoFuncionario.map((h) => (
                                                        <tr key={h.id} className="border-b">
                                                            <td className="py-2 px-3 text-sm">
                                                                {h.tipo === 'devolucao' && h.data_devolucao
                                                                    ? formatarData(h.data_devolucao)
                                                                    : formatarData(h.data)}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                <Badge variant={
                                                                    h.tipo === 'entrega' ? 'default'
                                                                    : h.tipo === 'devolucao' ? 'destructive'
                                                                    : 'secondary'
                                                                }>
                                                                    {h.tipo === 'entrega' ? 'Entrega'
                                                                    : h.tipo === 'devolucao' ? 'Devolução'
                                                                    : h.tipo}
                                                                </Badge>
                                                            </td>
                                                            <td className="py-2 px-3">{h.item_nome}</td>
                                                            <td className="py-2 px-3 text-center">{h.quantidade}</td>
                                                            <td className="py-2 px-3">{h.responsavel || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>

                            {/* Botão Gerar PDF */}
                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => setModalOpen(false)}
                                >
                                    Fechar
                                </Button>
                                <Button
                                    onClick={gerarFichaEpi}
                                    disabled={generatingPdf}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {generatingPdf ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                            Gerando...
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="h-4 w-4 mr-2" />
                                            Gerar Ficha de EPI
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal de Detalhes da Equipe */}
            <Dialog open={equipeModalOpen} onOpenChange={setEquipeModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-green-600" />
                            {selectedEquipe?.equipe_nome}
                        </DialogTitle>
                    </DialogHeader>

                    {loadingEquipeModal ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {inventarioEquipeDetalhes.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">Nenhum item no inventário</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-gray-50">
                                                <th className="text-left py-2 px-3">Código</th>
                                                <th className="text-left py-2 px-3">Item</th>
                                                <th className="text-center py-2 px-3">Qtd Total</th>
                                                <th className="text-center py-2 px-3">Em Uso</th>
                                                <th className="text-center py-2 px-3">Entrega</th>
                                                <th className="text-center py-2 px-3">CA</th>
                                                <th className="text-center py-2 px-3">Validade</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inventarioEquipeDetalhes.map((item, idx) => (
                                                <tr key={idx} className="border-b">
                                                    <td className="py-2 px-3">{item.codigo}</td>
                                                    <td className="py-2 px-3">{item.nome}</td>
                                                    <td className="py-2 px-3 text-center">{item.quantidade_total}</td>
                                                    <td className="py-2 px-3 text-center">{item.quantidade_em_uso}</td>
                                                    <td className="py-2 px-3 text-center">{formatarData(item.data_entrega)}</td>
                                                    <td className="py-2 px-3 text-center">{item.numero_ca || '-'}</td>
                                                    <td className="py-2 px-3 text-center">{formatarData(item.validade_laudo)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => setEquipeModalOpen(false)}
                                >
                                    Fechar
                                </Button>
                                <Button
                                    onClick={gerarFichaEpc}
                                    disabled={generatingEpcPdf}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {generatingEpcPdf ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                            Gerando...
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="h-4 w-4 mr-2" />
                                            Gerar Ficha de EPC
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
