import { supabase } from '@/lib/supabase'
import { estoqueService } from './estoqueService'

// Interface para dados do funcionário
interface DadosFuncionario {
    id: string
    nome: string
    matricula?: string
    cargo?: string
    cpf?: string
    contrato_nome?: string
}

// Interface para item de inventário
interface ItemInventario {
    id: string
    codigo: string
    nome: string
    categoria: string
    quantidade: number
    data_entrega: string
    data_vencimento?: string
    validade_laudo?: string
    numero_ca?: string
    validade_ca?: string
    status: string
}


// Interface para última validação biométrica
interface UltimaValidacaoBiometrica {
    data: string
    qualidade: number
    item_nome?: string
}

// Interface para histórico de movimentação
interface HistoricoMovimentacao {
    id: string
    data: string
    data_devolucao?: string
    tipo: string
    item_nome: string
    quantidade: number
    responsavel_nome?: string
    observacoes?: string
}

class FichaEpiPdfService {
    /**
   * Busca a última validação biométrica do funcionário
   * Retorna null se a tabela não existir ou não houver registros
   */
    async buscarUltimaValidacaoBiometrica(funcionarioId: string): Promise<UltimaValidacaoBiometrica | null> {
        try {
            // Usar API route com service_role para bypassar RLS
            const res = await fetch(`/api/biometric/templates/user/${funcionarioId}`)
            if (!res.ok) {
                console.log('Nenhum template biométrico encontrado para o funcionário:', funcionarioId)
                return null
            }

            const json = await res.json()
            const templates = json?.data || []

            if (templates.length === 0) {
                console.log('Nenhum template biométrico encontrado para o funcionário:', funcionarioId)
                return null
            }

            return {
                data: templates[0].created_at,
                qualidade: templates[0].quality || 0,
                item_nome: undefined
            }
        } catch (error) {
            console.error('Erro ao buscar última validação biométrica:', error)
            return null
        }
    }

    /**
     * Busca o inventário completo do funcionário
     */
    async buscarInventarioFuncionario(funcionarioId: string): Promise<ItemInventario[]> {
        try {
            const { data, error } = await supabase
                .from('inventario_funcionario')
                .select(`
          id,
          quantidade,
          data_entrega,
          data_vencimento,
          validade_laudo,
          numero_ca,
          validade_ca,
          status,
          item_estoque:itens_estoque(id, codigo, nome, categoria)
        `)
                .eq('funcionario_id', funcionarioId)
                .eq('status', 'em_uso')
                .order('data_entrega', { ascending: false })

            if (error) {
                console.error('Erro ao buscar inventário do funcionário:', error)
                throw error
            }

            return (data || []).map(item => ({
                id: item.id,
                codigo: (item.item_estoque as { codigo?: string })?.codigo || '',
                nome: (item.item_estoque as { nome?: string })?.nome || '',
                categoria: (item.item_estoque as { categoria?: string })?.categoria || '',
                quantidade: item.quantidade,
                data_entrega: item.data_entrega,
                data_vencimento: item.data_vencimento,
                validade_laudo: item.validade_laudo,
                numero_ca: item.numero_ca,
                validade_ca: item.validade_ca,
                status: item.status
            }))
        } catch (error) {
            console.error('Erro ao buscar inventário:', error)
            return []
        }
    }

    /**
     * Busca histórico de movimentação do funcionário
     */
    async buscarHistoricoMovimentacao(funcionarioId: string): Promise<HistoricoMovimentacao[]> {
        try {
            const historico = await estoqueService.getHistoricoFuncionario(funcionarioId)

            return historico.map(h => ({
                id: h.id,
                data: h.data_entrega,
                data_devolucao: h.data_devolucao,
                tipo: h.tipo_movimentacao,
                item_nome: h.item?.nome || '',
                quantidade: h.quantidade,
                responsavel_nome: h.tipo_movimentacao === 'devolucao'
                    ? (h.responsavel_devolucao || h.responsavel_entrega)
                    : h.responsavel_entrega,
                observacoes: h.tipo_movimentacao === 'devolucao'
                    ? h.observacoes_devolucao
                    : h.observacoes_entrega
            }))
        } catch (error) {
            console.error('Erro ao buscar histórico de movimentação:', error)
            return []
        }
    }

