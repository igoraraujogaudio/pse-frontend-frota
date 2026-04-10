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
}

export class DescontoMaterialPdfService {
  
  async gerarPdf(ordemId: string): Promise<Blob> {
    try {
      // Buscar dados da ordem
      const { data: ordem, error } = await supabase
        .from('ordens_desconto')
        .select('*')
        .eq('id', ordemId)
        .eq('almoxarifado', true)
        .single();

      if (error) throw error;
      if (!ordem) throw new Error('Ordem não encontrada');

      // Buscar template HTML
      const templateResponse = await fetch('/templates/descontoMaterialPdf.html');
      let template = await templateResponse.text();

      // Preparar dados para substituição
      const dados = this.prepararDados(ordem as OrdemDescontoMaterial);

      // Substituir placeholders no template
      template = this.substituirPlaceholders(template, dados);

      // Gerar PDF usando Puppeteer ou similar
      const pdfBlob = await this.htmlParaPdf(template);
      
      return pdfBlob;
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      throw error;
    }
  }

  private prepararDados(ordem: OrdemDescontoMaterial) {
    const itens = ordem.itens_inventario || [];
    
    // Gerar linhas da tabela de itens
    const itensTabela = itens.map(item => `
      <tr>
        <td>
          <div class="item-name">${item.nome_item}</div>
        </td>
        <td class="text-center">${item.quantidade}</td>
        <td class="text-right">R$ ${item.valor_unitario.toFixed(2).replace('.', ',')}</td>
        <td class="text-right">R$ ${item.valor_total.toFixed(2).replace('.', ',')}</td>
        <td>
          <div class="item-motive">${item.motivo_desconto}</div>
        </td>
      </tr>
    `).join('');

    // Gerar lista de documentos
    const documentosLista = ordem.documentos_comprobatórios?.map(doc => 
      `<li>${doc}</li>`
    ).join('') || '<li>Nenhum documento anexado</li>';

    // Gerar testemunhas
    const testemunhasHtml = this.gerarTestemunhas(ordem.testemunhas || []);

    // Converter valor para extenso
    const valorExtenso = this.numeroParaExtenso(ordem.valor_total);

    return {
      nome_colaborador: ordem.funcionario_nome,
      cpf: this.formatarCPF(ordem.funcionario_cpf),
      descricao: ordem.descricao,
      valor_total: ordem.valor_total.toFixed(2).replace('.', ','),
      valor_total_extenso: valorExtenso,
      itens_tabela: itensTabela,
      documentos_comprobatórios: documentosLista,
      testemunhas: testemunhasHtml,
      data_geracao: new Date(ordem.criado_em).toLocaleDateString('pt-BR'),
      estado_base: this.obterEstadoBase(ordem.base_nome)
    };
  }

  private substituirPlaceholders(template: string, dados: Record<string, string | number>): string {
    let resultado = template;
    
    Object.keys(dados).forEach(key => {
      const placeholder = `{{${key}}}`;
      resultado = resultado.replace(new RegExp(placeholder, 'g'), String(dados[key]));
    });

    return resultado;
  }

  private gerarTestemunhas(testemunhas: string[]): string {
    if (!testemunhas || testemunhas.length === 0) {
      return `
        <tr>
          <td style="width:24px; vertical-align:bottom;">1:</td>
          <td class="assinatura-nome"></td>
          <td style="width:16px; text-align:center; vertical-align:bottom;">/</td>
          <td class="assinatura-cpf"></td>
        </tr>
        <tr>
          <td style="width:24px; vertical-align:bottom;">2:</td>
          <td class="assinatura-nome"></td>
          <td style="width:16px; text-align:center; vertical-align:bottom;">/</td>
          <td class="assinatura-cpf"></td>
        </tr>
      `;
    }

    return testemunhas.map((testemunha, index) => {
      const [nome, cpf] = testemunha.split(' - ');
      return `
        <tr>
          <td style="width:24px; vertical-align:bottom;">${index + 1}:</td>
          <td class="assinatura-nome">${nome || ''}</td>
          <td style="width:16px; text-align:center; vertical-align:bottom;">/</td>
          <td class="assinatura-cpf">${cpf || ''}</td>
        </tr>
      `;
    }).join('');
  }

