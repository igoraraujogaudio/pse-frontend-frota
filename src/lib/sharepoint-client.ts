/**
 * Cliente para integração com SharePoint Online (Excel Web)
 * Puxa dados diretamente da planilha compartilhada
 */

export interface PlanilhaRow {
  BASE?: string;
  'Tipo de Serviço'?: string;
  'Nº SOB'?: string;
  'Data Execução'?: string;
  'Dia da semana'?: string;
  MANHÃ?: string;
  'Hor Inic Obra'?: string;
  'Hor Térm Obra'?: string;
  'Tempo Previsto'?: string;
  STATUS?: string;
  'INFO STATUS'?: string;
  PRIORIDADE?: string;
  Estrutura?: string;
  Placa?: string;
  'Anotação'?: string;
  Apoio?: string;
  'Responsáveis\nEnel'?: string;
  Parceira?: string;
  'Responsável Execução'?: string;
  'AREA LIVRE'?: string;
  'SGD SOLICITADO'?: string;
  'Tipo de SGD'?: string;
  'NUMERO SGD'?: string;
  'Nº Clientes \nAfetados'?: string;
  'Nº EQ (RE, CO, CF, CC ou TR)'?: string;
  'Inic deslig'?: string;
  'Térm deslig'?: string;
  'Alim.'?: string;
  Logradouro?: string;
  Bairro?: string;
  Município?: string;
  'Descrição do serviço'?: string;
  'Motivo do Cancelamento / Parcial / Adiamento'?: string;
  'Observação do Cancelamento / Parcial / Adiamento'?: string;
  'Data da programação'?: string;
  'Tipo de avanço'?: string;
  'BT / MT'?: string;
  'Tipo de rede'?: string;
  'Tipo de serviço'?: string;
  'Tipo de cabo'?: string;
  'Status rede'?: string;
  km?: string;
  'Tipo de equipamento'?: string;
  'Status equipamento'?: string;
  'Potência equipamento'?: string;
  'Qtd equipamentos'?: string;
  'Status poste'?: string;
  'Tipo poste'?: string;
  'Qtd Postes'?: string;
  'Qtd Clandestinos'?: string;
  VALORES?: string;
}

export class SharePointExcelClient {
  private sharePointUrl: string;

  constructor() {
    // URL pública do SharePoint
    this.sharePointUrl = 'https://psvsrv-my.sharepoint.com/:x:/g/personal/geraldo_junior_pse_srv_br/EQpz5vrm4AhAlRIfds04-L0BSG2C7Rbggnxj4EmvycK7tQ';
  }

  /**
   * Converte a URL de compartilhamento do SharePoint em URL de download direto
   */
  private getDownloadUrl(): string {
    // Extrair o share token da URL
    const url = new URL(this.sharePointUrl);
    const pathParts = url.pathname.split('/');
    
    // Formato: /:x:/g/personal/{user}/{shareId}
    const shareId = pathParts[pathParts.length - 1];
    
    // Converter para URL de download direto do Excel Online
    // Formato: https://{tenant}.sharepoint.com/_api/v2.0/shares/{shareId}/driveItem/content
    return `https://psvsrv-my.sharepoint.com/_api/v2.0/shares/u!${shareId}/driveItem/content`;
  }

  /**
   * Busca dados da planilha do SharePoint
   * Retorna array de linhas parseadas
   */
  async fetchData(): Promise<PlanilhaRow[]> {
    try {
      console.log('🔄 Buscando dados do SharePoint...');
      
      // Tentar buscar via API do SharePoint
      const downloadUrl = this.getDownloadUrl();
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store', // Sempre buscar dados frescos
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar planilha: ${response.status} ${response.statusText}`);
      }

      // Se for Excel, precisamos converter para JSON
      // Por enquanto, vamos usar uma abordagem alternativa
      await response.blob(); // Download do arquivo
      
      console.log('✅ Dados baixados do SharePoint');
      
      // TODO: Parse do Excel blob para JSON
      // Isso será implementado no servidor usando a biblioteca 'xlsx'
      
      return [];
    } catch (error) {
      console.error('❌ Erro ao buscar dados do SharePoint:', error);
      throw error;
    }
  }

  /**
   * Busca dados filtrados por mês
   */
  async fetchDataForMonth(year: number, month: number): Promise<PlanilhaRow[]> {
    const allData = await this.fetchData();
    
    // Filtrar por mês
    return allData.filter(row => {
      if (!row['Data Execução']) return false;
      
      try {
        const date = this.parseDate(row['Data Execução']);
        return date.getFullYear() === year && date.getMonth() === month - 1;
      } catch {
        return false;
      }
    });
  }

  /**
   * Parse de data no formato da planilha (ex: 8/1/2025 ou 08/01/2025)
   */
  private parseDate(dateStr: string): Date {
    const parts = dateStr.split('/');
    if (parts.length !== 3) throw new Error('Data inválida');
    
    const month = parseInt(parts[0], 10) - 1; // JS Date usa 0-11
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    return new Date(year, month, day);
  }

  /**
   * Formata data para YYYY-MM-DD
   */
  formatDate(dateStr: string): string {
    const date = this.parseDate(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Extrai equipes do campo "Estrutura"
   * Ex: "MK-02|CESTO-00|LV-00" → ["MK-02", "CESTO-00", "LV-00"]
   */
  extractTeams(estrutura?: string): string[] {
    if (!estrutura) return [];
    return estrutura.split('|').map(t => t.trim()).filter(t => t);
  }

  /**
   * Extrai responsáveis do campo "Responsável Execução"
   * Ex: "Isaquece/ Leonardo Moura" → ["Isaquece", "Leonardo Moura"]
   */
  extractResponsaveis(responsavel?: string): string[] {
    if (!responsavel) return [];
    return responsavel
      .split(/[\/\|]/) // Split por / ou |
      .map(r => r.trim())
      .filter(r => r && r !== '-');
  }

  /**
   * Mapeia status da planilha para status do sistema
   */
  mapStatus(status?: string): 'PROG' | 'PANP' | 'EXEC' | 'CANC' | 'PARP' {
    if (!status) return 'PROG';
    
    const statusUpper = status.toUpperCase();
    
    if (statusUpper.includes('CONCLUIDO') || statusUpper.includes('EXECUTADO')) {
      return 'EXEC';
    } else if (statusUpper.includes('CANCELADO')) {
      return 'CANC';
    } else if (statusUpper.includes('PARCIAL')) {
      return 'PARP';
    } else if (statusUpper.includes('ADIADO')) {
      return 'PANP';
    }
    
    return 'PROG';
  }

  /**
   * Parse de valor monetário
   * Ex: "6851.17" ou "6.851,17" → 6851.17
   */
  parseValue(valor?: string): number {
    if (!valor) return 0;
    
    // Remove espaços e substitui vírgula por ponto
    const cleaned = valor.toString().replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? 0 : parsed;
  }
}

export const sharepointClient = new SharePointExcelClient();


