// Utilitário para validação e formatação de CNPJ
export function validaCNPJ(cnpj: string): boolean {
  const b = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const c = String(cnpj).replace(/[^\d]/g, '')
  
  if (c.length !== 14) return false
  if (/0{14}/.test(c)) return false

  let n = 0
  for (let i = 0; i < 12; i++) {
    n += parseInt(c[i]) * b[i + 1]
  }
  if (c[12] !== (((n %= 11) < 2) ? '0' : String(11 - n))) return false

  n = 0
  for (let i = 0; i <= 12; i++) {
    n += parseInt(c[i]) * b[i]
  }
  if (c[13] !== (((n %= 11) < 2) ? '0' : String(11 - n))) return false

  return true
}

export function formatarCNPJ(cnpj: string): string {
  // Remove todos os caracteres não numéricos
  const numeros = cnpj.replace(/[^\d]/g, '')
  
  // Limita a 14 dígitos
  const cnpjLimitado = numeros.substring(0, 14)
  
  // Aplica a máscara: XX.XXX.XXX/XXXX-XX
  return cnpjLimitado.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  )
}

export function validateAndFormatCNPJ(value: string): {
  formatted: string
  isValid: boolean
  error: string
} {
  const numeros = value.replace(/[^\d]/g, '')
  const formatted = formatarCNPJ(numeros)
  
  // Se não tem 14 dígitos, ainda não está completo
  if (numeros.length < 14) {
    return {
      formatted,
      isValid: false,
      error: numeros.length > 0 ? 'CNPJ incompleto' : ''
    }
  }
  
  // Se tem 14 dígitos, valida
  const isValid = validaCNPJ(numeros)
  
  return {
    formatted,
    isValid,
    error: isValid ? '' : 'CNPJ inválido'
  }
}
