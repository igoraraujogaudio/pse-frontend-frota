import { supabase } from '@/lib/supabase';
import { Warning, WarningFilters } from '@/types/warning';

export const warningService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('medidas_disciplinares')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar avisos:', error);
      throw error;
    }
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('medidas_disciplinares')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Warning;
  },

  async create(warning: Partial<Warning>) {
    const res = await fetch('/api/warnings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(warning),
    });
    
    if (!res.ok) {
      let error;
      try {
        error = await res.json();
      } catch {
        throw new Error('Erro ao criar aviso');
      }
      throw new Error(error.error || 'Erro ao criar aviso');
    }
    
    // Get headers returned by API
    const fileUrl = res.headers.get('X-Supabase-File-Url');
    const realWarningId = res.headers.get('X-Warning-Id');
    
    // Trata como HTML - abre em nova aba para impressão
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      newWindow.onload = () => {
        setTimeout(() => {
          newWindow.print();
        }, 500);
      };
    }
    
    return {
      id: realWarningId || crypto.randomUUID(),
      arquivo_assinado_url: fileUrl || url,
      ...warning
    } as Warning;
  },

  async update(id: string, updates: Partial<Warning>) {
    const { data, error } = await supabase
      .from('medidas_disciplinares')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Warning;
  },

  async edit(id: string, warning: Partial<Warning>) {
    // Verificar se o aviso pode ser editado (só se ainda não foi assinado)
    const currentWarning = await this.getById(id);
    
    if (currentWarning.status !== 'pendente') {
      throw new Error('Aviso não pode ser editado após ser assinado ou recusado');
    }

    if (currentWarning.arquivo_assinado_url) {
      throw new Error('Aviso não pode ser editado após upload do arquivo assinado');
    }

    // Atualizar dados no banco
    const { data, error } = await supabase
      .from('medidas_disciplinares')
      .update({
        ...warning,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Warning;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('medidas_disciplinares')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async regenerate(id: string) {
    const res = await fetch('/api/warnings/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warningId: id }),
    });
    
    if (!res.ok) {
      let error;
      try {
        error = await res.json();
      } catch {
        throw new Error('Erro ao regenerar aviso');
      }
      throw new Error(error.error || 'Erro ao regenerar aviso');
    }
    
    const fileUrl = res.headers.get('X-Supabase-File-Url');
    
    // Trata como HTML
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      newWindow.onload = () => {
        setTimeout(() => {
          newWindow.print();
        }, 500);
      };
    }
    
    return {
      arquivo_assinado_url: fileUrl || url
    };
  },

  async sign(id: string, signatureData: { testemunha1_nome?: string; testemunha1_cpf?: string; testemunha2_nome?: string; testemunha2_cpf?: string }) {
    const { data, error } = await supabase
      .from('medidas_disciplinares')
      .update({
        status: 'assinado',
        ...signatureData
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Warning;
  },

  async reject(id: string, rejectionData: { testemunha1_nome?: string; testemunha1_cpf?: string; testemunha2_nome?: string; testemunha2_cpf?: string }) {
    const { data, error } = await supabase
      .from('medidas_disciplinares')
      .update({
        status: 'recusado',
        recusado: true,
        ...rejectionData
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Warning;
  },

  async getFiltered(filters: WarningFilters) {
    try {
      let query = supabase
        .from('medidas_disciplinares')
        .select('*');

      if (filters.tipo_aviso) {
        query = query.eq('tipo_aviso', filters.tipo_aviso);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.user_id) {
        query = query.eq('target_user_id', filters.user_id);
      }

      if (filters.data_inicio) {
        query = query.gte('data_ocorrencia', filters.data_inicio);
      }

      if (filters.data_fim) {
        query = query.lte('data_ocorrencia', filters.data_fim);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar avisos filtrados:', error);
      throw error;
    }
  },

  async uploadSignedFile(warningId: string, file: File, action: 'assinado' | 'recusado' = 'assinado', testemunhas?: {
    testemunha1_nome: string;
    testemunha1_cpf: string;
    testemunha2_nome: string;
    testemunha2_cpf: string;
  }) {
    try {
      // 1. Upload do arquivo para o bucket do Supabase
      const fileName = `signed-warning-${warningId}-${Date.now()}.pdf`;
      const bucket = 'medidas-disciplinares';
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          contentType: 'application/pdf',
          upsert: false, // Não sobrescrever arquivos existentes
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // 2. Gerar URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      const fileUrl = urlData.publicUrl;

      // 3. Preparar dados de atualização baseados na ação
      const updateData: Partial<Warning> = {
        arquivo_assinado_url: fileUrl,
      };

      if (action === 'assinado') {
        updateData.status = 'assinado';
        updateData.recusado = false;
      } else if (action === 'recusado') {
        updateData.status = 'recusado';
        updateData.recusado = true;
        if (testemunhas) {
          updateData.testemunha1_nome = testemunhas.testemunha1_nome;
          updateData.testemunha1_cpf = testemunhas.testemunha1_cpf;
          updateData.testemunha2_nome = testemunhas.testemunha2_nome;
          updateData.testemunha2_cpf = testemunhas.testemunha2_cpf;
        }
      }

      // 4. Atualizar registro no banco
      const { data: updateResult, error: updateError } = await supabase
        .from('medidas_disciplinares')
        .update(updateData)
        .eq('id', warningId)
        .select()
        .single();

      if (updateError) {
        console.error('Erro ao atualizar registro:', updateError);
        throw new Error(`Erro ao atualizar registro: ${updateError.message}`);
      }

      return updateResult;
    } catch (error) {
      console.error('Erro no upload de arquivo assinado:', error);
      throw error;
    }
  }
};

