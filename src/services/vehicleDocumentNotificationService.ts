import { supabase } from '@/lib/supabase'

export interface VehicleDocumentExpirationData {
  veiculoId: string
  veiculoPlaca: string
  veiculoModelo: string
  contratoId: string
  contratoNome: string
  documento: 'acustico' | 'eletrico' | 'tacografo' | 'aet' | 'fumaca' | 'crlv' | 'apolice' | 'contrato_seguro'
  dataVencimento: string
  diasParaVencimento: number
  status: 'vencendo' | 'atencao' | 'vencido'
  documentoId: string
}

export interface VehicleDocumentNotificationUser {
  id: string
  nome: string
  email: string
  nivel_acesso: string
}

interface DatabaseDocumentoVeiculo {
  id: string
  veiculo_id: string
  tipo_documento: string
  expira_em: string
  veiculos: {
    id: string
    placa: string
    modelo: string
    contrato_id: string
    contratos: {
      id: string
      nome: string
    }
  }
}

interface DatabaseUsuario {
  id: string
  nome: string
  email: string
  nivel_acesso: string
  usuario_permissoes_modulares: {
    funcionalidade_id: string
    ativo: boolean
    concedido: boolean
    funcionalidades_modulares: {
      codigo: string
    }
  }
}

interface DatabaseAdmin {
  id: string
  nome: string
  email: string
  nivel_acesso: string
}

class VehicleDocumentNotificationService {
  /**
   * Busca veículos com documentos próximos ao vencimento
   */
  async getExpiringVehicleDocuments(): Promise<VehicleDocumentExpirationData[]> {
    console.log('🔔 VehicleDocumentNotificationService - Verificando documentos de veículos próximos ao vencimento')
    
    const hoje = new Date()
    const em60Dias = new Date(hoje.getTime() + (60 * 24 * 60 * 60 * 1000))
    
    const expiringDocuments: VehicleDocumentExpirationData[] = []
    
    // Buscar documentos de veículos próximos ao vencimento
    const { data: documentos, error } = await supabase
      .from('documentos_veiculo')
      .select(`
        id,
        veiculo_id,
        tipo_documento,
        expira_em,
        veiculos!inner(
          id,
          placa,
          modelo,
          contrato_id,
          contratos!inner(
            id,
            nome
          )
        )
      `)
      .not('expira_em', 'is', null)
      .lte('expira_em', em60Dias.toISOString().split('T')[0])
      .order('expira_em', { ascending: true }) as { data: DatabaseDocumentoVeiculo[] | null, error: unknown }

    if (error) {
      console.error('❌ Erro ao buscar documentos de veículos próximos ao vencimento:', error)
      return []
    }

    if (!documentos) return []

    // Processar cada documento
    for (const documento of documentos) {
      const dataVencimento = new Date(documento.expira_em)
      const diasParaVencimento = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      
      let status: 'vencendo' | 'atencao' | 'vencido' = 'vencendo'
      
      if (diasParaVencimento < 0) {
        status = 'vencido'
      } else if (diasParaVencimento <= 30) {
        status = 'atencao'
      }

      expiringDocuments.push({
        veiculoId: documento.veiculo_id,
        veiculoPlaca: documento.veiculos.placa,
        veiculoModelo: documento.veiculos.modelo,
        contratoId: documento.veiculos.contrato_id,
        contratoNome: documento.veiculos.contratos?.nome || 'Contrato não especificado',
        documento: documento.tipo_documento as 'acustico' | 'eletrico' | 'tacografo' | 'aet' | 'fumaca' | 'crlv' | 'apolice' | 'contrato_seguro',
        dataVencimento: documento.expira_em,
        diasParaVencimento,
        status,
        documentoId: documento.id
      })
    }

    console.log(`🔔 Encontrados ${expiringDocuments.length} documentos de veículos próximos ao vencimento`)
    return expiringDocuments
  }

