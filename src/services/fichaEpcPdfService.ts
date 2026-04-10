import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface DadosEquipe {
    id: string
    nome: string
    operacao?: string
    contrato_nome?: string
}

interface ItemInventarioEquipe {
    id: string
    codigo: string
    nome: string
    categoria: string
    quantidade_total: number
    quantidade_disponivel: number
    quantidade_em_uso: number
    data_entrega: string
    numero_laudo?: string
    validade_laudo?: string
    numero_ca?: string
    validade_ca?: string
    status: string
}

interface HistoricoEquipe {
    id: string
    data: string
    data_devolucao?: string
    tipo: string
    item_nome: string
    quantidade: number
    responsavel_nome?: string
}

class FichaEpcPdfService {
    async buscarDadosEquipe(equipeId: string): Promise<DadosEquipe | null> {
        try {
            const { data, error } = await supabase
                .from('equipes')
                .select(`
                    id,
                    nome,
                    operacao,
                    contrato:contratos(nome)
                `)
                .eq('id', equipeId)
                .single()

            if (error || !data) return null

            return {
                id: data.id,
                nome: data.nome,
                operacao: data.operacao,
                contrato_nome: (data.contrato as { nome?: string })?.nome
            }
        } catch {
            return null
        }
    }

    async buscarInventarioEquipe(equipeId: string): Promise<ItemInventarioEquipe[]> {
        try {
            const { data, error } = await supabase
                .from('inventario_equipe')
                .select(`
                    id,
                    quantidade_total,
                    quantidade_disponivel,
                    quantidade_em_uso,
                    data_entrega,
                    numero_laudo,
                    validade_laudo,
                    numero_ca,
                    validade_ca,
                    status,
                    item_estoque:itens_estoque(id, codigo, nome, categoria)
                `)
                .eq('equipe_id', equipeId)
                .eq('status', 'ativo')
                .order('data_entrega', { ascending: false })

            if (error) throw error

            return (data || []).map(item => ({
                id: item.id,
                codigo: (item.item_estoque as { codigo?: string })?.codigo || '',
                nome: (item.item_estoque as { nome?: string })?.nome || '',
                categoria: (item.item_estoque as { categoria?: string })?.categoria || '',
                quantidade_total: item.quantidade_total,
                quantidade_disponivel: item.quantidade_disponivel,
                quantidade_em_uso: item.quantidade_em_uso,
                data_entrega: item.data_entrega,
                numero_laudo: item.numero_laudo,
                validade_laudo: item.validade_laudo,
                numero_ca: item.numero_ca,
                validade_ca: item.validade_ca,
                status: item.status
            }))
        } catch (error) {
            console.error('Erro ao buscar inventário da equipe:', error)
            return []
        }
    }

    async buscarHistoricoEquipe(equipeId: string): Promise<HistoricoEquipe[]> {
        try {
            const { data, error } = await supabase
                .from('historico_equipe')
                .select(`
                    id,
                    data_entrega,
                    data_devolucao,
                    tipo_movimentacao,
                    quantidade,
                    responsavel_entrega,
                    item:itens_estoque(nome)
                `)
                .eq('equipe_id', equipeId)
                .eq('tipo_movimentacao', 'devolucao')
                .order('data_entrega', { ascending: false })
                .limit(50)

            if (error) throw error

            return (data || []).map(h => ({
                id: h.id,
                data: h.data_entrega,
                data_devolucao: h.data_devolucao,
                tipo: h.tipo_movimentacao,
                item_nome: (h.item as { nome?: string })?.nome || '',
                quantidade: h.quantidade,
                responsavel_nome: h.responsavel_entrega
            }))
        } catch (error) {
            console.error('Erro ao buscar histórico da equipe:', error)
            return []
        }
    }

    async gerarFichaEpcPdf(equipeId: string): Promise<Blob> {
        try {
            const [equipe, inventario, historico] = await Promise.all([
                this.buscarDadosEquipe(equipeId),
                this.buscarInventarioEquipe(equipeId),
                this.buscarHistoricoEquipe(equipeId)
            ])

            if (!equipe) throw new Error('Equipe não encontrada')

            const templateResponse = await fetch('/templates/fichaEpcPdf.html')
            let template = await templateResponse.text()

            const dados = this.prepararDados(equipe, inventario, historico)

            template = this.substituirPlaceholders(template, dados)

            return new Blob([template], { type: 'text/html' })
        } catch (error) {
            console.error('Erro ao gerar ficha de EPC:', error)
            throw error
        }
    }

    private prepararDados(
        equipe: DadosEquipe,
        inventario: ItemInventarioEquipe[],
        historico: HistoricoEquipe[] = []
    ) {
        const itensTabela = inventario.length > 0
            ? inventario.map(item => `
        <tr>
          <td>${item.codigo}</td>
          <td>${item.nome}</td>
          <td class="text-center">${item.quantidade_total}</td>
          <td class="text-center">${item.quantidade_em_uso}</td>
          <td class="text-center">${this.formatarData(item.data_entrega)}</td>
          <td class="text-center">${item.numero_ca || '-'}</td>
          <td class="text-center">${item.validade_laudo ? this.formatarData(item.validade_laudo) : '-'}</td>
        </tr>
      `).join('')
            : '<tr><td colspan="7" class="text-center">Nenhum item no inventário</td></tr>'

        const devolucoesTabela = historico.length > 0
            ? historico.map(h => {
                const dataExibida = h.data_devolucao
                    ? this.formatarData(h.data_devolucao)
                    : this.formatarData(h.data)
                return `
        <tr>
          <td class="text-center">${dataExibida}</td>
          <td class="text-center"><span class="tipo-badge tipo-devolucao">Devolução</span></td>
          <td>${h.item_nome}</td>
          <td class="text-center">${h.quantidade}</td>
          <td>${h.responsavel_nome || '-'}</td>
        </tr>
      `
            }).join('')
            : '<tr><td colspan="5" class="text-center">Nenhuma devolução registrada</td></tr>'

        return {
            nome_equipe: equipe.nome,
            operacao: equipe.operacao || '-',
            contrato: equipe.contrato_nome || '-',
            itens_tabela: itensTabela,
            total_itens: inventario.length.toString(),
            total_quantidade: inventario.reduce((acc, i) => acc + i.quantidade_total, 0).toString(),
            historico_tabela: devolucoesTabela,
            total_historico: historico.length.toString(),
            data_geracao: new Date().toLocaleDateString('pt-BR'),
            hora_geracao: new Date().toLocaleTimeString('pt-BR')
        }
    }

    private substituirPlaceholders(template: string, dados: Record<string, string | number>): string {
        let resultado = template
        for (const [chave, valor] of Object.entries(dados)) {
            const regex = new RegExp(`{{${chave}}}`, 'g')
            resultado = resultado.replace(regex, String(valor))
        }
        return resultado
    }

    private formatarData(dataString: string): string {
        try {
            return new Date(dataString).toLocaleDateString('pt-BR')
        } catch {
            return dataString
        }
    }

    async visualizarFichaEpc(equipeId: string): Promise<void> {
        try {
            const pdfBlob = await this.gerarFichaEpcPdf(equipeId)
            const url = URL.createObjectURL(pdfBlob)
            const printWindow = window.open(url, '_blank')
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => URL.revokeObjectURL(url), 60000)
                }
            }
        } catch (error) {
            console.error('Erro ao visualizar ficha de EPC:', error)
            throw error
        }
    }
}

export const fichaEpcPdfService = new FichaEpcPdfService()
