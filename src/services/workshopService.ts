import { Workshop } from '@/types';
import { supabase } from '@/lib/supabase';

export const workshopService = {
  async getAll(): Promise<Workshop[]> {
    const { data, error } = await supabase
      .from('oficinas')
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        base:bases(id, nome, codigo)
      `)
      .order('nome');

    if (error) {
      throw new Error(`Erro ao buscar oficinas: ${error.message}`);
    }

    return data;
  },

  async getById(id: string): Promise<Workshop> {
    const { data, error } = await supabase
      .from('oficinas')
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        base:bases(id, nome, codigo)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Erro ao buscar oficina: ${error.message}`);
    }

    return data;
  },

  async create(workshop: Omit<Workshop, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Workshop> {
    const { data, error } = await supabase
      .from('oficinas')
      .insert([workshop])
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar oficina: ${error.message}`);
    }

    return data;
  },

  async update(id: string, updates: Partial<Omit<Workshop, 'id' | 'criado_em' | 'atualizado_em'>>): Promise<Workshop> {
    const { data, error } = await supabase
      .from('oficinas')
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar oficina: ${error.message}`);
    }

    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('oficinas')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao deletar oficina: ${error.message}`);
    }
  },

  async getBySpecialty(specialty: string): Promise<Workshop[]> {
    const { data, error } = await supabase
      .from('oficinas')
      .select('*')
      .contains('especialidades', [specialty])
      .order('nome');

    if (error) {
      throw new Error(`Erro ao buscar oficinas por especialidade: ${error.message}`);
    }

    return data || [];
  }
}; 