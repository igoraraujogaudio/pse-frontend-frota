import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Remove acentos e converte para maiúsculas
 * Mantém caracteres especiais como Ç, mas remove acentos (á, é, í, ó, ú, ã, õ, etc.)
 * Aplica automaticamente em todos os campos de digitação
 */
export function normalizeText(text: string): string {
  if (!text) return text
  
  // Mapa de caracteres acentuados para seus equivalentes sem acento
  const accentsMap: { [key: string]: string } = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
    'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
    'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U'
    // Ç e ç são mantidos (não estão no mapa)
  }
  
  // Substituir acentos, mas manter Ç, ç e outros caracteres especiais
  let result = text
  for (const [accented, plain] of Object.entries(accentsMap)) {
    result = result.replace(new RegExp(accented, 'g'), plain)
  }
  
  // Converter para maiúsculas (Ç vira Ç, ç vira Ç)
  return result.toUpperCase()
}