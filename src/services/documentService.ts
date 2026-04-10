import { supabase } from '@/lib/supabase'

export interface DocumentInfo {
  id: string
  user_id: string
  tipo: 'har' | 'cnh'
  numero: string
  arquivo_url: string
  nome_arquivo: string
  vencimento: string
  status: 'vigente' | 'vencendo' | 'vencido'
  criado_em: string
  atualizado_em: string
  usuarios?: {
    id: string
    nome: string
    email: string
    equipe: string
  }
}

export interface DocumentUpload {
  user_id: string
  tipo: 'har' | 'cnh'
  numero: string
  arquivo: File
  vencimento: string
}

export const documentService = {
  // Upload de documento
  async uploadDocument(upload: DocumentUpload): Promise<DocumentInfo> {
    try {
      const fileExt = upload.arquivo.name.split('.').pop()
      const fileName = `${upload.user_id}_${upload.tipo}_${Date.now()}.${fileExt}`
      const filePath = `documents/${upload.tipo}/${fileName}`

      // Upload do arquivo para o bucket
      const { error: uploadError } = await supabase.storage
        .from('user-documents')
        .upload(filePath, upload.arquivo)

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`)
      }

      // Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from('user-documents')
        .getPublicUrl(filePath)

      // Salvar informações do documento no banco
      const { data: documentData, error: insertError } = await supabase
        .from('user_documents')
        .insert({
          user_id: upload.user_id,
          tipo: upload.tipo,
          numero: upload.numero,
          arquivo_url: urlData.publicUrl,
          nome_arquivo: fileName,
          vencimento: upload.vencimento,
          status: this.calculateStatus(upload.vencimento)
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Erro ao salvar documento: ${insertError.message}`)
      }

      return documentData
    } catch (error) {
      console.error('Erro no upload do documento:', error)
      throw error
    }
  },

  // Atualizar documento
  async updateDocument(id: string, updates: Partial<DocumentInfo>): Promise<DocumentInfo> {
    try {
      const { data, error } = await supabase
        .from('user_documents')
        .update({
          ...updates,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new Error(`Erro ao atualizar documento: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Erro ao atualizar documento:', error)
      throw error
    }
  },

  // Deletar documento
  async deleteDocument(id: string): Promise<void> {
    try {
      // Primeiro, obter informações do documento para deletar o arquivo
      const { data: document } = await supabase
        .from('user_documents')
        .select('nome_arquivo, tipo')
        .eq('id', id)
        .single()

      if (document) {
        // Deletar arquivo do storage
        const filePath = `documents/${document.tipo}/${document.nome_arquivo}`
        await supabase.storage
          .from('user-documents')
          .remove([filePath])
      }

      // Deletar registro do banco
      const { error } = await supabase
        .from('user_documents')
        .delete()
        .eq('id', id)

      if (error) {
        throw new Error(`Erro ao deletar documento: ${error.message}`)
      }
    } catch (error) {
      console.error('Erro ao deletar documento:', error)
      throw error
    }
  },

  // Buscar documentos por usuário
  async getDocumentsByUser(userId: string): Promise<DocumentInfo[]> {
    try {
      const { data, error } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false })

      if (error) {
        throw new Error(`Erro ao buscar documentos: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Erro ao buscar documentos do usuário:', error)
      throw error
    }
  },

  // Buscar todos os documentos
  async getAllDocuments(): Promise<DocumentInfo[]> {
    try {
      const { data, error } = await supabase
        .from('user_documents')
        .select(`
          *,
          usuarios:user_id (
            id,
            nome,
            email,
            operacao
          )
        `)
        .order('criado_em', { ascending: false })

      if (error) {
        throw new Error(`Erro ao buscar documentos: ${error.message}`)
      }

      // Map the operacao field to equipe for backward compatibility
      const mappedData = (data || []).map(doc => ({
        ...doc,
        usuarios: doc.usuarios ? {
          ...doc.usuarios,
          equipe: doc.usuarios.operacao || 'Não informado'
        } : null
      }))

      return mappedData
    } catch (error) {
      console.error('Erro ao buscar todos os documentos:', error)
      throw error
    }
  },

  // Buscar documentos vencendo (≤30 dias)
  async getExpiringDocuments(): Promise<DocumentInfo[]> {
    try {
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      const { data, error } = await supabase
        .from('user_documents')
        .select(`
          *,
          usuarios:user_id (
            id,
            nome,
            email,
            equipe
          )
        `)
        .lte('vencimento', thirtyDaysFromNow.toISOString())
        .gte('vencimento', new Date().toISOString())
        .order('vencimento', { ascending: true })

      if (error) {
        throw new Error(`Erro ao buscar documentos vencendo: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Erro ao buscar documentos vencendo:', error)
      throw error
    }
  },

  // Buscar documentos vencidos
  async getExpiredDocuments(): Promise<DocumentInfo[]> {
    try {
      const { data, error } = await supabase
        .from('user_documents')
        .select('*')
        .lt('vencimento', new Date().toISOString())
        .order('vencimento', { ascending: true })

      if (error) {
        throw new Error(`Erro ao buscar documentos vencidos: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Erro ao buscar documentos vencidos:', error)
      throw error
    }
  },

  // Calcular status baseado na data de vencimento
  calculateStatus(vencimento: string): 'vigente' | 'vencendo' | 'vencido' {
    const now = new Date()
    const exp = new Date(vencimento)
    const daysUntilExpiration = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiration < 0) return 'vencido'
    if (daysUntilExpiration <= 30) return 'vencendo'
    return 'vigente'
  },

  // Download do arquivo
  async downloadDocument(filePath: string): Promise<Blob> {
    try {
      const { data, error } = await supabase.storage
        .from('user-documents')
        .download(filePath)

      if (error) {
        throw new Error(`Erro no download: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Erro no download do documento:', error)
      throw error
    }
  }
}
