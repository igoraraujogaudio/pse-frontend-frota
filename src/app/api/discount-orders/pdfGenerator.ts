/* eslint-disable @typescript-eslint/no-require-imports */
import fs from 'fs/promises';
import path from 'path';

const numeroPorExtenso = require('numero-por-extenso');

export function valorPorExtenso(valor: number | undefined): string {
  if (!valor) return 'zero reais';
  try {
    return numeroPorExtenso.porExtenso(valor, numeroPorExtenso.estilo.monetario);
  } catch (error) {
    console.warn('Erro ao usar numero-por-extenso, usando fallback:', error);
    return `${valor} reais`;
  }
}

function formatarValorMoeda(valor: unknown): string {
  if (typeof valor === 'number' && !isNaN(valor)) return valor.toFixed(2);
  if (typeof valor === 'string') { const n = parseFloat(valor); if (!isNaN(n)) return n.toFixed(2); }
  return '0.00';
}

function formatarData(data: unknown): string {
  try {
    if (data) {
      const match = typeof data === 'string' && data.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[3]}/${match[2]}/${match[1]}`;
      const d = (typeof data === 'string' || typeof data === 'number' || data instanceof Date) ? new Date(data) : new Date();
      if (!isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    }
    const h = new Date();
    return `${String(h.getDate()).padStart(2, '0')}/${String(h.getMonth() + 1).padStart(2, '0')}/${h.getFullYear()}`;
  } catch {
    const h = new Date();
    return `${String(h.getDate()).padStart(2, '0')}/${String(h.getMonth() + 1).padStart(2, '0')}/${h.getFullYear()}`;
  }
}

interface HtmlData {
  nomeColaborador: string;
  cpf: string;
  descricao: string;
  placa?: string;
  auto_infracao?: string;
  valor_total: number;
  valor_parcela?: number;
  parcelas?: number;
  documentos?: string[];
  outros_documentos?: string;
  estadoBase: string;
  data_geracao: string;
}

function gerarDocumentosComprobatorios(documentos: string[] = [], outros_documentos?: string): string {
  const opcoes = [
    { label: 'Multa de Trânsito <em>INFRAÇÃO</em>', value: 'Multa de Trânsito' },
    { label: 'Boletim de Ocorrência Policial', value: 'Boletim de Ocorrência Policial' },
    { label: 'Relatório do Setor de Segurança e transporte da empresa', value: 'Relatório do Setor de Segurança' },
    { label: 'Laudo Pericial comprovando dano', value: 'Laudo Pericial' },
    { label: 'NF', value: 'NF' },
    { label: 'RPS', value: 'RPS' },
    { label: 'Outros', value: 'Outros' }
  ];

  return opcoes.map(opt => {
    const marcado = documentos.includes(opt.value);
    let label = opt.label;
    if (opt.value === 'Outros' && marcado && outros_documentos) {
      label += ` — ${outros_documentos}`;
    }
    return `<li>${marcado ? '<b>X</b> ' : ''}${label}</li>`;
  }).join('\n      ');
}

export async function gerarHtmlOrdemDesconto(data: HtmlData): Promise<string> {
  // Ler o template HTML
  const templatePath = path.resolve(process.cwd(), 'src/templates/discountOrderPdf.html');
  let html = await fs.readFile(templatePath, 'utf8');

  const valorTotalFormatado = formatarValorMoeda(data.valor_total);
  const valorExtenso = valorPorExtenso(data.valor_total);
  const dataFormatada = formatarData(data.data_geracao);
  const placaInfo = data.placa ? ` — Placa: ${data.placa}` : '';
  const autoInfracaoInfo = data.auto_infracao ? `<br><span class="bold">Auto de Infração:</span> ${data.auto_infracao}` : '';

  let parcelasInfo = '';
  if (data.parcelas && data.valor_parcela) {
    const vpFormatado = formatarValorMoeda(data.valor_parcela);
    const vpExtenso = valorPorExtenso(data.valor_parcela);
    parcelasInfo = `<span class="bold italic green">${data.parcelas} PARCELAS R$${vpFormatado} (${vpExtenso})</span>`;
  }

  const docsHtml = gerarDocumentosComprobatorios(data.documentos, data.outros_documentos);

  // Substituir placeholders
  const replacements: Record<string, string> = {
    '{{nome_colaborador}}': data.nomeColaborador,
    '{{cpf}}': data.cpf || '________________',
    '{{descricao}}': data.descricao || '________________',
    '{{placa_info}}': placaInfo,
    '{{auto_infracao_info}}': autoInfracaoInfo,
    '{{valor_total}}': valorTotalFormatado,
    '{{valor_total_extenso}}': valorExtenso,
    '{{parcelas_info}}': parcelasInfo,
    '{{documentos_comprobatórios}}': docsHtml,
    '{{estado_base}}': data.estadoBase,
    '{{data_geracao}}': dataFormatada,
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    html = html.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }

  return html;
}