  /**
   * Busca usuários que devem receber notificações de documentos de veículos
   * Apenas usuários com funcionalidades modulares de veículos e acesso ao contrato
   */
  async getVehicleDocumentNotificationRecipients(): Promise<VehicleDocumentNotificationUser[]> {
    console.log('🔔 VehicleDocumentNotificationService - Buscando destinatários para notificações de documentos de veículos')
    
    // Buscar usuários com funcionalidade específica "veiculos.site.editar_veiculo"
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        nome,
        email,
        nivel_acesso,
        usuario_permissoes_modulares!inner(
          funcionalidade_id,
          ativo,
          concedido,
          funcionalidades_modulares!inner(
            codigo
          )
        )
      `)
      .eq('status', 'ativo')
      .eq('usuario_permissoes_modulares.ativo', true)
      .eq('usuario_permissoes_modulares.concedido', true)
      .eq('usuario_permissoes_modulares.funcionalidades_modulares.codigo', 'veiculos.site.editar_veiculo') as { data: DatabaseUsuario[] | null, error: unknown }

    if (error) {
      console.error('❌ Erro ao buscar destinatários:', error)
      return []
    }

    console.log(`🔔 Encontrados ${usuarios?.length || 0} usuários com funcionalidade "veiculos.site.editar_veiculo"`)

    // Também incluir admin e diretor
    const { data: admins, error: adminError } = await supabase
      .from('usuarios')
      .select(`
        id,
        nome,
        email,
        nivel_acesso
      `)
      .eq('status', 'ativo')
      .in('nivel_acesso', ['admin', 'diretor']) as { data: DatabaseAdmin[] | null, error: unknown }

    if (adminError) {
      console.error('❌ Erro ao buscar admins:', adminError)
    }

    // Combinar usuários com funcionalidades modulares + admins/diretores
    const todosUsuarios = [
      ...(usuarios || []).map((user: DatabaseUsuario) => ({
        id: user.id,
        nome: user.nome,
        email: user.email,
        nivel_acesso: user.nivel_acesso
      })),
      ...(admins || []).map((user: DatabaseAdmin) => ({
        id: user.id,
        nome: user.nome,
        email: user.email,
        nivel_acesso: user.nivel_acesso
      }))
    ]

    // Remover duplicatas
    const usuariosUnicos = todosUsuarios.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    )

    console.log(`🔔 Total de ${usuariosUnicos.length} destinatários elegíveis para notificações de documentos de veículos`)
    return usuariosUnicos
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
   * Verifica se o usuário tem acesso ao contrato específico via usuarios_contratos
   */
  private async verificarAcessoContrato(user: VehicleDocumentNotificationUser, contratoId: string): Promise<boolean> {
    // Admin e diretor têm acesso a todos os contratos
    if (['admin', 'diretor'].includes(user.nivel_acesso)) {
      return true
    }
    
    // Verificar se o usuário tem acesso específico ao contrato via usuario_contratos
    const { data, error } = await supabase
      .from('usuario_contratos')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('contrato_id', contratoId)
      .eq('ativo', true)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Erro ao verificar acesso ao contrato:', error)
      return false
    }
    
    return !!data
  }

  /**
   * Verifica se já existe notificação similar para evitar duplicatas
   */
  private async checkExistingNotification(
    userId: string, 
    veiculoId: string, 
    documento: string, 
    status: string,
    titulo: string
  ): Promise<boolean> {
    try {
      const hoje = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('notificacoes')
        .select('id')
        .eq('usuario_id', userId)
        .eq('titulo', titulo)
        .gte('criado_em', `${hoje}T00:00:00`)
        .lt('criado_em', `${hoje}T23:59:59`)
        .limit(1)

      if (error) {
        console.error('❌ Erro ao verificar notificação existente:', error)
        return false
      }

      return (data && data.length > 0)
    } catch (error) {
      console.error('❌ Erro ao verificar notificação existente:', error)
      return false
    }
  }

  /**
   * Processa notificações de vencimento de documentos de veículos
   */
  async processVehicleDocumentExpirationNotifications(): Promise<void> {
    try {
      console.log('🔔 Iniciando processamento de notificações de vencimento de documentos de veículos')
      
      const expiringDocuments = await this.getExpiringVehicleDocuments()
      const recipients = await this.getVehicleDocumentNotificationRecipients()
      
      if (expiringDocuments.length === 0) {
        console.log('ℹ️ Nenhum documento de veículo próximo ao vencimento encontrado')
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
        // Verificar se o usuário tem acesso ao contrato do veículo
        const temAcessoContrato = await this.verificarAcessoContrato(recipient, doc.contratoId)
        
        if (!temAcessoContrato) {
          console.log(`⏭️ Usuário ${recipient.nome} não tem acesso ao contrato ${doc.contratoNome} - pulando notificação`)
          continue
        }

            // Determinar tipo e mensagem baseado no status
            let tipo: 'info' | 'warning' | 'error' | 'success' = 'info'
            let titulo = ''
            let mensagem = ''

            switch (doc.status) {
              case 'vencido':
                tipo = 'error'
                titulo = `🚨 Laudo ${doc.documento.toUpperCase()} Vencido`
                mensagem = `Veículo ${doc.veiculoPlaca} (${doc.veiculoModelo}) - Contrato: ${doc.contratoNome} - Laudo ${doc.documento.toUpperCase()} venceu em ${doc.dataVencimento}`
                break
              case 'atencao':
                tipo = 'warning'
                titulo = `⚠️ Laudo ${doc.documento.toUpperCase()} Vencendo em ${doc.diasParaVencimento} dias`
                mensagem = `Veículo ${doc.veiculoPlaca} (${doc.veiculoModelo}) - Contrato: ${doc.contratoNome} - Laudo ${doc.documento.toUpperCase()} vence em ${doc.diasParaVencimento} dias (${doc.dataVencimento})`
                break
              case 'vencendo':
                tipo = 'info'
                titulo = `📅 Laudo ${doc.documento.toUpperCase()} Vencendo em ${doc.diasParaVencimento} dias`
                mensagem = `Veículo ${doc.veiculoPlaca} (${doc.veiculoModelo}) - Contrato: ${doc.contratoNome} - Laudo ${doc.documento.toUpperCase()} vence em ${doc.diasParaVencimento} dias (${doc.dataVencimento})`
                break
            }

            // Verificar se já existe notificação similar hoje
            const exists = await this.checkExistingNotification(
              recipient.id, 
              doc.veiculoId, 
              doc.documento, 
              doc.status,
              titulo
            )

            if (!exists) {
              console.log(`📤 Criando notificação para ${recipient.nome} sobre ${doc.veiculoPlaca} - ${doc.documento.toUpperCase()}`)
              
              await this.createNotification({
                userId: recipient.id,
                title: titulo,
                message: mensagem,
                type: tipo,
                data: {
                  type: 'vehicle_document_expiration',
                  veiculoId: doc.veiculoId,
                  veiculoPlaca: doc.veiculoPlaca,
                  veiculoModelo: doc.veiculoModelo,
                  contratoId: doc.contratoId,
                  contratoNome: doc.contratoNome,
                  documento: doc.documento,
                  documentoId: doc.documentoId,
                  dataVencimento: doc.dataVencimento,
                  diasParaVencimento: doc.diasParaVencimento,
                  status: doc.status,
                  action: 'vehicle_document_expiration_alert'
                }
              })
              notificationsCreated++
            } else {
              console.log(`⏭️ Pulando notificação duplicada para ${recipient.nome} sobre ${doc.veiculoPlaca}`)
            }
          } catch (error) {
            console.error(`❌ Erro ao processar notificação para ${recipient.nome} sobre ${doc.veiculoPlaca}:`, error)
          }
        }
      }

      console.log(`✅ Processamento concluído. ${notificationsCreated} notificações criadas`)

    } catch (error) {
      console.error('❌ Erro ao processar notificações de vencimento de documentos de veículos:', error)
    }
  }

  /**
   * Método para testar o sistema de notificações
   */
  async testVehicleDocumentNotificationSystem(): Promise<void> {
    console.log('🧪 Testando sistema de notificações de vencimento de documentos de veículos')
    
    try {
      const expiringDocs = await this.getExpiringVehicleDocuments()
      const recipients = await this.getVehicleDocumentNotificationRecipients()
      
      console.log(`📊 Documentos próximos ao vencimento: ${expiringDocs.length}`)
      console.log(`👥 Destinatários: ${recipients.length}`)
      
      expiringDocs.forEach(doc => {
        console.log(`  - ${doc.veiculoPlaca}: ${doc.documento} (${doc.status}) - ${doc.diasParaVencimento} dias`)
      })
      
    } catch (error) {
      console.error('❌ Erro no teste:', error)
    }
  }
}

export const vehicleDocumentNotificationService = new VehicleDocumentNotificationService()