  private formatarCPF(cpf: string): string {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  private obterEstadoBase(baseNome: string): string {
    // Mapear nomes de base para estados (ajustar conforme necessário)
    const mapeamentoEstados: { [key: string]: string } = {
      'São Paulo': 'São Paulo',
      'Rio de Janeiro': 'Rio de Janeiro',
      'Belo Horizonte': 'Minas Gerais',
      'Salvador': 'Bahia',
      'Brasília': 'Distrito Federal',
      'Fortaleza': 'Ceará',
      'Recife': 'Pernambuco',
      'Porto Alegre': 'Rio Grande do Sul',
      'Curitiba': 'Paraná',
      'Goiânia': 'Goiás'
    };

    return mapeamentoEstados[baseNome] || 'São Paulo';
  }

  private numeroParaExtenso(valor: number): string {
    // Implementação simplificada - pode ser melhorada
    const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    
    if (valor === 0) return 'zero reais';
    if (valor === 1) return 'um real';
    
    const reais = Math.floor(valor);
    const centavos = Math.round((valor - reais) * 100);
    
    let resultado = '';
    
    if (reais > 0) {
      if (reais >= 1000) {
        const milhares = Math.floor(reais / 1000);
        resultado += this.numeroParaExtenso(milhares) + ' mil ';
        const resto = reais % 1000;
        if (resto > 0) {
          resultado += this.numeroParaExtenso(resto);
        }
      } else if (reais >= 100) {
        const centena = Math.floor(reais / 100);
        resultado += centenas[centena] + ' ';
        const resto = reais % 100;
        if (resto > 0) {
          resultado += this.numeroParaExtenso(resto);
        }
      } else if (reais >= 20) {
        const dezena = Math.floor(reais / 10);
        resultado += dezenas[dezena] + ' ';
        const resto = reais % 10;
        if (resto > 0) {
          resultado += unidades[resto] + ' ';
        }
      } else if (reais >= 10) {
        if (reais === 10) resultado += 'dez ';
        else if (reais === 11) resultado += 'onze ';
        else if (reais === 12) resultado += 'doze ';
        else if (reais === 13) resultado += 'treze ';
        else if (reais === 14) resultado += 'quatorze ';
        else if (reais === 15) resultado += 'quinze ';
        else if (reais === 16) resultado += 'dezesseis ';
        else if (reais === 17) resultado += 'dezessete ';
        else if (reais === 18) resultado += 'dezoito ';
        else if (reais === 19) resultado += 'dezenove ';
      } else {
        resultado += unidades[reais] + ' ';
      }
      
      resultado += reais === 1 ? 'real' : 'reais';
    }
    
    if (centavos > 0) {
      if (reais > 0) resultado += ' e ';
      if (centavos === 1) resultado += 'um centavo';
      else resultado += this.numeroParaExtenso(centavos) + ' centavos';
    }
    
    return resultado.trim();
  }

  private async htmlParaPdf(html: string): Promise<Blob> {
    // Esta função precisa ser implementada com uma biblioteca de geração de PDF
    // Por exemplo, usando Puppeteer, jsPDF, ou uma API externa
    
    // Implementação temporária - retorna um blob vazio
    // Em produção, usar uma biblioteca como Puppeteer ou API de PDF
    console.log('HTML gerado:', html);
    
    // Exemplo com jsPDF (se disponível):
    // const { jsPDF } = await import('jspdf');
    // const doc = new jsPDF();
    // doc.html(html, { callback: () => doc.save() });
    
    // Por enquanto, retorna um blob vazio
    return new Blob([html], { type: 'text/html' });
  }

  async downloadPdf(ordemId: string): Promise<void> {
    try {
      const pdfBlob = await this.gerarPdf(ordemId);
      
      // Criar link de download
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `desconto_material_${ordemId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao fazer download do PDF:', error);
      throw error;
    }
  }

  async visualizarPdf(ordemId: string): Promise<void> {
    try {
      const pdfBlob = await this.gerarPdf(ordemId);
      
      // Abrir PDF em nova aba
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      
      // Limpar URL após um tempo
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Erro ao visualizar PDF:', error);
      throw error;
    }
  }
}

export const descontoMaterialPdfService = new DescontoMaterialPdfService();


