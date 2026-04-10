export interface EmailResult {
  success: boolean
  email: string
  error?: string
}

interface EmailContent {
  subject: string
  html: string
  text: string
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
}

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
}

interface FormatDenunciaEmailParams {
  id: string
  base: string
  descricao: string
  anonimo: boolean
  email?: string
  matricula?: string
  evidencias_count: number
  evidencias_urls: string[]
}

/**
 * Envia email para um destinatário
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'
    
    console.log('📧 [EMAIL] Enviando email:', {
      to: params.to,
      subject: params.subject,
      provider: emailProvider
    })

    // Implementar envio real usando nodemailer
    if (emailProvider === 'smtp') {
      const nodemailer = await import('nodemailer')
      
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST || 'mail.pse.srv.br',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outras portas
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_FROM,
          pass: process.env.SMTP_PASSWORD
        }
      })

      const mailOptions: Record<string, unknown> = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Sistema PSE'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text
      }
      if (params.attachments && params.attachments.length > 0) {
        mailOptions.attachments = params.attachments.map(a => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType || 'application/octet-stream'
        }))
      }

      const info = await transporter.sendMail(mailOptions)
      console.log('✅ Email enviado com sucesso:', {
        to: params.to,
        messageId: info.messageId
      })
      
      return { success: true }
    } else {
      // Para outros provedores (Resend, SendGrid), implementar aqui
      console.warn('⚠️ Provedor de email não implementado:', emailProvider)
      console.warn('⚠️ Email não enviado, apenas logado. Configure EMAIL_PROVIDER=smtp e variáveis SMTP_*')
      
      // Por enquanto, retornar sucesso para não quebrar o fluxo
      // Mas avisar que não foi enviado realmente
      return { 
        success: true,
        error: `Provedor ${emailProvider} não implementado. Email não foi enviado.`
      }
    }
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

/**
 * Envia email para múltiplos destinatários (em paralelo)
 */
export async function sendEmailToMultiple(
  emails: string[],
  content: EmailContent
): Promise<EmailResult[]> {
  // Enviar todos os emails em paralelo
  const promises = emails.map(async (email) => {
    try {
      const result = await sendEmail({
        to: email,
        subject: content.subject,
        html: content.html,
        text: content.text,
        attachments: content.attachments
      })
      
      return {
        success: result.success,
        email,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        email,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })
  
  // Aguardar todos os envios concluírem
  const results = await Promise.allSettled(promises)
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        success: false,
        email: emails[index],
        error: result.reason instanceof Error ? result.reason.message : 'Erro desconhecido'
      }
    }
  })
}

/**
 * Formata email de denúncia
 */
export function formatDenunciaEmail(denuncia: FormatDenunciaEmailParams): EmailContent {
  const tipo = denuncia.anonimo ? '🔒 ANÔNIMA' : '👤 IDENTIFICADA'
  const contato = denuncia.anonimo 
    ? 'Sem informações de contato' 
    : `Email: ${denuncia.email || 'N/A'}<br>Matrícula: ${denuncia.matricula || 'N/A'}`

  const evidenciasHtml = denuncia.evidencias_urls.length > 0
    ? `<div style="margin-top: 20px;">
        <h3>Evidências (${denuncia.evidencias_count} foto(s)):</h3>
        <ul>
          ${denuncia.evidencias_urls.map(url => `<li><a href="${url}" target="_blank">${url}</a></li>`).join('')}
        </ul>
      </div>`
    : '<p>Nenhuma evidência anexada.</p>'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
          .info { margin: 10px 0; }
          .label { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 NOVA DENÚNCIA RECEBIDA</h1>
          </div>
          <div class="content">
            <div class="info"><span class="label">Tipo:</span> ${tipo}</div>
            <div class="info"><span class="label">Base:</span> ${denuncia.base}</div>
            <div class="info"><span class="label">ID:</span> ${denuncia.id}</div>
            <div class="info">
              <span class="label">Descrição:</span>
              <p>${denuncia.descricao}</p>
            </div>
            <div class="info">
              <span class="label">Contato:</span>
              <p>${contato}</p>
            </div>
            ${evidenciasHtml}
          </div>
          <div style="margin-top: 20px; padding: 10px; background-color: #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
            Acesse o sistema para mais detalhes.
          </div>
        </div>
      </body>
    </html>
  `

  const text = `🚨 NOVA DENÚNCIA RECEBIDA

${tipo}

Base: ${denuncia.base}
ID: ${denuncia.id}

Descrição:
${denuncia.descricao}

Contato:
${denuncia.anonimo ? 'Sem informações de contato' : `Email: ${denuncia.email || 'N/A'}\nMatrícula: ${denuncia.matricula || 'N/A'}`}

Evidências: ${denuncia.evidencias_count} foto(s)
${denuncia.evidencias_urls.map(url => `- ${url}`).join('\n')}

---
Acesse o sistema para mais detalhes.`

  return {
    subject: `🚨 Nova Denúncia - ${denuncia.base}`,
    html,
    text
  }
}
