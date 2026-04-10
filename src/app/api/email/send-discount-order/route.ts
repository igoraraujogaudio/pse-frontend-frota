import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmailToMultiple } from '@/lib/email'
import { getRegiaoContrato } from '@/config/emailDescontoConfig'

interface EmailDescontoRequest {
    orderId: string
    fileUrl: string
    action: 'assinado' | 'recusado'
    funcionarioNome: string
    funcionarioMatricula: string
    valorTotal: number
    baseNome?: string
    contratoNome?: string
    contratoCodigo?: string
}

/**
 * Formata o email de ordem de desconto
 */
function formatDescontoEmail(data: EmailDescontoRequest): { subject: string; html: string; text: string } {
    const statusText = data.action === 'assinado' ? '✅ ASSINADA' : '❌ RECUSADA (com testemunhas)'
    const statusColor = data.action === 'assinado' ? '#10b981' : '#ef4444'
    const regiao = data.contratoCodigo ? getRegiaoContrato(data.contratoCodigo) : 'Não identificada'

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
  `

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
Sistema de Gestão Almoxarifado - PSE`

    return {
        subject: `📋 Ordem de Desconto ${statusText.replace(/[✅❌]/g, '')} - ${data.funcionarioNome} - R$ ${data.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        html,
        text
    }
}

/**
 * POST /api/email/send-discount-order
 * Envia email com ordem de desconto assinada para os destinatários configurados
 */
export async function POST(request: NextRequest) {
    try {
        const body: EmailDescontoRequest = await request.json()

        if (!body.orderId || !body.fileUrl || !body.action) {
            return NextResponse.json(
                { error: 'Dados obrigatórios: orderId, fileUrl, action' },
                { status: 400 }
            )
        }

        // Usar cliente admin para garantir acesso
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        console.log('🔍 Buscando ordem de desconto:', { orderId: body.orderId })

        // Buscar detalhes da ordem de desconto
        // Tentar algumas vezes caso haja delay na atualização
        let ordem = null
        let ordemError = null
        let tentativas = 0
        const maxTentativas = 3

        while (tentativas < maxTentativas && !ordem) {
            // Buscar ordem sem joins (a foreign key para bases pode não existir)
            const { data, error } = await supabaseAdmin
                .from('discount_orders')
                .select('*')
                .eq('id', body.orderId)
                .single()

            if (error) {
                ordemError = error
                console.warn(`⚠️ Tentativa ${tentativas + 1}/${maxTentativas} - Erro ao buscar ordem:`, error.code, error.message)
                
                // Se não for erro de "não encontrado", parar
                if (error.code !== 'PGRST116') {
                    break
                }
                
                // Se for "não encontrado", esperar um pouco e tentar novamente
                if (tentativas < maxTentativas - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500)) // Esperar 500ms
                }
            } else {
                ordem = data
                ordemError = null
                break
            }
            
            tentativas++
        }

        // Buscar informações do usuário separadamente
        let targetUser = null
        if (ordem?.target_user_id) {
            const { data: userData } = await supabaseAdmin
                .from('usuarios')
                .select('id, nome, matricula')
                .eq('id', ordem.target_user_id)
                .single()
            targetUser = userData
        }

        // Buscar informações da base separadamente
        let base = null
        if (ordem?.base_id) {
            const { data: baseData } = await supabaseAdmin
                .from('bases')
                .select('id, nome, contrato_id')
                .eq('id', ordem.base_id)
                .single()
            base = baseData
        }

        if (ordemError || !ordem) {
            console.error('❌ Erro ao buscar ordem de desconto após', tentativas, 'tentativas:', ordemError)
            console.error('❌ OrderId recebido:', body.orderId)
            return NextResponse.json(
                { 
                    error: 'Ordem de desconto não encontrada',
                    orderId: body.orderId,
                    attempts: tentativas,
                    details: ordemError?.message || 'Ordem não encontrada após múltiplas tentativas'
                },
                { status: 404 }
            )
        }

        console.log('✅ Ordem de desconto encontrada:', {
            ordemId: ordem.id,
            baseId: ordem.base_id,
            base: base,
            targetUserId: ordem.target_user_id,
            targetUser: targetUser
        })

        // Buscar informações do contrato se houver base
        let contrato = null
        if (base?.contrato_id) {
            const { data: contratoData, error: contratoError } = await supabaseAdmin
                .from('contratos')
                .select('id, nome, codigo')
                .eq('id', base.contrato_id)
                .single()
            
            if (contratoError) {
                console.error('❌ Erro ao buscar contrato:', contratoError)
                console.error('❌ Contrato ID:', base.contrato_id)
            } else {
                contrato = contratoData
                console.log('✅ Contrato encontrado:', { 
                    id: contrato?.id, 
                    nome: contrato?.nome, 
                    codigo: contrato?.codigo 
                })
            }
        } else {
            console.warn('⚠️ Ordem de desconto sem base ou base sem contrato_id:', {
                ordemId: ordem.id,
                baseId: ordem.base_id,
                baseNome: base?.nome
            })
        }

        // Preparar dados do email
        const emailData: EmailDescontoRequest = {
            orderId: body.orderId,
            fileUrl: body.fileUrl,
            action: body.action,
            funcionarioNome: targetUser?.nome || body.funcionarioNome || 'Não informado',
            funcionarioMatricula: targetUser?.matricula || body.funcionarioMatricula || 'N/A',
            valorTotal: ordem.valor_total || 0,
            baseNome: base?.nome,
            contratoNome: contrato?.nome,
            contratoCodigo: contrato?.codigo
        }

        // Obter destinatários de email baseado no contrato
        const codigoContrato = contrato?.codigo || ''
        const contratoId = contrato?.id
        console.log('🔍 Buscando emails para contrato:', {
            codigoContrato,
            contratoId,
            contratoNome: contrato?.nome,
            baseId: ordem.base_id,
            baseNome: ordem.base?.nome
        })
        
        // Buscar emails do banco de dados (supabaseAdmin já foi criado acima)
        let emailsEspecificos: string[] = []
        let emailsGerais: string[] = []

        try {
            console.log('🔍 Buscando emails específicos do banco para:', { contratoId, codigoContrato })
            
            // Buscar emails específicos do contrato (priorizar contrato_id)
            if (contratoId) {
                const { data: dataEspecificos, error: errorEspecificos } = await supabaseAdmin
                    .from('emails_desconto_contrato')
                    .select('email')
                    .eq('ativo', true)
                    .eq('tipo', 'especifico')
                    .eq('contrato_id', contratoId)

                if (errorEspecificos) {
                    console.error('❌ Erro ao buscar emails específicos por contrato_id:', errorEspecificos)
                } else {
                    emailsEspecificos = (dataEspecificos || []).map((e: { email: string }) => e.email)
                    console.log('✅ Emails específicos encontrados por contrato_id:', emailsEspecificos.length)
                }
            }
            
            // Se não encontrou por contrato_id, tentar por codigo_contrato
            if (emailsEspecificos.length === 0 && codigoContrato) {
                const codigoUpper = codigoContrato.toUpperCase()
                console.log('🔍 Tentando buscar por codigo_contrato:', codigoUpper)
                
                // Tentar match exato primeiro
                const { data: dataEspecificos, error: errorEspecificos } = await supabaseAdmin
                    .from('emails_desconto_contrato')
                    .select('email')
                    .eq('ativo', true)
                    .eq('tipo', 'especifico')
                    .eq('codigo_contrato', codigoUpper)

                if (errorEspecificos) {
                    console.error('❌ Erro ao buscar emails específicos por codigo_contrato:', errorEspecificos)
                } else {
                    emailsEspecificos = (dataEspecificos || []).map((e: { email: string }) => e.email)
                    console.log('✅ Emails específicos encontrados por codigo_contrato (exato):', emailsEspecificos.length)
                }
                
                // Se ainda não encontrou, tentar match parcial (LIKE)
                if (emailsEspecificos.length === 0) {
                    const { data: dataEspecificosParcial } = await supabaseAdmin
                        .from('emails_desconto_contrato')
                        .select('email, codigo_contrato')
                        .eq('ativo', true)
                        .eq('tipo', 'especifico')
                        .not('codigo_contrato', 'is', null)
                    
                    // Filtrar manualmente para match parcial
                    const emailsMatchParcial = (dataEspecificosParcial || [])
                        .filter((e: { email: string; codigo_contrato: string }) => {
                            const codigo = (e.codigo_contrato || '').toUpperCase()
                            return codigo.includes(codigoUpper) || codigoUpper.includes(codigo)
                        })
                        .map((e: { email: string }) => e.email)
                    
                    if (emailsMatchParcial.length > 0) {
                        emailsEspecificos = emailsMatchParcial
                        console.log('✅ Emails específicos encontrados por codigo_contrato (parcial):', emailsEspecificos.length)
                    }
                }
            }

            // Buscar emails gerais (recebem todos)
            console.log('🔍 Buscando emails gerais do banco...')
            const { data: dataGerais, error: errorGerais } = await supabaseAdmin
                .from('emails_desconto_contrato')
                .select('email')
                .eq('ativo', true)
                .eq('tipo', 'geral')

            if (errorGerais) {
                console.error('❌ Erro ao buscar emails gerais:', errorGerais)
            } else {
                emailsGerais = (dataGerais || []).map((e: { email: string }) => e.email)
                console.log('✅ Emails gerais encontrados:', emailsGerais.length)
            }
        } catch (error) {
            console.error('❌ Erro ao buscar emails do banco:', error)
        }

        // Usar apenas emails do banco (remover fallback hardcoded)
        // Se não houver emails no banco, retornar erro ou aviso
        const todosEmails = [
            ...emailsEspecificos,
            ...emailsGerais
        ].filter((email, index, self) => self.indexOf(email) === index)

        if (todosEmails.length === 0) {
            console.warn('⚠️ Nenhum email encontrado no banco de dados para o contrato:', {
                contratoId,
                codigoContrato,
                mensagem: 'Configure os emails na página de administração /admin/emails-desconto'
            })
        }

        const destinatarios = todosEmails

        console.log('📋 Emails encontrados:', {
            codigoContrato,
            emailsEspecificosDB: emailsEspecificos.length,
            emailsGeraisDB: emailsGerais.length,
            totalDestinatarios: destinatarios.length,
            destinatarios
        })

        if (destinatarios.length === 0) {
            console.warn('⚠️ Nenhum email configurado para o contrato:', codigoContrato)
            return NextResponse.json({
                success: false,
                message: 'Nenhum destinatário configurado para este contrato',
                contrato: codigoContrato
            })
        }

        console.log(`📧 Enviando email de ordem de desconto para ${destinatarios.length} destinatário(s):`, destinatarios)

        // Formatar email
        const emailContent = formatDescontoEmail(emailData)

        // Enviar emails (não bloqueia a resposta)
        sendEmailToMultiple(destinatarios, emailContent).then((results) => {
            results.forEach((result) => {
                if (result.success) {
                    console.log(`✅ Email de ordem de desconto enviado para ${result.email}`)
                } else {
                    console.error(`❌ Erro ao enviar email para ${result.email}:`, result.error)
                }
            })
        }).catch((error) => {
            console.error('❌ Erro ao enviar emails de ordem de desconto:', error)
        })

        return NextResponse.json({
            success: true,
            message: `Email enviado para ${destinatarios.length} destinatário(s)`,
            destinatarios,
            contrato: codigoContrato
        })

    } catch (error) {
        console.error('❌ Erro ao processar envio de email de ordem de desconto:', error)
        return NextResponse.json(
            {
                error: 'Erro ao enviar email',
                details: error instanceof Error ? error.message : 'Erro desconhecido'
            },
            { status: 500 }
        )
    }
}
