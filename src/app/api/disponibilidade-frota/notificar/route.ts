/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmailToMultiple } from '@/lib/email';
import { sendWhatsAppToMultiple } from '@/lib/whatsapp';

/**
 * POST /api/disponibilidade-frota/notificar
 * Envia notificações (email + WhatsApp) com o resumo da disponibilidade do contrato
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação via JWT do Supabase
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient();
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { contrato_id, data_referencia } = body;

    if (!contrato_id || !data_referencia) {
      return NextResponse.json({ error: 'contrato_id e data_referencia são obrigatórios' }, { status: 400 });
    }

    const supabaseAdmin = createClient();

    // Buscar contrato
    const { data: contrato } = await supabaseAdmin
      .from('contratos')
      .select('id, nome, codigo')
      .eq('id', contrato_id)
      .single();

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 });
    }

    // Buscar registros do dia
    const { data: registros } = await supabaseAdmin
      .from('disponibilidade_frota')
      .select(`
        veiculo_id, status, manutencao_tipo, manutencao_problema, manutencao_previsao, manutencao_oficina_nome, manutencao_complexidade, manutencao_setor, observacoes,
        veiculo:veiculos(placa, modelo),
        equipe:equipes(nome),
        oficina:oficinas(nome)
      `)
      .eq('contrato_id', contrato_id)
      .eq('data_referencia', data_referencia);

    const regs: any[] = registros || [];
    const disponiveis = regs.filter(r => r.status === 'disponivel');
    const emOperacao = regs.filter(r => r.status === 'em_operacao');
    const manutencao = regs.filter(r => r.status === 'manutencao');
    const emManutencao = manutencao.filter(r => r.manutencao_tipo === 'em_manutencao' || !r.manutencao_tipo);
    const emOrcamento = manutencao.filter(r => r.manutencao_tipo === 'em_orcamento');

    // Taxas
    const total = regs.length;
    const taxaDisp = total > 0 ? (disponiveis.length / total * 100).toFixed(1) : '0';
    const taxaOper = total > 0 ? (emOperacao.length / total * 100).toFixed(1) : '0';
    const taxaManut = total > 0 ? (manutencao.length / total * 100).toFixed(1) : '0';

    // Calcular percentual de disponibilidade mensal
    // Disponibilidade = dias em que o veículo esteve em operação ou disponível no mês / total de dias úteis do mês
    const dataRef = new Date(data_referencia + 'T12:00:00Z');
    const mesAtual = dataRef.getMonth();
    const anoAtual = dataRef.getFullYear();
    const primeiroDiaMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`;
    // Último dia é a data de referência (até o dia do envio)
    const ultimoDiaMes = data_referencia;

    const { data: registrosMes } = await supabaseAdmin
      .from('disponibilidade_frota')
      .select('veiculo_id, data_referencia, status')
      .eq('contrato_id', contrato_id)
      .gte('data_referencia', primeiroDiaMes)
      .lte('data_referencia', ultimoDiaMes);

    const regsMes: any[] = registrosMes || [];
    // Contar dias únicos no mês que tiveram registros
    const diasUnicosMes = [...new Set(regsMes.map(r => r.data_referencia))].length;
    // Para cada veículo, contar dias disponível ou em operação
    const veiculoDisponibilidadeMes: Record<string, { disponivel: number; total: number }> = {};
    for (const r of regsMes) {
      if (!veiculoDisponibilidadeMes[r.veiculo_id]) {
        veiculoDisponibilidadeMes[r.veiculo_id] = { disponivel: 0, total: 0 };
      }
      veiculoDisponibilidadeMes[r.veiculo_id].total++;
      if (r.status === 'disponivel' || r.status === 'em_operacao') {
        veiculoDisponibilidadeMes[r.veiculo_id].disponivel++;
      }
    }
    // Percentual geral: soma de dias disponíveis de todos veículos / soma de dias totais
    const totalDiasDispMes = Object.values(veiculoDisponibilidadeMes).reduce((s, v) => s + v.disponivel, 0);
    const totalDiasRegMes = Object.values(veiculoDisponibilidadeMes).reduce((s, v) => s + v.total, 0);
    const percentualDispMensal = totalDiasRegMes > 0 ? (totalDiasDispMes / totalDiasRegMes * 100).toFixed(1) : '0.0';
    const nomeMes = dataRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Buscar histórico dos últimos 30 dias para analytics
    const dataHist = new Date(data_referencia);
    dataHist.setDate(dataHist.getDate() - 30);
    const dataInicioHist = dataHist.toISOString().split('T')[0];

    const { data: historico } = await supabaseAdmin
      .from('disponibilidade_frota')
      .select(`
        veiculo_id, data_referencia, status, manutencao_tipo, manutencao_oficina_nome,
        veiculo:veiculos(placa, modelo)
      `)
      .eq('contrato_id', contrato_id)
      .gte('data_referencia', dataInicioHist)
      .lte('data_referencia', data_referencia);

    const hist: any[] = historico || [];

    // Reincidência: veículos com mais dias em manutenção nos últimos 30 dias
    const reincidencia: Record<string, { placa: string; modelo: string; dias: number }> = {};
    hist.filter(r => r.status === 'manutencao').forEach(r => {
      const v = Array.isArray(r.veiculo) ? r.veiculo[0] : r.veiculo;
      if (!reincidencia[r.veiculo_id]) reincidencia[r.veiculo_id] = { placa: v?.placa || '?', modelo: v?.modelo || '?', dias: 0 };
      reincidencia[r.veiculo_id].dias++;
    });
    const topReincidencia = Object.values(reincidencia).sort((a, b) => b.dias - a.dias).slice(0, 10);

    // Tempo em oficina: períodos consecutivos
    const porVeiculo: Record<string, { placa: string; modelo: string; datas: string[] }> = {};
    hist.filter(r => r.status === 'manutencao').forEach(r => {
      const v = Array.isArray(r.veiculo) ? r.veiculo[0] : r.veiculo;
      if (!porVeiculo[r.veiculo_id]) porVeiculo[r.veiculo_id] = { placa: v?.placa || '?', modelo: v?.modelo || '?', datas: [] };
      porVeiculo[r.veiculo_id].datas.push(r.data_referencia);
    });
    const tempoOficina: Array<{ placa: string; modelo: string; periodos: number; diasTotal: number; media: number }> = [];
    Object.values(porVeiculo).forEach(v => {
      const datas = [...new Set(v.datas)].sort();
      if (datas.length === 0) return;
      let periodos = 1;
      for (let i = 1; i < datas.length; i++) {
        const prev = new Date(datas[i - 1]);
        const curr = new Date(datas[i]);
        if ((curr.getTime() - prev.getTime()) / 86400000 > 1) periodos++;
      }
      tempoOficina.push({ placa: v.placa, modelo: v.modelo, periodos, diasTotal: datas.length, media: Math.round(datas.length / periodos * 10) / 10 });
    });
    tempoOficina.sort((a, b) => b.diasTotal - a.diasTotal);
    const topTempoOficina = tempoOficina.slice(0, 10);

    // Formatar data BR
    const [y, m, d] = data_referencia.split('-');
    const dataBr = `${d}/${m}/${y}`;

    // Helpers
    const getVeiculo = (r: any) => {
      const v = Array.isArray(r.veiculo) ? r.veiculo[0] : r.veiculo;
      return v ? `${v.placa} - ${v.modelo}` : 'Veículo';
    };
    const getOficina = (r: any) => r.manutencao_oficina_nome || (Array.isArray(r.oficina) ? r.oficina[0]?.nome : r.oficina?.nome) || '';
    const getDiasOficina = (veiculoId: string): number => {
      const v = porVeiculo[veiculoId];
      return v ? [...new Set(v.datas)].length : 0;
    };
    const fmtPrevisao = (p: string | null) => {
      if (!p) return '';
      const [py, pm, pd] = p.split('-');
      return `${pd}/${pm}/${py}`;
    };
    const fmtComplexidade = (c: string | null | undefined) => {
      if (!c) return '';
      if (c === 'alta') return 'Alta';
      if (c === 'media') return 'Média';
      return 'Baixa';
    };

    // ===== WhatsApp: 3 mensagens separadas =====
    // Msg 1: Resumo
    let textoResumoWa = `📋 DISPONIBILIDADE DE FROTA\n`;
    textoResumoWa += `📅 ${dataBr} — ${contrato.nome}${contrato.codigo ? ` (${contrato.codigo})` : ''}\n\n`;
    textoResumoWa += `📊 Resumo: ${total} veículos\n`;
    textoResumoWa += `🟡 Reserva: ${disponiveis.length}\n`;
    textoResumoWa += `🔵 Em Operação: ${emOperacao.length} (${taxaOper}%)\n`;
    textoResumoWa += `🔴 Manutenção: ${manutencao.length} (${taxaManut}%)`;
    if (emManutencao.length > 0) textoResumoWa += ` — ${emManutencao.length} em manutenção`;
    if (emOrcamento.length > 0) textoResumoWa += ` — ${emOrcamento.length} em orçamento`;
    textoResumoWa += '\n';
    textoResumoWa += `\n📈 Taxas:\n`;
    textoResumoWa += `• Disponibilidade: ${taxaDisp}%\n`;
    textoResumoWa += `• Em Operação: ${taxaOper}%\n`;
    textoResumoWa += `• Manutenção: ${taxaManut}%\n`;
    textoResumoWa += `\n📅 Disponibilidade Mensal (${nomeMes}): ${percentualDispMensal}%\n`;
    textoResumoWa += `  (${diasUnicosMes} dias com registro no mês)\n`;

    // Msg 2: Em Manutenção
    let textoManutencaoWa = '';
    if (emManutencao.length > 0) {
      textoManutencaoWa = `🔧 Em Manutenção (${emManutencao.length}):\n\n`;
      for (const r of emManutencao) {
        const oficina = getOficina(r);
        const dias = getDiasOficina(r.veiculo_id);
        textoManutencaoWa += `🚗 ${getVeiculo(r)}\n`;
        if (oficina) textoManutencaoWa += `  Oficina: ${oficina}\n`;
        if (dias > 0) textoManutencaoWa += `  Dias em oficina: ${dias}\n`;
        if (r.manutencao_complexidade) textoManutencaoWa += `  Complexidade: ${fmtComplexidade(r.manutencao_complexidade)}\n`;
        if (r.manutencao_setor) textoManutencaoWa += `  Setor: ${r.manutencao_setor}\n`;
        if (r.manutencao_problema) textoManutencaoWa += `  Problema: ${r.manutencao_problema}\n`;
        const prev = fmtPrevisao(r.manutencao_previsao);
        if (prev) textoManutencaoWa += `  Previsão: ${prev}\n`;
        textoManutencaoWa += '\n';
      }
    }

    // Msg 3: Em Orçamento
    let textoOrcamentoWa = '';
    if (emOrcamento.length > 0) {
      textoOrcamentoWa = `💰 Em Orçamento (${emOrcamento.length}):\n\n`;
      for (const r of emOrcamento) {
        const oficina = getOficina(r);
        const dias = getDiasOficina(r.veiculo_id);
        textoOrcamentoWa += `🚗 ${getVeiculo(r)}\n`;
        if (oficina) textoOrcamentoWa += `  Oficina: ${oficina}\n`;
        if (dias > 0) textoOrcamentoWa += `  Dias em oficina: ${dias}\n`;
        if (r.manutencao_complexidade) textoOrcamentoWa += `  Complexidade: ${fmtComplexidade(r.manutencao_complexidade)}\n`;
        if (r.manutencao_setor) textoOrcamentoWa += `  Setor: ${r.manutencao_setor}\n`;
        if (r.manutencao_problema) textoOrcamentoWa += `  Problema: ${r.manutencao_problema}\n`;
        textoOrcamentoWa += '\n';
      }
    }

    // Texto completo para email fallback (text/plain)
    let textoResumo = textoResumoWa;
    if (textoManutencaoWa) textoResumo += '\n' + textoManutencaoWa;
    if (textoOrcamentoWa) textoResumo += '\n' + textoOrcamentoWa;
    if (topReincidencia.length > 0) {
      textoResumo += `\n⚠️ Reincidência em Manutenção (30 dias):\n`;
      for (const v of topReincidencia) {
        textoResumo += `• ${v.placa} ${v.modelo} — ${v.dias} dias\n`;
      }
    }
    if (topTempoOficina.length > 0) {
      textoResumo += `\n⏱️ Tempo em Oficina (30 dias):\n`;
      for (const v of topTempoOficina) {
        textoResumo += `• ${v.placa} ${v.modelo} — ${v.diasTotal} dias, ${v.periodos} período(s)\n`;
      }
    }

    // ===== HTML (email) =====
    const manutCard = (r: any, tipo: string, corTipo: string) => {
      const oficina = getOficina(r);
      const dias = getDiasOficina(r.veiculo_id);
      const prev = fmtPrevisao(r.manutencao_previsao);
      const complex = fmtComplexidade(r.manutencao_complexidade);
      return `<div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
        <strong>${getVeiculo(r)}</strong> — <span style="color: ${corTipo};">${tipo}</span><br>
        ${oficina ? `<small>🏭 Oficina: ${oficina}</small><br>` : ''}
        ${dias > 0 ? `<small>📅 Dias em oficina: <b>${dias}</b></small><br>` : ''}
        ${complex ? `<small>📊 Complexidade: <b>${complex}</b></small><br>` : ''}
        ${r.manutencao_setor ? `<small>🏢 Setor: <b>${r.manutencao_setor}</b></small><br>` : ''}
        ${r.manutencao_problema ? `<small>⚠️ ${r.manutencao_problema}</small><br>` : ''}
        ${prev ? `<small>📆 Previsão: ${prev}</small>` : ''}
      </div>`;
    };

    const reincidenciaHtml = topReincidencia.length > 0 ? `
    <h3 style="margin-top: 20px;">⚠️ Reincidência em Manutenção (30 dias)</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #fef2f2;"><th style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 12px;">Veículo</th><th style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center; font-size: 12px;">Dias</th></tr>
      ${topReincidencia.map(v => `<tr><td style="padding: 6px 8px; border: 1px solid #e5e7eb; font-size: 12px;">${v.placa} <span style="color: #9ca3af;">${v.modelo}</span></td><td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold; color: ${v.dias >= 10 ? '#dc2626' : v.dias >= 5 ? '#d97706' : '#374151'};">${v.dias}</td></tr>`).join('')}
    </table>` : '';

    const tempoOficinaHtml = topTempoOficina.length > 0 ? `
    <h3 style="margin-top: 20px;">⏱️ Tempo em Oficina (30 dias)</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #fffbeb;"><th style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 12px;">Veículo</th><th style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center; font-size: 12px;">Períodos</th><th style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center; font-size: 12px;">Dias</th><th style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center; font-size: 12px;">Média</th></tr>
      ${topTempoOficina.map(v => `<tr><td style="padding: 6px 8px; border: 1px solid #e5e7eb; font-size: 12px;">${v.placa} <span style="color: #9ca3af;">${v.modelo}</span></td><td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center; font-size: 12px;">${v.periodos}</td><td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold; font-size: 12px;">${v.diasTotal}</td><td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center; font-size: 12px;">${v.media}</td></tr>`).join('')}
    </table>` : '';

    const htmlResumo = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto;">
  <div style="background-color: #0891b2; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 20px;">📋 Disponibilidade de Frota</h1>
    <p style="margin: 5px 0 0;">${dataBr} — ${contrato.nome}</p>
  </div>
  <div style="padding: 20px; background-color: #f9fafb;">
    <h3>Resumo (${total} veículos)</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #fefce8;">🟡 Reserva</td><td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold;">${disponiveis.length}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #eff6ff;">🔵 Em Operação</td><td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold;">${emOperacao.length} <span style="color: #6b7280; font-size: 12px;">(${taxaOper}%)</span></td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #fef2f2;">🔴 Manutenção</td><td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold;">${manutencao.length} <span style="color: #6b7280; font-size: 12px;">(${taxaManut}%)</span></td></tr>
    </table>
    <div style="margin-top: 12px; display: flex; gap: 8px;">
      <div style="flex: 1; background: #fefce8; border-radius: 8px; padding: 10px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #ca8a04;">${taxaDisp}%</div>
        <div style="font-size: 11px; color: #854d0e;">Disponibilidade (dia)</div>
      </div>
      <div style="flex: 1; background: #eff6ff; border-radius: 8px; padding: 10px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #2563eb;">${taxaOper}%</div>
        <div style="font-size: 11px; color: #1e40af;">Em Operação</div>
      </div>
      <div style="flex: 1; background: #fef2f2; border-radius: 8px; padding: 10px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #dc2626;">${taxaManut}%</div>
        <div style="font-size: 11px; color: #991b1b;">Manutenção</div>
      </div>
    </div>
    <div style="margin-top: 12px; background: #ecfdf5; border-radius: 8px; padding: 14px; text-align: center; border: 2px solid #059669;">
      <div style="font-size: 11px; color: #065f46; text-transform: uppercase; letter-spacing: 1px;">Disponibilidade Mensal (${nomeMes})</div>
      <div style="font-size: 28px; font-weight: bold; color: #059669;">${percentualDispMensal}%</div>
      <div style="font-size: 11px; color: #065f46;">${diasUnicosMes} dias com registro no mês</div>
    </div>
    ${emManutencao.length > 0 ? `
    <h3 style="margin-top: 20px;">🔧 Em Manutenção (${emManutencao.length})</h3>
    ${emManutencao.map((r: any) => manutCard(r, '🔧 Em Manutenção', '#dc2626')).join('')}` : ''}
    ${emOrcamento.length > 0 ? `
    <h3 style="margin-top: 20px;">💰 Em Orçamento (${emOrcamento.length})</h3>
    ${emOrcamento.map((r: any) => manutCard(r, '💰 Em Orçamento', '#d97706')).join('')}` : ''}
    ${reincidenciaHtml}
    ${tempoOficinaHtml}
  </div>
  <div style="padding: 10px; background-color: #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
    Sistema PSE — Disponibilidade de Frota
  </div>
</body>
</html>`;

    // ===== Gerar planilha XLS =====
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Aba 1: Resumo do dia
    const resumoRows = regs.map((r: any) => {
      const v = Array.isArray(r.veiculo) ? r.veiculo[0] : r.veiculo;
      const statusLabel = r.status === 'disponivel' ? 'Reserva' : r.status === 'em_operacao' ? 'Em Operação' : 'Manutenção';
      const tipoLabel = r.manutencao_tipo === 'em_orcamento' ? 'Em Orçamento' : r.manutencao_tipo === 'em_manutencao' ? 'Em Manutenção' : r.status === 'manutencao' ? 'Em Manutenção' : '';
      const oficina = getOficina(r);
      const dias = getDiasOficina(r.veiculo_id);
      return {
        'Placa': v?.placa || '?',
        'Modelo': v?.modelo || '?',
        'Status': statusLabel,
        'Tipo Manutenção': tipoLabel,
        'Oficina': oficina,
        'Complexidade': r.manutencao_complexidade ? fmtComplexidade(r.manutencao_complexidade) : '',
        'Setor': r.manutencao_setor || '',
        'Dias em Oficina': r.status === 'manutencao' ? dias : '',
        'Problema': r.manutencao_problema || '',
        'Previsão': fmtPrevisao(r.manutencao_previsao),
        'Observações': r.observacoes || '',
      };
    });
    const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Disponibilidade');

    // Aba 2: Reincidência
    if (topReincidencia.length > 0) {
      const reincRows = topReincidencia.map(v => ({
        'Placa': v.placa,
        'Modelo': v.modelo,
        'Dias em Manutenção (30d)': v.dias,
      }));
      const wsReinc = XLSX.utils.json_to_sheet(reincRows);
      XLSX.utils.book_append_sheet(wb, wsReinc, 'Reincidência');
    }

    // Aba 3: Tempo em oficina
    if (topTempoOficina.length > 0) {
      const tempoRows = topTempoOficina.map(v => ({
        'Placa': v.placa,
        'Modelo': v.modelo,
        'Períodos': v.periodos,
        'Dias Total': v.diasTotal,
        'Média dias/período': v.media,
      }));
      const wsTempo = XLSX.utils.json_to_sheet(tempoRows);
      XLSX.utils.book_append_sheet(wb, wsTempo, 'Tempo Oficina');
    }

    const xlsBuffer = Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
    const xlsFilename = `disponibilidade_frota_${data_referencia}.xlsx`;

    // Buscar emails ativos do contrato
    const { data: emailsConfig } = await supabaseAdmin
      .from('disponibilidade_frota_emails')
      .select('email')
      .eq('contrato_id', contrato_id)
      .eq('ativo', true);

    // Buscar WhatsApp ativos do contrato
    const { data: whatsappConfig } = await supabaseAdmin
      .from('disponibilidade_frota_whatsapp')
      .select('numero')
      .eq('contrato_id', contrato_id)
      .eq('ativo', true);

    const emailResults: any[] = [];
    const whatsappResults: any[] = [];

    // Enviar emails
    const emails = (emailsConfig || []).map(e => e.email).filter(Boolean);
    if (emails.length > 0) {
      console.log(`📧 Disponibilidade: Enviando email para ${emails.length} destinatário(s)...`);
      const results = await sendEmailToMultiple(emails, {
        subject: `📋 Disponibilidade de Frota — ${dataBr} — ${contrato.nome}`,
        html: htmlResumo,
        text: textoResumo,
        attachments: [{ filename: xlsFilename, content: xlsBuffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
      });
      emailResults.push(...results);
    }

    // Enviar WhatsApp — mensagem única
    const numeros = (whatsappConfig || []).map(n => n.numero).filter(Boolean);
    if (numeros.length > 0) {
      console.log(`📱 Disponibilidade: Enviando WhatsApp para ${numeros.length} número(s)...`);
      let textoWa = textoResumoWa;
      if (textoManutencaoWa) textoWa += '\n' + textoManutencaoWa;
      if (textoOrcamentoWa) textoWa += '\n' + textoOrcamentoWa;
      const results = await sendWhatsAppToMultiple(numeros, textoWa);
      whatsappResults.push(...results);
    }

    return NextResponse.json({
      success: true,
      emails_enviados: emailResults.filter(r => r.success).length,
      emails_falha: emailResults.filter(r => !r.success).length,
      whatsapp_enviados: whatsappResults.filter(r => r.success).length,
      whatsapp_falha: whatsappResults.filter(r => !r.success).length,
      message: `Notificações enviadas: ${emails.length} email(s), ${numeros.length} WhatsApp(s)`,
    });

  } catch (error) {
    console.error('❌ Erro ao enviar notificações de disponibilidade:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar notificações', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
