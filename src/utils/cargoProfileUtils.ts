import type { Cargo, CargoComPerfil } from '@/types/cargos';
import type { PerfilAcesso } from '@/types/permissions';

/**
 * Filtra cargos por nome do cargo ou nome do perfil vinculado (case-insensitive).
 */
export function filterCargos(
  cargos: CargoComPerfil[],
  searchTerm: string
): CargoComPerfil[] {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return cargos;

  return cargos.filter((cargo) => {
    const nomeMatch = cargo.nome.toLowerCase().includes(term);
    const perfilMatch = cargo.perfil?.nome?.toLowerCase().includes(term) ?? false;
    return nomeMatch || perfilMatch;
  });
}

/**
 * Retorna contagens de cargos: total, com perfil vinculado e sem perfil vinculado.
 */
export function getCargoSummary(cargos: CargoComPerfil[]): {
  total: number;
  comPerfil: number;
  semPerfil: number;
} {
  const total = cargos.length;
  const comPerfil = cargos.filter((c) => c.perfil_acesso_id != null).length;
  const semPerfil = total - comPerfil;

  return { total, comPerfil, semPerfil };
}

/**
 * Combina cargos com seus perfis de acesso vinculados.
 */
export function enrichCargosWithPerfis(
  cargos: Cargo[],
  perfis: PerfilAcesso[]
): CargoComPerfil[] {
  const perfisMap = new Map(perfis.map((p) => [p.id, p]));

  return cargos.map((cargo) => ({
    ...cargo,
    perfil: cargo.perfil_acesso_id
      ? perfisMap.get(cargo.perfil_acesso_id)
      : undefined,
  }));
}
