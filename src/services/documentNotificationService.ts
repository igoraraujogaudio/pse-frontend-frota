import { supabase } from '@/lib/supabase'

export interface DocumentExpirationData {
  funcionarioId: string
  funcionarioNome: string
  funcionarioEmail: string
  documento: 'aso' | 'cnh' | 'har'
  dataVencimento: string
  diasParaVencimento: number
  status: 'vencendo' | 'atencao' | 'vencido'
}

export interface DocumentNotificationUser {
  id: string
  nome: string
  email: string
  nivel_acesso: string
}

class DocumentNotificationService {
  /**
   * Busca funcionários com documentos próximos ao vencimento
   */
  async getExpiringDocuments(): Promise<DocumentExpirationData[]> {
    console.log('🔔 DocumentNotificationService - Verificando documentos próximos ao vencimento')
    
    const hoje = new Date()
    // const em30Dias = new Date(hoje.getTime() + (30 * 24 * 60 * 60 * 1000))
    const em60Dias = new Date(hoje.getTime() + (60 * 24 * 60 * 60 * 1000))
    
    const expiringDocuments: DocumentExpirationData[] = []
    
    // Buscar funcionários ativos com documentos próximos ao vencimento
    const { data: funcionarios, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        nome,
        email,
        validade_aso,
        validade_cnh,
        har_vencimento,
        data_ultimo_exame_aso
      `)
      .eq('status', 'ativo')
      .not('validade_aso', 'is', null)
      .or(`validade_aso.lte.${em60Dias.toISOString().split('T')[0]},validade_cnh.lte.${em60Dias.toISOString().split('T')[0]},har_vencimento.lte.${em60Dias.toISOString().split('T')[0]}`)

    if (error) {
      console.error('❌ Erro ao buscar funcionários com documentos próximos ao vencimento:', error)
      return []
    }

    if (!funcionarios) return []

    // Processar cada funcionário
    for (const funcionario of funcionarios) {
      // Verificar ASO
      if (funcionario.validade_aso) {
        const dataVencimentoASO = new Date(funcionario.validade_aso)
        const diasParaVencimento = Math.ceil((dataVencimentoASO.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diasParaVencimento <= 60) {
          let status: 'vencendo' | 'atencao' | 'vencido' = 'vencendo'
          
          if (diasParaVencimento < 0) {
            status = 'vencido'
          } else if (diasParaVencimento <= 30) {
            status = 'atencao'
          }
          
          expiringDocuments.push({
            funcionarioId: funcionario.id,
            funcionarioNome: funcionario.nome,
            funcionarioEmail: funcionario.email,
            documento: 'aso',
            dataVencimento: funcionario.validade_aso,
            diasParaVencimento,
            status
          })
        }
      }

      // Verificar CNH
      if (funcionario.validade_cnh) {
        const dataVencimentoCNH = new Date(funcionario.validade_cnh)
        const diasParaVencimento = Math.ceil((dataVencimentoCNH.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diasParaVencimento <= 60) {
          let status: 'vencendo' | 'atencao' | 'vencido' = 'vencendo'
          
          if (diasParaVencimento < 0) {
            status = 'vencido'
          } else if (diasParaVencimento <= 30) {
            status = 'atencao'
          }
          
          expiringDocuments.push({
            funcionarioId: funcionario.id,
            funcionarioNome: funcionario.nome,
            funcionarioEmail: funcionario.email,
            documento: 'cnh',
            dataVencimento: funcionario.validade_cnh,
            diasParaVencimento,
            status
          })
        }
      }

      // Verificar HAR
      if (funcionario.har_vencimento) {
        const dataVencimentoHAR = new Date(funcionario.har_vencimento)
        const diasParaVencimento = Math.ceil((dataVencimentoHAR.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diasParaVencimento <= 60) {
          let status: 'vencendo' | 'atencao' | 'vencido' = 'vencendo'
          
          if (diasParaVencimento < 0) {
            status = 'vencido'
          } else if (diasParaVencimento <= 30) {
            status = 'atencao'
          }
          
          expiringDocuments.push({
            funcionarioId: funcionario.id,
            funcionarioNome: funcionario.nome,
            funcionarioEmail: funcionario.email,
            documento: 'har',
            dataVencimento: funcionario.har_vencimento,
            diasParaVencimento,
            status
          })
        }
      }
    }

    console.log(`✅ Encontrados ${expiringDocuments.length} documentos próximos ao vencimento`)
    return expiringDocuments
  }

  /**
   * Busca usuários que devem receber notificações de vencimento
   */
  async getNotificationRecipients(): Promise<DocumentNotificationUser[]> {
    console.log('🔔 DocumentNotificationService - Buscando destinatários das notificações')
    
    // Buscar usuários com permissão modular para receber notificações de vencimento
    // Usar permissões existentes de funcionários (VISUALIZAR, EDITAR, etc.)
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        nome,
        email
      `)
      .eq('status', 'ativo')
      .in('id', []) // Simplified for now

    if (error) {
      console.error('❌ Erro ao buscar destinatários:', error)
      return []
    }

    console.log(`✅ Encontrados ${usuarios?.length || 0} destinatários com permissão modular de funcionários`)
    return (usuarios || []).map((user: unknown) => ({
      id: (user as Record<string, unknown>).id as string,
      nome: (user as Record<string, unknown>).nome as string,
      email: (user as Record<string, unknown>).email as string,
      nivel_acesso: (user as Record<string, unknown>).nivel_acesso as string || 'funcionario'
    }))
  }

