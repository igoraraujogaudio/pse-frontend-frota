// =============================================
// Constantes para Unidades de Medida
// =============================================

export const UNIDADES_MEDIDA = [
  { label: 'Unidade', value: 'UN' },
  { label: 'Peça', value: 'PÇ' },
  { label: 'Metro', value: 'M' },
  { label: 'Centímetro', value: 'CM' },
  { label: 'Milímetro', value: 'MM' },
  { label: 'Quilograma', value: 'KG' },
  { label: 'Gramas', value: 'G' },
  { label: 'Litro', value: 'L' },
  { label: 'Mililitro', value: 'ML' },
  { label: 'Caixa', value: 'CX' },
  { label: 'Pacote', value: 'PCT' },
  { label: 'Par', value: 'PAR' },
  { label: 'Conjunto', value: 'CONJ' },
  { label: 'Kit', value: 'KIT' },
  { label: 'Rolo', value: 'ROL' },
  { label: 'Folha', value: 'FOL' },
  { label: 'Tubo', value: 'TUB' },
  { label: 'Galão', value: 'GAL' },
  { label: 'Tonelada', value: 'T' },
  { label: 'Hora', value: 'H' },
  { label: 'Dia', value: 'D' },
  { label: 'Mês', value: 'MES' },
  { label: 'Ano', value: 'ANO' }
] as const

export type UnidadeMedida = typeof UNIDADES_MEDIDA[number]['value']

// Função para obter o label de uma unidade de medida
export const getUnidadeMedidaLabel = (value: string): string => {
  const unidade = UNIDADES_MEDIDA.find(u => u.value === value)
  return unidade?.label || value
}

// Função para validar se uma unidade de medida é válida
export const isValidUnidadeMedida = (value: string): boolean => {
  return UNIDADES_MEDIDA.some(u => u.value === value)
}
