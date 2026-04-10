/**
 * Configuração de emails para ordens de desconto do almoxarifado
 * Os emails são enviados quando uma ordem assinada/recusada é feita upload
 * 
 * NOTA: Esta função agora busca do banco de dados. Os dados hardcoded abaixo
 * são mantidos apenas como fallback caso o banco não esteja disponível.
 */

// Mapeamento de contratos para emails destinatários (FALLBACK - manter para compatibilidade)
export const EMAIL_DESCONTO_CONTRATOS: Record<string, string[]> = {
    // São Paulo
    'CNT-TMAS': ['cintya.duplat@pse.srv.br', 'mauricio.junior@pse.srv.br'],
    'TMA': ['cintya.duplat@pse.srv.br', 'mauricio.junior@pse.srv.br'],

    // Rio de Janeiro
    'CNT-NITEI': ['edilene.borges@pse.srv.br', 'claudia.silva@pse.srv.br'],
    'CNT-MAG': ['edilene.borges@pse.srv.br', 'claudia.silva@pse.srv.br'],
    'CNT-OBRA': ['edilene.borges@pse.srv.br', 'claudia.silva@pse.srv.br'],
    'NITEI': ['edilene.borges@pse.srv.br', 'claudia.silva@pse.srv.br'],
    'MAGARCA': ['edilene.borges@pse.srv.br', 'claudia.silva@pse.srv.br'],

    // Goiás - emails específicos removidos (Paulo Henrique recebe todos)
    'CNT-GOIS': [],
    'GOIAS': [],
}

// Emails que recebem TODAS as ordens de desconto (FALLBACK)
export const EMAIL_DESCONTO_TODOS: string[] = [
    'paulohenrique.lima@pse.srv.br',
    'Jamille.silva@pse.srv.br',
    'rafael.muniz@pse.srv.br',
    'Rodrigo.anjos@pse.srv.br',
    'geraldo.junior@pse.srv.br',
    'igor.araujo@pse.srv.br',
]

/**
 * Obtém os emails destinatários baseado no código do contrato
 * Esta função deve ser chamada do lado do servidor com um cliente Supabase
 * Para uso no cliente, use getEmailsDescontoPorContratoFromDB
 */
export function getEmailsDescontoPorContratoSync(codigoContrato: string): string[] {
    const codigo = codigoContrato.toUpperCase()
    console.log('🔍 getEmailsDescontoPorContratoSync - Código do contrato recebido:', codigo)

    // Buscar emails específicos do contrato
    let emailsContrato: string[] = []

    // Tentar match exato primeiro
    if (EMAIL_DESCONTO_CONTRATOS[codigo]) {
        emailsContrato = EMAIL_DESCONTO_CONTRATOS[codigo]
        console.log('✅ Match exato encontrado para:', codigo, '- Emails:', emailsContrato)
    } else {
        // Tentar match parcial
        let matchEncontrado = false
        for (const [key, emails] of Object.entries(EMAIL_DESCONTO_CONTRATOS)) {
            if (codigo.includes(key) || key.includes(codigo)) {
                emailsContrato = emails
                matchEncontrado = true
                console.log('✅ Match parcial encontrado:', { codigo, key, emails })
                break
            }
        }
        if (!matchEncontrado) {
            console.warn('⚠️ Nenhum match encontrado para o código:', codigo)
        }
    }

    // Combinar com emails que recebem todas
    const emailsCombinados = [...emailsContrato, ...EMAIL_DESCONTO_TODOS]
    const todosEmails = emailsCombinados.filter((email, index) => emailsCombinados.indexOf(email) === index)

    console.log('📋 Emails finais retornados (sync):', {
        codigoContrato: codigo,
        emailsEspecificos: emailsContrato.length,
        emailsTodos: EMAIL_DESCONTO_TODOS.length,
        totalFinal: todosEmails.length,
        todosEmails
    })

    return todosEmails
}

/**
 * Identifica a região do contrato para exibição no email
 */
export function getRegiaoContrato(codigoContrato: string): string {
    const codigo = codigoContrato.toUpperCase()

    if (codigo.includes('TMAS') || codigo.includes('TMA')) {
        return 'São Paulo'
    }
    if (codigo.includes('NITEI') || codigo.includes('MAG') || codigo.includes('OBRA')) {
        return 'Rio de Janeiro'
    }
    if (codigo.includes('GOIS') || codigo.includes('GOIAS')) {
        return 'Goiás'
    }

    return 'Não identificada'
}
