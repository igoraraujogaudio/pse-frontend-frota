import { supabase } from '@/lib/supabase'
import { Base } from '@/types'

export const locationService = {
  async getAll(): Promise<Base[]> {
    const { data, error } = await supabase
      .from('bases')
      .select('*')
      .eq('ativa', true)
      .order('nome')

    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Base> {
    const { data, error } = await supabase
      .from('bases')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async create(location: Omit<Base, 'id' | 'created_at' | 'updated_at'>): Promise<Base> {
    const { data, error } = await supabase
      .from('bases')
      .insert([location])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, location: Partial<Base>): Promise<Base> {
    const { data, error } = await supabase
      .from('bases')
      .update(location)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bases')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