    /**
     * Busca dados completos do funcionário
     */
    async buscarDadosFuncionario(funcionarioId: string): Promise<DadosFuncionario | null> {
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select(`
          id,
          nome,
          matricula,
          cargo,
          cpf,
          contrato_origem:contratos!contrato_origem_id(nome)
        `)
                .eq('id', funcionarioId)
                .single()

            if (error || !data) {
                console.error('Erro ao buscar dados do funcionário:', error)
                return null
            }

            return {
                ...data,
                contrato_nome: (data.contrato_origem as { nome?: string })?.nome
            } as DadosFuncionario
        } catch (error) {
            console.error('Erro ao buscar funcionário:', error)
            return null
        }
    }

    /**
     * Gera o PDF da ficha de EPI
     */
    async gerarFichaEpiPdf(funcionarioId: string): Promise<Blob> {
        try {
            // Buscar todos os dados necessários
            const [funcionario, inventario, ultimaBiometria, historico] = await Promise.all([
                this.buscarDadosFuncionario(funcionarioId),
                this.buscarInventarioFuncionario(funcionarioId),
                this.buscarUltimaValidacaoBiometrica(funcionarioId),
                this.buscarHistoricoMovimentacao(funcionarioId)
            ])

            if (!funcionario) {
                throw new Error('Funcionário não encontrado')
            }

            // Buscar template HTML
            const templateResponse = await fetch('/templates/fichaEpiPdf.html')
            let template = await templateResponse.text()

            // Preparar dados para substituição
            const dados = this.prepararDados(funcionario, inventario, ultimaBiometria, historico)

            // Substituir placeholders no template
            template = this.substituirPlaceholders(template, dados)

            // Retornar HTML como blob (será renderizado pelo navegador)
            return new Blob([template], { type: 'text/html' })
        } catch (error) {
            console.error('Erro ao gerar PDF:', error)
            throw error
        }
    }

    private prepararDados(
        funcionario: DadosFuncionario,
        inventario: ItemInventario[],
        ultimaBiometria: UltimaValidacaoBiometrica | null,
        historico: HistoricoMovimentacao[] = []
    ) {
        // Gerar linhas da tabela de itens
        const itensTabela = inventario.length > 0
            ? inventario.map(item => `
        <tr>
          <td>${item.codigo}</td>
          <td>${item.nome}</td>
          <td class="text-center">${item.quantidade}</td>
          <td class="text-center">${this.formatarData(item.data_entrega)}</td>
          <td class="text-center">${item.numero_ca || '-'}</td>
          <td class="text-center">${item.validade_laudo ? this.formatarData(item.validade_laudo) : '-'}</td>
        </tr>
      `).join('')
            : '<tr><td colspan="6" class="text-center">Nenhum item em posse</td></tr>'

        // Status da biometria
        let biometriaStatus = ''
        let biometriaData = ''
        let biometriaClasse = ''

        if (ultimaBiometria) {
            biometriaStatus = 'Validado'
            biometriaData = this.formatarDataHora(ultimaBiometria.data)
            biometriaClasse = 'status-ok'
        } else {
            biometriaStatus = 'Nunca validou por biometria'
            biometriaData = '-'
            biometriaClasse = 'status-warning'
        }

        // Gerar linhas da tabela de histórico (apenas devoluções)
        const apenasDevoluoes = historico.filter(h => h.tipo === 'devolucao')
        const devolucoesTabela = apenasDevoluoes.length > 0
            ? apenasDevoluoes.map(h => {
                const dataExibida = h.tipo === 'devolucao' && h.data_devolucao
                    ? this.formatarData(h.data_devolucao)
                    : this.formatarData(h.data)
                const tipoLabel = h.tipo === 'entrega' ? 'Entrega'
                    : h.tipo === 'devolucao' ? 'Devolução'
                    : h.tipo
                const tipoClasse = h.tipo === 'devolucao' ? 'tipo-devolucao' : 'tipo-entrega'
                return `
        <tr>
          <td class="text-center">${dataExibida}</td>
          <td class="text-center"><span class="tipo-badge ${tipoClasse}">${tipoLabel}</span></td>
          <td>${h.item_nome}</td>
          <td class="text-center">${h.quantidade}</td>
          <td>${h.responsavel_nome || '-'}</td>
        </tr>
      `
            }).join('')
            : '<tr><td colspan="5" class="text-center">Nenhuma devolução registrada</td></tr>'

        return {
            nome_funcionario: funcionario.nome,
            matricula: funcionario.matricula || '-',
            cargo: funcionario.cargo || '-',
            contrato: funcionario.contrato_nome || '-',
            itens_tabela: itensTabela,
            total_itens: inventario.length.toString(),
            historico_tabela: devolucoesTabela,
            total_historico: apenasDevoluoes.length.toString(),
            biometria_status: biometriaStatus,
            biometria_data: biometriaData,
            biometria_classe: biometriaClasse,
            data_geracao: new Date().toLocaleDateString('pt-BR'),
            hora_geracao: new Date().toLocaleTimeString('pt-BR')
        }
    }

    private substituirPlaceholders(template: string, dados: Record<string, string | number>): string {
        let resultado = template

        Object.keys(dados).forEach(key => {
            const placeholder = `{{${key}}}`
            resultado = resultado.replace(new RegExp(placeholder, 'g'), String(dados[key]))
        })

        return resultado
    }

    private formatarData(dataString: string): string {
        if (!dataString) return '-'
        try {
            return new Date(dataString).toLocaleDateString('pt-BR')
        } catch {
            return dataString
        }
    }

    private formatarDataHora(dataString: string): string {
        if (!dataString) return '-'
        try {
            const data = new Date(dataString)
            return `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR')}`
        } catch {
            return dataString
        }
    }

    private formatarCPF(cpf: string): string {
        if (!cpf) return ''
        const numeros = cpf.replace(/\D/g, '')
        return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }

    /**
     * Faz download da ficha de EPI em PDF (abre diálogo de impressão para salvar como PDF)
     */
    async downloadFichaEpi(funcionarioId: string): Promise<void> {
        try {
            const pdfBlob = await this.gerarFichaEpiPdf(funcionarioId)

            // Abrir HTML em nova aba e acionar diálogo de impressão (Salvar como PDF)
            const url = URL.createObjectURL(pdfBlob)
            const novaAba = window.open(url, '_blank')

            if (novaAba) {
                novaAba.onload = () => {
                    novaAba.print()
                }
            }

            setTimeout(() => URL.revokeObjectURL(url), 10000)
        } catch (error) {
            console.error('Erro ao fazer download da ficha:', error)
            throw error
        }
    }

    /**
     * Abre a ficha de EPI em nova aba para impressão
     */
    async visualizarFichaEpi(funcionarioId: string): Promise<void> {
        try {
            const pdfBlob = await this.gerarFichaEpiPdf(funcionarioId)

            // Abrir em nova aba
            const url = URL.createObjectURL(pdfBlob)
            const novaAba = window.open(url, '_blank')

            // Aguardar carregamento e chamar print
            if (novaAba) {
                novaAba.onload = () => {
                    novaAba.print()
                }
            }

            // Limpar URL após um tempo
            setTimeout(() => URL.revokeObjectURL(url), 5000)
        } catch (error) {
            console.error('Erro ao visualizar ficha:', error)
            throw error
        }
    }
}

export const fichaEpiPdfService = new FichaEpiPdfService()
