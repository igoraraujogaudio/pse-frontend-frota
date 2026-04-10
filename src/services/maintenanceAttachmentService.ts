import { supabase } from '@/lib/supabase'
import { MaintenanceAttachment } from '@/types'

export class MaintenanceAttachmentService {
  /**
   * Adicionar anexo a uma manutenção
   */
  static async addAttachment(
    maintenanceId: string,
    attachment: Omit<MaintenanceAttachment, 'id' | 'criado_em' | 'criado_por'>
  ): Promise<MaintenanceAttachment> {
    const { data, error } = await supabase.rpc('add_maintenance_attachment', {
      p_maintenance_id: maintenanceId,
      p_nome: attachment.nome,
      p_url: attachment.url,
      p_tipo: attachment.tipo,
      p_tamanho: attachment.tamanho,
      p_categoria: attachment.categoria,
      p_descricao: attachment.descricao
    })

    if (error) {
      console.error('Erro ao adicionar anexo:', error)
      throw new Error('Não foi possível adicionar o anexo')
    }

    // Buscar o anexo completo com informações do usuário
    const attachmentData = await this.getAttachmentById(data)
    return attachmentData
  }

  /**
   * Remover anexo de uma manutenção
   */
  static async removeAttachment(attachmentId: string): Promise<boolean> {
    const { error } = await supabase.rpc('remove_maintenance_attachment', {
      p_attachment_id: attachmentId
    })

    if (error) {
      console.error('Erro ao remover anexo:', error)
      throw new Error('Não foi possível remover o anexo')
    }

    return true
  }

  /**
   * Buscar anexos de uma manutenção
   */
  static async getAttachmentsByMaintenance(maintenanceId: string): Promise<MaintenanceAttachment[]> {
    const { data, error } = await supabase
      .from('maintenance_attachments_with_user')
      .select('*')
      .eq('maintenance_id', maintenanceId)
      .order('criado_em', { ascending: false })

    if (error) {
      console.error('Erro ao buscar anexos:', error)
      throw new Error('Não foi possível carregar os anexos')
    }

    return data || []
  }

  /**
   * Buscar anexo por ID
   */
  static async getAttachmentById(attachmentId: string): Promise<MaintenanceAttachment> {
    const { data, error } = await supabase
      .from('maintenance_attachments_with_user')
      .select('*')
      .eq('id', attachmentId)
      .single()

    if (error) {
      console.error('Erro ao buscar anexo:', error)
      throw new Error('Anexo não encontrado')
    }

    return data
  }

  /**
   * Atualizar informações de um anexo
   */
  static async updateAttachment(
    attachmentId: string,
    updates: Partial<Pick<MaintenanceAttachment, 'nome' | 'descricao' | 'categoria'>>
  ): Promise<MaintenanceAttachment> {
    const { data, error } = await supabase
      .from('maintenance_attachments')
      .update({
        nome: updates.nome,
        descricao: updates.descricao,
        categoria: updates.categoria,
        updated_at: new Date().toISOString()
      })
      .eq('id', attachmentId)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar anexo:', error)
      throw new Error('Não foi possível atualizar o anexo')
    }

    return data
  }

  /**
   * Upload de arquivo para storage
   */
  static async uploadFile(
    file: File,
    maintenanceId: string,
    category: string
  ): Promise<{ url: string; path: string }> {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `maintenance-attachments/${maintenanceId}/${category}/${fileName}`

    const { error } = await supabase.storage
      .from('maintenance-attachments')
      .upload(filePath, file)

    if (error) {
      console.error('Erro no upload:', error)
      throw new Error('Não foi possível fazer o upload do arquivo')
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from('maintenance-attachments')
      .getPublicUrl(filePath)

    return {
      url: urlData.publicUrl,
      path: filePath
    }
  }

  /**
   * Remover arquivo do storage
   */
  static async removeFileFromStorage(filePath: string): Promise<boolean> {
    const { error } = await supabase.storage
      .from('maintenance-attachments')
      .remove([filePath])

    if (error) {
      console.error('Erro ao remover arquivo do storage:', error)
      return false
    }

    return true
  }

  /**
   * Processo completo: upload + adicionar anexo
   */
  static async uploadAndAddAttachment(
    file: File,
    maintenanceId: string,
    category: string,
    description?: string
  ): Promise<MaintenanceAttachment> {
    try {
      // 1. Fazer upload do arquivo
      const { url } = await this.uploadFile(file, maintenanceId, category)

      // 2. Adicionar registro do anexo
      const attachment = await this.addAttachment(maintenanceId, {
        nome: file.name,
        url: url,
        tipo: file.type,
        tamanho: file.size,
        categoria: category as 'imagem' | 'nota_fiscal' | 'documento' | 'outros',
        descricao: description
      })

      return attachment
    } catch (error) {
      console.error('Erro no processo completo de upload:', error)
      throw error
    }
  }

  /**
   * Processo completo: remover anexo + arquivo
   */
  static async removeAttachmentAndFile(attachmentId: string): Promise<boolean> {
    try {
      // 1. Buscar informações do anexo
      const attachment = await this.getAttachmentById(attachmentId)
      
      // 2. Remover registro do banco
      await this.removeAttachment(attachmentId)

      // 3. Remover arquivo do storage (se for URL do nosso storage)
      if (attachment.url.includes('supabase')) {
        const urlParts = attachment.url.split('/')
        const filePath = urlParts.slice(urlParts.indexOf('maintenance-attachments')).join('/')
        await this.removeFileFromStorage(filePath)
      }

      return true
    } catch (error) {
      console.error('Erro no processo completo de remoção:', error)
      throw error
    }
  }

  /**
   * Estatísticas de anexos por manutenção
   */
  static async getAttachmentStats(maintenanceId: string): Promise<{
    total: number
    byCategory: Record<string, number>
    totalSize: number
  }> {
    const attachments = await this.getAttachmentsByMaintenance(maintenanceId)
    
    const stats = {
      total: attachments.length,
      byCategory: {} as Record<string, number>,
      totalSize: 0
    }

    attachments.forEach(attachment => {
      // Contar por categoria
      stats.byCategory[attachment.categoria] = (stats.byCategory[attachment.categoria] || 0) + 1
      
      // Somar tamanho total
      stats.totalSize += attachment.tamanho
    })

    return stats
  }
}

