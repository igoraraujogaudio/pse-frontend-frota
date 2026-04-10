/**
 * Utilitários para manipulação de datas do Excel
 */

/**
 * Converte uma data do Excel (número serial) para uma data JavaScript
 * @param excelDate - Número serial da data do Excel
 * @returns Data JavaScript
 */
export function excelDateToJSDate(excelDate: number): Date {
  // Excel conta dias desde 1899-12-30 (época correta do Excel)
  const excelEpoch = new Date(1899, 11, 30);
  const jsDate = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
  return jsDate;
}

/**
 * Converte uma data JavaScript para número serial do Excel
 * @param jsDate - Data JavaScript
 * @returns Número serial da data do Excel
 */
export function jsDateToExcelDate(jsDate: Date): number {
  const excelEpoch = new Date(1899, 11, 30);
  const diffTime = jsDate.getTime() - excelEpoch.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Formata uma data do Excel para string no formato brasileiro
 * @param excelDate - Número serial da data do Excel
 * @returns String formatada (DD/MM/YYYY)
 */
export function formatExcelDate(excelDate: number): string {
  const jsDate = excelDateToJSDate(excelDate);
  return jsDate.toLocaleDateString('pt-BR');
}

/**
 * Valida se um valor é uma data válida do Excel
 * @param value - Valor a ser validado
 * @returns true se for uma data válida do Excel
 */
export function isValidExcelDate(value: unknown): boolean {
  if (typeof value !== 'number') return false;
  if (value < 1 || value > 2958465) return false; // Limites do Excel
  try {
    const date = excelDateToJSDate(value);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Analisa uma data do Excel e retorna informações de debug
 * @param excelDate - Número serial da data do Excel
 * @returns Objeto com informações de debug
 */
export function debugExcelDate(excelDate: number): {
  original: number;
  jsDate: Date;
  formatted: string;
  isValid: boolean;
} {
  const jsDate = excelDateToJSDate(excelDate);
  return {
    original: excelDate,
    jsDate,
    formatted: formatExcelDate(excelDate),
    isValid: isValidExcelDate(excelDate)
  };
}

/**
 * Analisa uma data do Excel e retorna uma data JavaScript ou null
 * @param excelDate - Número serial da data do Excel
 * @returns Data JavaScript ou null se inválida
 */
export function parseExcelDate(excelDate: number): Date | null {
  if (!isValidExcelDate(excelDate)) return null;
  
  const jsDate = excelDateToJSDate(excelDate);
  
  // Valida se o ano está em um range válido (1800-2100)
  const year = jsDate.getFullYear();
  if (year < 1800 || year > 2100) {
    return null;
  }
  
  return jsDate;
}