  /**
   * Cria notificação no banco de dados
   */
  private async createNotification(notification: {
    userId: string
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'success'
    data: Record<string, unknown>
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .insert([{
          usuario_id: notification.userId,
          titulo: notification.title,
          mensagem: notification.message,
          tipo: notification.type,
          dados: notification.data,
          lida: false,
          criado_em: new Date().toISOString()
        }])

      if (error) {
        console.error('❌ Erro ao criar notificação:', error)
      } else {
        console.log('✅ Notificação criada no banco')
      }
    } catch (error) {
      console.error('❌ Erro ao criar notificação:', error)
    }
  }

  /**
   * Verifica se já existe notificação similar para evitar duplicatas
   */
  private async checkExistingNotification(
    userId: string, 
    funcionarioId: string, 
    documento: string, 
    status: string,
    titulo: string
  ): Promise<boolean> {
    const hoje = new Date().toISOString().split('T')[0]
    
    try {
      // Verificação mais robusta - verificar se existe notificação com a mesma chave única
      const chaveUnica = `${userId}-${funcionarioId}-${documento}-${status}-${hoje}`
      
      const { data, error } = await supabase
        .from('notificacoes')
        .select('id')
        .eq('usuario_id', userId)
        .eq('dados->>funcionarioId', funcionarioId)
        .eq('dados->>documento', documento)
        .eq('dados->>status', status)
        .eq('titulo', titulo)
        .gte('criado_em', hoje + 'T00:00:00.000Z')
        .lt('criado_em', hoje + 'T23:59:59.999Z')

      if (error) {
        console.error('❌ Erro ao verificar notificação existente:', error)
        return false
      }

      const exists = (data?.length || 0) > 0
      if (exists) {
        console.log(`⚠️ Notificação já existe para chave: ${chaveUnica}`)
      }
      
      return exists
    } catch (error) {
      console.error('❌ Erro na verificação de notificação existente:', error)
      return false
    }
  }

  /**
   * Processa notificações de vencimento de documentos
   */
  async processDocumentExpirationNotifications(): Promise<void> {
    try {
      console.log('🔔 Iniciando processamento de notificações de vencimento de documentos')
      
      const expiringDocuments = await this.getExpiringDocuments()
      const recipients = await this.getNotificationRecipients()
      
      if (expiringDocuments.length === 0) {
        console.log('ℹ️ Nenhum documento próximo ao vencimento encontrado')
        return
      }

      if (recipients.length === 0) {
        console.log('⚠️ Nenhum destinatário encontrado para as notificações')
        return
      }

      let notificationsCreated = 0

      // Processar cada destinatário
      for (const recipient of recipients) {
        console.log(`👤 Processando destinatário: ${recipient.nome}`)
        
        // Processar cada documento para este destinatário
        for (const doc of expiringDocuments) {
          try {
            // Determinar tipo e mensagem baseado no status
            let tipo: 'info' | 'warning' | 'error' | 'success' = 'info'
            let titulo = ''
            let mensagem = ''

            switch (doc.status) {
              case 'vencido':
                tipo = 'error'
                titulo = `🚨 ${doc.documento.toUpperCase()} Vencido`
                mensagem = `${doc.funcionarioNome} - ${doc.documento.toUpperCase()} venceu em ${doc.dataVencimento}`
                break
              case 'atencao':
                tipo = 'warning'
                titulo = `⚠️ ${doc.documento.toUpperCase()} Vencendo em ${doc.diasParaVencimento} dias`
                mensagem = `${doc.funcionarioNome} - ${doc.documento.toUpperCase()} vence em ${doc.diasParaVencimento} dias (${doc.dataVencimento})`
                break
              case 'vencendo':
                tipo = 'info'
                titulo = `📅 ${doc.documento.toUpperCase()} Vencendo em ${doc.diasParaVencimento} dias`
                mensagem = `${doc.funcionarioNome} - ${doc.documento.toUpperCase()} vence em ${doc.diasParaVencimento} dias (${doc.dataVencimento})`
                break
            }

            // Verificar se já existe notificação similar hoje
            const exists = await this.checkExistingNotification(
              recipient.id, 
              doc.funcionarioId, 
              doc.documento, 
              doc.status,
              titulo
            )

            if (!exists) {
              console.log(`📤 Criando notificação para ${recipient.nome} sobre ${doc.funcionarioNome} - ${doc.documento.toUpperCase()}`)
              
              await this.createNotification({
                userId: recipient.id,
                title: titulo,
                message: mensagem,
                type: tipo,
                data: {
                  type: 'document_expiration',
                  funcionarioId: doc.funcionarioId,
                  funcionarioNome: doc.funcionarioNome,
                  documento: doc.documento,
                  dataVencimento: doc.dataVencimento,
                  diasParaVencimento: doc.diasParaVencimento,
                  status: doc.status,
                  action: 'expiration_alert'
                }
              })
              notificationsCreated++
            } else {
              console.log(`⏭️ Pulando notificação duplicada para ${recipient.nome} sobre ${doc.funcionarioNome}`)
            }
          } catch (error) {
            console.error(`❌ Erro ao processar notificação para ${recipient.nome} sobre ${doc.funcionarioNome}:`, error)
          }
        }
      }

      console.log(`✅ Processamento concluído. ${notificationsCreated} notificações criadas`)

    } catch (error) {
      console.error('❌ Erro ao processar notificações de vencimento:', error)
    }
  }

  /**
   * Método para testar o sistema de notificações
   */
  async testNotificationSystem(): Promise<void> {
    console.log('🧪 Testando sistema de notificações de vencimento')
    
    try {
      await this.processDocumentExpirationNotifications()
      console.log('✅ Teste do sistema de notificações concluído')
    } catch (error) {
      console.error('❌ Erro no teste do sistema de notificações:', error)
    }
  }
}

export const documentNotificationService = new DocumentNotificationService()
