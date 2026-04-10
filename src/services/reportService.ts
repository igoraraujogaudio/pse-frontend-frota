import { supabase } from '@/lib/supabase';

export interface Document {
  id: string;
  veiculo_id: string;
  tipo_documento: string;
  url_arquivo: string | null;
  expira_em: string | null;
  criado_em: string;
  atualizado_em: string;
  veiculo?: {
    id: string;
    placa: string;
    modelo: string;
  };
}

export const reportService = {
  async getAll(): Promise<Document[]> {
      const { data, error } = await supabase
      .from('documentos_veiculo')
        .select(`
          *,
        veiculo:veiculos(id, placa, modelo)
        `)
      .order('criado_em', { ascending: false });

      if (error) {
      throw new Error(`Erro ao buscar documentos: ${error.message}`);
    }

    return data;
  },

  async getById(id: string): Promise<Document> {
      const { data, error } = await supabase
      .from('documentos_veiculo')
        .select(`
          *,
        veiculo:veiculos(id, placa, modelo)
        `)
        .eq('id', id)
        .single();

      if (error) {
      throw new Error(`Erro ao buscar documento: ${error.message}`);
      }

      return data;
  },

  async getByVehicle(vehicleId: string): Promise<Document[]> {
      const { data, error } = await supabase
      .from('documentos_veiculo')
        .select(`
          *,
        veiculo:veiculos(id, placa, modelo)
        `)
      .eq('veiculo_id', vehicleId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar documentos do veículo: ${error.message}`);
    }

    return data;
  },

  async create(document: Omit<Document, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Document> {
    const { data, error } = await supabase
      .from('documentos_veiculo')
      .insert([document])
      .select()
        .single();

      if (error) {
      throw new Error(`Erro ao criar documento: ${error.message}`);
      }

      return data;
  },

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

  async delete(id: string): Promise<void> {
      const { error } = await supabase
      .from('documentos_veiculo')
        .delete()
        .eq('id', id);

      if (error) {
      throw new Error(`Erro ao deletar documento: ${error.message}`);
    }
  },

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
      url_arquivo: publicUrl,
      expira_em: null
    });

    return document;
  },

  async getExpiringDocuments(days: number = 30): Promise<Document[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

      const { data, error } = await supabase
      .from('documentos_veiculo')
        .select(`
          *,
        veiculo:veiculos(id, placa, modelo)
        `)
      .not('expira_em', 'is', null)
      .lte('expira_em', futureDate.toISOString())
      .gte('expira_em', today.toISOString())
      .order('expira_em', { ascending: true });

      if (error) {
      throw new Error(`Erro ao buscar documentos expirando: ${error.message}`);
    }

    return data;
  },

  async getExpiredDocuments(): Promise<Document[]> {
    const today = new Date();

    const { data, error } = await supabase
      .from('documentos_veiculo')
      .select(`
        *,
        veiculo:veiculos(id, placa, modelo)
      `)
      .not('expira_em', 'is', null)
      .lt('expira_em', today.toISOString())
      .order('expira_em', { ascending: true });

      if (error) {
      throw new Error(`Erro ao buscar documentos expirados: ${error.message}`);
    }

    return data;
  }
}; 