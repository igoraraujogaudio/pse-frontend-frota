import { supabase } from '@/lib/supabase';

interface ItemDesconto {
  id: string;
  tipo_item_id: string;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  motivo_desconto: string;
  inventario_funcionario_id?: string;
}

interface OrdemDescontoMaterial {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_cpf: string;
  funcionario_matricula: string;
  base_id: string;
  base_nome: string;
  descricao: string;
  valor_total: number;
  itens_inventario: ItemDesconto[];
  documentos_comprobatórios: string[];
  testemunhas: string[];
  status: string;
  criado_em: string;
  assinado_em?: string;
  criado_por: string;
}

export class DescontoMaterialExcelService {
  
  async gerarPlanilhaOrdens(filtros?: {
    dataInicio?: string;
    dataFim?: string;
    status?: string;
    baseId?: string;
  }): Promise<Blob> {
    try {
      // Buscar ordens com filtros
      let query = supabase
        .from('ordens_desconto')
        .select(`
          *,
          criado_por_info:usuarios!criado_por(nome)
        `)
        .eq('almoxarifado', true);

      if (filtros?.dataInicio) {
        query = query.gte('criado_em', filtros.dataInicio);
      }
      if (filtros?.dataFim) {
        query = query.lte('criado_em', filtros.dataFim);
      }
      if (filtros?.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros?.baseId) {
        query = query.eq('base_id', filtros.baseId);
      }

      const { data: ordens, error } = await query.order('criado_em', { ascending: false });

      if (error) throw error;

      // Gerar planilha
      const planilha = this.criarPlanilhaOrdens(ordens as OrdemDescontoMaterial[]);
      
      return planilha;
    } catch (error) {
      console.error('Erro ao gerar planilha de ordens:', error);
      throw error;
    }
  }

  async gerarPlanilhaItensDescartados(filtros?: {
    dataInicio?: string;
    dataFim?: string;
    status?: string;
    baseId?: string;
  }): Promise<Blob> {
    try {
      // Buscar ordens com histórico de descarte
      let query = supabase
        .from('ordens_desconto')
        .select('*')
        .eq('almoxarifado', true)
        .not('historico_descarte', 'eq', '[]');

      if (filtros?.dataInicio) {
        query = query.gte('criado_em', filtros.dataInicio);
      }
      if (filtros?.dataFim) {
        query = query.lte('criado_em', filtros.dataFim);
      }
      if (filtros?.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros?.baseId) {
        query = query.eq('base_id', filtros.baseId);
      }

      const { data: ordens, error } = await query.order('criado_em', { ascending: false });

      if (error) throw error;

      // Gerar planilha de itens
      const planilha = this.criarPlanilhaItens(ordens as OrdemDescontoMaterial[]);
      
      return planilha;
    } catch (error) {
      console.error('Erro ao gerar planilha de itens:', error);
      throw error;
    }
  }

