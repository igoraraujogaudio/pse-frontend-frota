/**
 * Converte string de valor monetário brasileiro (com vírgula) para número
 * @param value - String do valor (ex: "10,50" ou "10.50")
 * @returns Número convertido
 */
export function parseBrazilianCurrency(value: string): number {
  if (!value || value.trim() === '') return 0
  
  // Remove espaços e caracteres não numéricos exceto vírgula e ponto
  const cleanValue = value.replace(/[^\d,.-]/g, '')
  
  // Se tem vírgula, assume formato brasileiro (vírgula como separador decimal)
  if (cleanValue.includes(',')) {
    // Remove pontos (separadores de milhares) e substitui vírgula por ponto
    return parseFloat(cleanValue.replace(/\./g, '').replace(',', '.'))
  }
  
  // Se não tem vírgula, usa parseFloat normal
  return parseFloat(cleanValue) || 0
}

/**
 * Formata número para string monetária brasileira
 * @param value - Número a ser formatado
 * @returns String formatada (ex: "10,50")
 */
export function formatBrazilianCurrency(value: number): string {
  if (isNaN(value)) return '0,00'
  
  return value.toFixed(2).replace('.', ',')
}

/**
 * Valida se o valor monetário é válido
 * @param value - String do valor
 * @returns true se válido, false caso contrário
 */
export function isValidCurrency(value: string): boolean {
  if (!value || value.trim() === '') return true // Campo vazio é válido
  
  const parsed = parseBrazilianCurrency(value)
  return !isNaN(parsed) && parsed >= 0
}
