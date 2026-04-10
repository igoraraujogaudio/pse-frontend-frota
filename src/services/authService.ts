import { supabase } from '@/lib/supabase';
import { User } from '@/types';

export const authService = {
  async signIn(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (user) {
        // Buscar dados adicionais do usuário na tabela usuarios usando auth_usuario_id
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('auth_usuario_id', user.id)
          .single();

        if (userError) throw userError;

        return { user: userData, error: null };
      }

      return { user: null, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  },

  async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async getCurrentUser(): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) throw error;

      if (user) {
        // Buscar dados adicionais do usuário na tabela usuarios usando auth_usuario_id
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('auth_usuario_id', user.id)
          .single();

        if (userError) throw userError;

        return { user: userData, error: null };
      }

      return { user: null, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  },

  async resetPassword(email: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }
}; 