  private criarPlanilhaOrdens(ordens: OrdemDescontoMaterial[]): Blob {
    // Cabeçalhos da planilha
    const cabecalhos = [
      'ID da Ordem',
      'Funcionário',
      'CPF',
      'Matrícula',
      'Base',
      'Descrição',
      'Valor Total',
      'Status',
      'Data Criação',
      'Data Assinatura',
      'Total de Itens',
      'Criado Por'
    ];

    // Dados das ordens
    const dados = ordens.map(ordem => [
      ordem.id,
      ordem.funcionario_nome,
      this.formatarCPF(ordem.funcionario_cpf),
      ordem.funcionario_matricula,
      ordem.base_nome,
      ordem.descricao,
      ordem.valor_total,
      this.traduzirStatus(ordem.status),
      new Date(ordem.criado_em).toLocaleDateString('pt-BR'),
      ordem.assinado_em ? new Date(ordem.assinado_em).toLocaleDateString('pt-BR') : '',
      ordem.itens_inventario?.length || 0,
      (ordem as { criado_por_info?: { nome: string } }).criado_por_info?.nome || ''
    ]);

    // Criar CSV
    const csv = this.arrayParaCSV([cabecalhos, ...dados]);
    
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  private criarPlanilhaItens(ordens: OrdemDescontoMaterial[]): Blob {
    // Cabeçalhos da planilha
    const cabecalhos = [
      'ID da Ordem',
      'Funcionário',
      'CPF',
      'Matrícula',
      'Base',
      'Item',
      'Quantidade',
      'Valor Unitário',
      'Valor Total',
      'Motivo do Desconto',
      'Status do Descarte',
      'Data do Descarte',
      'Data do Reteste',
      'Resultado do Reteste',
      'Observações do Reteste',
      'Data Criação da Ordem'
    ];

    // Dados dos itens (flatten)
    const dados: (string | number)[][] = [];
    
    ordens.forEach(ordem => {
      const ordemComHistorico = ordem as { 
        historico_descarte?: Array<{ 
          nome_item: string; 
          quantidade: number; 
          motivo_descarte: string; 
          observacoes_reteste?: string;
          valor_unitario?: number;
          valor_total?: number;
          motivo_desconto?: string;
          status_descarte?: string;
          data_descarte?: string;
          data_reteste?: string;
          resultado_reteste?: string;
        }> 
      };
      if (ordemComHistorico.historico_descarte && Array.isArray(ordemComHistorico.historico_descarte)) {
        ordemComHistorico.historico_descarte.forEach((item) => {
          dados.push([
            ordem.id,
            ordem.funcionario_nome,
            this.formatarCPF(ordem.funcionario_cpf),
            ordem.funcionario_matricula,
            ordem.base_nome,
            item.nome_item,
            item.quantidade,
            item.valor_unitario || 0,
            item.valor_total || 0,
            item.motivo_desconto || item.motivo_descarte || '',
            this.traduzirStatusDescarte(item.status_descarte || ''),
            item.data_descarte ? new Date(item.data_descarte).toLocaleDateString('pt-BR') : '',
            item.data_reteste ? new Date(item.data_reteste).toLocaleDateString('pt-BR') : '',
            item.resultado_reteste ? this.traduzirResultadoReteste(item.resultado_reteste) : '',
            item.observacoes_reteste || '',
            new Date(ordem.criado_em).toLocaleDateString('pt-BR')
          ]);
        });
      }
    });

    // Criar CSV
    const csv = this.arrayParaCSV([cabecalhos, ...dados]);
    
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  private arrayParaCSV(dados: (string | number)[][]): string {
    return dados.map(linha => 
      linha.map(campo => {
        // Escapar aspas e quebras de linha
        const campoStr = String(campo || '');
        if (campoStr.includes('"') || campoStr.includes('\n') || campoStr.includes(',')) {
          return `"${campoStr.replace(/"/g, '""')}"`;
        }
        return campoStr;
      }).join(',')
    ).join('\n');
  }

  private formatarCPF(cpf: string): string {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  private traduzirStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pendente': 'Pendente',
      'assinada': 'Assinada',
      'recusada': 'Recusada'
    };
    return statusMap[status] || status;
  }

  private traduzirStatusDescarte(status: string): string {
    const statusMap: { [key: string]: string } = {
      'descartado': 'Descartado',
      'reteste': 'Em Reteste',
      'recuperado': 'Recuperado'
    };
    return statusMap[status] || status;
  }

  private traduzirResultadoReteste(resultado: string): string {
    const resultadoMap: { [key: string]: string } = {
      'aprovado': 'Aprovado',
      'reprovado': 'Reprovado',
      'pendente': 'Pendente'
    };
    return resultadoMap[resultado] || resultado;
  }

  async downloadPlanilhaOrdens(filtros?: {
    dataInicio?: string;
    dataFim?: string;
    status?: string;
    baseId?: string;
  }): Promise<void> {
    try {
      const planilha = await this.gerarPlanilhaOrdens(filtros);
      
      // Criar link de download
      const url = URL.createObjectURL(planilha);
      const link = document.createElement('a');
      link.href = url;
      
      const dataAtual = new Date().toISOString().split('T')[0];
      link.download = `ordens_desconto_material_${dataAtual}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao fazer download da planilha de ordens:', error);
      throw error;
    }
  }

  async downloadPlanilhaItens(filtros?: {
    dataInicio?: string;
    dataFim?: string;
    status?: string;
    baseId?: string;
  }): Promise<void> {
    try {
      const planilha = await this.gerarPlanilhaItensDescartados(filtros);
      
      // Criar link de download
      const url = URL.createObjectURL(planilha);
      const link = document.createElement('a');
      link.href = url;
      
      const dataAtual = new Date().toISOString().split('T')[0];
      link.download = `itens_descartados_material_${dataAtual}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao fazer download da planilha de itens:', error);
      throw error;
    }
  }

  // Método para gerar relatório consolidado
  async gerarRelatorioConsolidado(filtros?: {
    dataInicio?: string;
    dataFim?: string;
    baseId?: string;
  }): Promise<{
    totalOrdens: number;
    totalValor: number;
    totalItens: number;
    statusResumo: { [key: string]: number };
    baseResumo: { [key: string]: number };
  }> {
    try {
      let query = supabase
        .from('ordens_desconto')
        .select('*')
        .eq('almoxarifado', true);

      if (filtros?.dataInicio) {
        query = query.gte('criado_em', filtros.dataInicio);
      }
      if (filtros?.dataFim) {
        query = query.lte('criado_em', filtros.dataFim);
      }
      if (filtros?.baseId) {
        query = query.eq('base_id', filtros.baseId);
      }

      const { data: ordens, error } = await query;

      if (error) throw error;

      const totalOrdens = ordens.length;
      const totalValor = ordens.reduce((sum, ordem) => sum + (ordem.valor_total || 0), 0);
      const totalItens = ordens.reduce((sum, ordem) => 
        sum + (ordem.itens_inventario?.length || 0), 0
      );

      const statusResumo: { [key: string]: number } = {};
      const baseResumo: { [key: string]: number } = {};

      ordens.forEach(ordem => {
        // Contar por status
        const status = ordem.status || 'pendente';
        statusResumo[status] = (statusResumo[status] || 0) + 1;

        // Contar por base
        const base = ordem.base_nome || 'Não informada';
        baseResumo[base] = (baseResumo[base] || 0) + 1;
      });

      return {
        totalOrdens,
        totalValor,
        totalItens,
        statusResumo,
        baseResumo
      };
    } catch (error) {
      console.error('Erro ao gerar relatório consolidado:', error);
      throw error;
    }
  }
}

export const descontoMaterialExcelService = new DescontoMaterialExcelService();


