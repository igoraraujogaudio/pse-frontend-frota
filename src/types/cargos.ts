import type { PerfilAcesso } from '@/types/permissions';

export interface Cargo {
  id: string;
  nome: string;
  nivel_acesso: string;
  perfil_acesso_id?: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface CargoComPerfil extends Cargo {
  perfil?: PerfilAcesso;
}
