import { supabase } from '@/lib/supabase';

interface Document {
  id: string;
  veiculo_id: string;
  tipo_documento: string;
  url_arquivo?: string;
  expira_em?: string;
  criado_em: string;
  atualizado_em: string;
  veiculo?: {
    placa: string;
    modelo: string;
  };
}

export const reportsService = {
  // Buscar todos os documentos com informações do veículo
  async getAll(): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documentos_veiculo')
      .select(`
        *,
        veiculo:veiculos(placa, modelo)
      `)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar documentos: ${error.message}`);
    }

    return data;
  },

  // Buscar documentos de um veículo específico
  async getByVehicle(vehicleId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documentos_veiculo')
      .select(`
        *,
        veiculo:veiculos(placa, modelo)
      `)
      .eq('veiculo_id', vehicleId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar documentos do veículo: ${error.message}`);
    }

    return data;
  },

  // Buscar um documento específico
  async getById(id: string): Promise<Document> {
    const { data, error } = await supabase
      .from('documentos_veiculo')
      .select(`
        *,
        veiculo:veiculos(placa, modelo)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Erro ao buscar documento: ${error.message}`);
    }

    return data;
  },

  // Criar novo documento
  async create(document: Partial<Document>): Promise<Document> {
    const { data, error } = await supabase
      .from('documentos_veiculo')
      .insert(document)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar documento: ${error.message}`);
    }

    return data;
  },

  // Atualizar documento
  async update(id: string, updates: Partial<Document>): Promise<Document> {
    const { data, error } = await supabase
      .from('documentos_veiculo')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar documento: ${error.message}`);
    }

    return data;
  },

  // Deletar documento
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('documentos_veiculo')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao deletar documento: ${error.message}`);
    }
  },

  // Upload de arquivo
  async uploadFile(file: File, vehicleId: string, documentType: string): Promise<Document> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${vehicleId}/${documentType}-${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('vehicle-documents')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      throw new Error(`Erro ao fazer upload do arquivo: ${uploadError.message}`);
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('vehicle-documents')
      .getPublicUrl(fileName);

    const document = await this.create({
      veiculo_id: vehicleId,
      tipo_documento: documentType,
      url_arquivo: publicUrl
    });

    return document;
  },

  // Buscar documentos próximos do vencimento
  async getExpiringSoon(days: number = 30): Promise<Document[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const { data, error } = await supabase
      .from('documentos_veiculo')
      .select(`
        *,
        veiculo:veiculos(placa, modelo)
      `)
      .not('expira_em', 'is', null)
      .lte('expira_em', futureDate.toISOString())
      .gte('expira_em', today.toISOString())
      .order('expira_em', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Buscar documentos vencidos
  async getExpired(): Promise<Document[]> {
    const today = new Date();

    const { data, error } = await supabase
      .from('documentos_veiculo')
      .select(`
        *,
        veiculo:veiculos(placa, modelo)
      `)
      .not('expira_em', 'is', null)
      .lt('expira_em', today.toISOString())
      .order('expira_em', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}; 