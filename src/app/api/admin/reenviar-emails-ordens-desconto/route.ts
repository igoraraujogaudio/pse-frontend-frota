import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendEmailToMultiple } from '@/lib/email';
import { getRegiaoContrato } from '@/config/emailDescontoConfig';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey);

interface EmailDescontoRequest {
    orderId: string;
    fileUrl: string;
    action: 'assinado' | 'recusado';
    funcionarioNome: string;
    funcionarioMatricula: string;
    valorTotal: number;
    baseNome?: string;
    contratoNome?: string;
    contratoCodigo?: string;
}

/**
 * Formata o email de ordem de desconto
 */
function formatDescontoEmail(data: EmailDescontoRequest): { subject: string; html: string; text: string } {
    const statusText = data.action === 'assinado' ? '✅ ASSINADA' : '❌ RECUSADA (com testemunhas)';
    const statusColor = data.action === 'assinado' ? '#10b981' : '#ef4444';
    const regiao = data.contratoCodigo ? getRegiaoContrato(data.contratoCodigo) : 'Não identificada';

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info { margin: 12px 0; padding: 10px; background-color: white; border-radius: 4px; }
          .label { font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; }
          .value { font-size: 16px; margin-top: 4px; }
          .download-btn { 
            display: inline-block; 
            background-color: #3b82f6; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin-top: 16px;
            font-weight: bold;
          }
          .footer { margin-top: 20px; padding: 10px; background-color: #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 ORDEM DE DESCONTO ${statusText}</h1>
          </div>
          <div class="content">
            <div class="info">
              <div class="label">Funcionário</div>
              <div class="value">${data.funcionarioNome}</div>
              <div style="font-size: 14px; color: #6b7280;">Matrícula: ${data.funcionarioMatricula}</div>
            </div>
            
            <div class="info">
              <div class="label">Valor Total</div>
              <div class="value" style="font-size: 20px; color: #059669; font-weight: bold;">
                R$ ${data.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            
            <div class="info">
              <div class="label">Base / Contrato</div>
              <div class="value">${data.baseNome || 'N/A'}</div>
              <div style="font-size: 14px; color: #6b7280;">${data.contratoNome || ''} (${data.contratoCodigo || 'N/A'})</div>
              <div style="font-size: 14px; color: #6b7280;">Região: ${regiao}</div>
            </div>
            
            <div class="info">
              <div class="label">Status</div>
              <div class="value" style="color: ${statusColor}; font-weight: bold;">
                ${data.action === 'assinado' ? 'Documento assinado pelo funcionário' : 'Documento recusado - assinado por testemunhas'}
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${data.fileUrl}" class="download-btn" target="_blank">
                📥 Baixar Documento Assinado
              </a>
            </div>
          </div>
          <div class="footer">
            Sistema de Gestão Almoxarifado - PSE<br>
            Este email foi gerado automaticamente.
          </div>
        </div>
      </body>
    </html>
  `;

    const text = `ORDEM DE DESCONTO ${statusText}

Funcionário: ${data.funcionarioNome}
Matrícula: ${data.funcionarioMatricula}
Valor Total: R$ ${data.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Base: ${data.baseNome || 'N/A'}
Contrato: ${data.contratoNome || ''} (${data.contratoCodigo || 'N/A'})
Região: ${regiao}
Status: ${data.action === 'assinado' ? 'Assinado pelo funcionário' : 'Recusado - assinado por testemunhas'}

Link para download: ${data.fileUrl}

---
Sistema de Gestão Almoxarifado - PSE`;

    return {
        subject: `📋 Ordem de Desconto ${statusText.replace(/[✅❌]/g, '')} - ${data.funcionarioNome} - R$ ${data.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        html,
        text
    };
}

/**
 * POST /api/admin/reenviar-emails-ordens-desconto
 * Reenvia emails de ordens de desconto em um período específico
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { dataInicio, dataFim, dryRun = false } = body;

        if (!dataInicio || !dataFim) {
            return NextResponse.json(
                { error: 'É necessário informar dataInicio e dataFim (formato: YYYY-MM-DD)' },
                { status: 400 }
            );
        }

        console.log('🔍 Buscando ordens de desconto para reenvio:', { dataInicio, dataFim, dryRun });

        // Buscar ordens de desconto no período
        // Inclui tanto ordens ASSINADAS quanto RECUSADAS (ambas têm arquivo_assinado_url e data_assinatura)
        const { data: ordens, error: ordensError } = await supabaseAdmin
            .from('discount_orders')
            .select('*')
            .not('arquivo_assinado_url', 'is', null)
            .not('data_assinatura', 'is', null)
            .gte('data_assinatura', `${dataInicio} 00:00:00`)
            .lte('data_assinatura', `${dataFim} 23:59:59`)
            .order('data_assinatura', { ascending: false });

        if (ordensError) {
            console.error('❌ Erro ao buscar ordens:', ordensError);
            return NextResponse.json(
                { error: 'Erro ao buscar ordens de desconto', details: ordensError.message },
                { status: 500 }
            );
        }

        if (!ordens || ordens.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhuma ordem encontrada no período',
                total: 0,
                enviados: 0
            });
        }

        console.log(`✅ Encontradas ${ordens.length} ordens de desconto`);
        
        // Contar assinadas vs recusadas para log
        const assinadas = ordens.filter(o => !o.recusado).length;
        const recusadas = ordens.filter(o => o.recusado).length;
        console.log(`   📊 Assinadas: ${assinadas} | Recusadas: ${recusadas} (ambas serão processadas)`);

        // Processar ordens em paralelo (mais rápido)
        const processarOrdem = async (ordem: typeof ordens[0]): Promise<{
            ordemId: string;
            success: boolean;
            destinatarios: number;
            error?: string;
            detalhes?: {
                usuarioNome?: string;
                usuarioMatricula?: string;
                baseNome?: string;
                contratoNome?: string;
                contratoCodigo?: string;
                dataAssinatura?: string;
                status: 'assinada' | 'recusada';
                valorTotal?: number;
                descricao?: string;
            };
        }> => {
            try {
                // Buscar informações do usuário
                let targetUser = null;
                if (ordem.target_user_id) {
                    const { data: userData } = await supabaseAdmin
                        .from('usuarios')
                        .select('id, nome, matricula')
                        .eq('id', ordem.target_user_id)
                        .single();
                    targetUser = userData;
                }

                // Buscar informações da base
                let base = null;
                if (ordem.base_id) {
                    const { data: baseData } = await supabaseAdmin
                        .from('bases')
                        .select('id, nome, contrato_id')
                        .eq('id', ordem.base_id)
                        .single();
                    base = baseData;
                }

                // Buscar informações do contrato
                let contrato = null;
                if (base?.contrato_id) {
                    const { data: contratoData } = await supabaseAdmin
                        .from('contratos')
                        .select('id, nome, codigo')
                        .eq('id', base.contrato_id)
                        .single();
                    contrato = contratoData;
                }

                const codigoContrato = contrato?.codigo || '';
                const contratoId = contrato?.id;

                // Buscar emails do banco de dados
                let emailsEspecificos: string[] = [];
                let emailsGerais: string[] = [];

                try {
                    // Buscar emails específicos do contrato
                    if (contratoId) {
                        const { data: dataEspecificos } = await supabaseAdmin
                            .from('emails_desconto_contrato')
                            .select('email')
                            .eq('ativo', true)
                            .eq('tipo', 'especifico')
                            .eq('contrato_id', contratoId);

                        emailsEspecificos = (dataEspecificos || []).map((e: { email: string }) => e.email);
                    }

                    // Se não encontrou por contrato_id, tentar por codigo_contrato
                    if (emailsEspecificos.length === 0 && codigoContrato) {
                        const codigoUpper = codigoContrato.toUpperCase();
                        const { data: dataEspecificos } = await supabaseAdmin
                            .from('emails_desconto_contrato')
                            .select('email, codigo_contrato')
                            .eq('ativo', true)
                            .eq('tipo', 'especifico')
                            .not('codigo_contrato', 'is', null);

                        // Filtrar manualmente para match parcial
                        const emailsMatchParcial = (dataEspecificos || [])
                            .filter((e: { email: string; codigo_contrato: string }) => {
                                const codigo = (e.codigo_contrato || '').toUpperCase();
                                return codigo.includes(codigoUpper) || codigoUpper.includes(codigo);
                            })
                            .map((e: { email: string }) => e.email);

                        if (emailsMatchParcial.length > 0) {
                            emailsEspecificos = emailsMatchParcial;
                        }
                    }

                    // Buscar emails gerais
                    const { data: dataGerais } = await supabaseAdmin
                        .from('emails_desconto_contrato')
                        .select('email')
                        .eq('ativo', true)
                        .eq('tipo', 'geral');

                    emailsGerais = (dataGerais || []).map((e: { email: string }) => e.email);
                } catch (error) {
                    console.error('❌ Erro ao buscar emails do banco:', error);
                }

                // Combinar emails
                const todosEmails = [
                    ...emailsEspecificos,
                    ...emailsGerais
                ].filter((email, index, self) => self.indexOf(email) === index);

                if (todosEmails.length === 0) {
                    return {
                        ordemId: ordem.id,
                        success: false,
                        destinatarios: 0,
                        error: 'Nenhum email configurado para este contrato',
                        detalhes: {
                            usuarioNome: targetUser?.nome,
                            usuarioMatricula: targetUser?.matricula,
                            baseNome: base?.nome,
                            contratoNome: contrato?.nome,
                            contratoCodigo: contrato?.codigo,
                            dataAssinatura: ordem.data_assinatura,
                            status: ordem.recusado ? 'recusada' : 'assinada',
                            valorTotal: ordem.valor_total,
                            descricao: ordem.descricao
                        }
                    };
                }

                // Preparar dados do email
                // Determina se é assinada ou recusada (ambas são enviadas)
                const action = ordem.recusado ? 'recusado' : 'assinado';
                const emailData: EmailDescontoRequest = {
                    orderId: ordem.id,
                    fileUrl: ordem.arquivo_assinado_url || '',
                    action: action as 'assinado' | 'recusado',
                    funcionarioNome: targetUser?.nome || 'Não informado',
                    funcionarioMatricula: targetUser?.matricula || 'N/A',
                    valorTotal: ordem.valor_total || 0,
                    baseNome: base?.nome,
                    contratoNome: contrato?.nome,
                    contratoCodigo: contrato?.codigo
                };

                // Formatar email
                const emailContent = formatDescontoEmail(emailData);

                // Preparar detalhes da ordem
                const detalhesOrdem = {
                    usuarioNome: targetUser?.nome,
                    usuarioMatricula: targetUser?.matricula,
                    baseNome: base?.nome,
                    contratoNome: contrato?.nome,
                    contratoCodigo: contrato?.codigo,
                    dataAssinatura: ordem.data_assinatura,
                    status: (ordem.recusado ? 'recusada' : 'assinada') as 'assinada' | 'recusada',
                    valorTotal: ordem.valor_total,
                    descricao: ordem.descricao
                };

                if (dryRun) {
                    // Modo dry run - apenas simular
                    console.log(`[DRY RUN] Enviaria email para ordem ${ordem.id} para ${todosEmails.length} destinatário(s)`);
                    return {
                        ordemId: ordem.id,
                        success: true,
                        destinatarios: todosEmails.length,
                        detalhes: detalhesOrdem
                    };
                } else {
                    // Enviar emails (agora em paralelo)
                    const emailResults = await sendEmailToMultiple(todosEmails, emailContent);
                    const sucessos = emailResults.filter(r => r.success).length;
                    const falhas = emailResults.filter(r => !r.success).length;

                    if (sucessos > 0) {
                        console.log(`✅ Email reenviado para ordem ${ordem.id}: ${sucessos} sucesso(s), ${falhas} falha(s)`);
                        return {
                            ordemId: ordem.id,
                            success: true,
                            destinatarios: sucessos,
                            detalhes: detalhesOrdem
                        };
                    } else {
                        return {
                            ordemId: ordem.id,
                            success: false,
                            destinatarios: 0,
                            error: `Falha ao enviar todos os emails: ${falhas} falha(s)`,
                            detalhes: detalhesOrdem
                        };
                    }
                }
            } catch (error) {
                console.error(`❌ Erro ao processar ordem ${ordem.id}:`, error);
                return {
                    ordemId: ordem.id,
                    success: false,
                    destinatarios: 0,
                    error: error instanceof Error ? error.message : 'Erro desconhecido',
                    detalhes: {
                        dataAssinatura: ordem.data_assinatura,
                        status: (ordem.recusado ? 'recusada' : 'assinada') as 'assinada' | 'recusada',
                        valorTotal: ordem.valor_total,
                        descricao: ordem.descricao
                    }
                };
            }
        };

        // Processar todas as ordens em paralelo
        console.log(`🚀 Processando ${ordens.length} ordens em paralelo...`);
        const resultadosPromises = ordens.map(ordem => processarOrdem(ordem));
        const resultadosSettled = await Promise.allSettled(resultadosPromises);
        
        // Processar resultados
        const resultados = resultadosSettled.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                // Se a promise foi rejeitada, criar resultado de erro
                return {
                    ordemId: ordens[index].id,
                    success: false,
                    destinatarios: 0,
                    error: result.reason instanceof Error ? result.reason.message : 'Erro desconhecido',
                    detalhes: {
                        dataAssinatura: ordens[index].data_assinatura,
                        status: (ordens[index].recusado ? 'recusada' : 'assinada') as 'assinada' | 'recusada',
                        valorTotal: ordens[index].valor_total,
                        descricao: ordens[index].descricao
                    }
                };
            }
        });

        // Calcular totais
        const totalEnviados = resultados
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.destinatarios, 0);
        const totalErros = resultados.filter(r => !r.success).length;

        return NextResponse.json({
            success: true,
            message: dryRun 
                ? `Dry run: ${ordens.length} ordens seriam processadas`
                : `Reenvio concluído: ${totalEnviados} emails enviados, ${totalErros} erros`,
            total: ordens.length,
            enviados: totalEnviados,
            erros: totalErros,
            resultados
        });

    } catch (error) {
        console.error('❌ Erro ao processar reenvio de emails:', error);
        return NextResponse.json(
            {
                error: 'Erro ao processar reenvio de emails',
                details: error instanceof Error ? error.message : 'Erro desconhecido'
            },
            { status: 500 }
        );
    }
}
