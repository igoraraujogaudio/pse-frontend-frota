/**
 * Utilitários para validação e formatação de CPF
 */

/**
 * Valida se um CPF é válido
 * @param cpf - CPF a ser validado (com ou sem formatação)
 * @returns true se o CPF for válido, false caso contrário
 */
export function validarCPF(cpf: string | null | undefined): boolean {
  // Verifica se CPF é válido (não null, undefined ou vazio)
  if (!cpf || typeof cpf !== 'string') {
    return false;
  }
  
  // Remove caracteres não numéricos
  cpf = cpf.replace(/\D/g, '');
  
  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Calcula o primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  const digito1 = resto === 10 || resto === 11 ? 0 : resto;
  
  // Verifica o primeiro dígito
  if (parseInt(cpf.charAt(9)) !== digito1) return false;
  
  // Calcula o segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  const digito2 = resto === 10 || resto === 11 ? 0 : resto;
  
  // Verifica o segundo dígito
  if (parseInt(cpf.charAt(10)) !== digito2) return false;
  
  return true;
}

/**
 * Formata um CPF adicionando pontos e hífen
 * @param cpf - CPF a ser formatado (apenas números)
 * @returns CPF formatado (xxx.xxx.xxx-xx)
 */
export function formatarCPF(cpf: string | null | undefined): string {
  // Verifica se CPF é válido
  if (!cpf || typeof cpf !== 'string') {
    return '';
  }
  
  // Remove caracteres não numéricos
  cpf = cpf.replace(/\D/g, '');
  
  // Aplica a formatação
  cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
  cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
  cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  
  return cpf;
}

/**
 * Remove a formatação do CPF, deixando apenas números
 * @param cpf - CPF formatado
 * @returns CPF apenas com números
 */
export function limparCPF(cpf: string | null | undefined): string {
  if (!cpf || typeof cpf !== 'string') {
    return '';
  }
  return cpf.replace(/\D/g, '');
}

/**
 * Processa CPF vindos do Excel, garantindo que zeros à esquerda sejam preservados
 * @param cpf - CPF a ser processado (pode vir do Excel sem zeros à esquerda)
 * @returns CPF com 11 dígitos, com zeros à esquerda quando necessário
 */
export function processarCPFExcel(cpf: string | null | undefined): string {
  if (!cpf || typeof cpf !== 'string') {
    return '';
  }
  
  // Remove formatação
  const cpfNumeros = limparCPF(cpf);
  
  // Garante que o CPF tenha exatamente 11 dígitos
  if (cpfNumeros.length === 11) {
    return cpfNumeros;
  } else if (cpfNumeros.length < 11) {
    // Adiciona zeros à esquerda se o CPF tiver menos de 11 dígitos
    return cpfNumeros.padStart(11, '0');
  } else {
    // Se tiver mais de 11 dígitos, mantém apenas os primeiros 11
    return cpfNumeros.substring(0, 11);
  }
}

/**
 * Valida se um CPF processado do Excel é válido
 * @param cpf - CPF a ser validado (deve ter 11 dígitos)
 * @returns true se o CPF for válido, false caso contrário
 */
export function validarCPFExcel(cpf: string): boolean {
  // Primeiro processa o CPF para garantir que tenha 11 dígitos
  const cpfProcessado = processarCPFExcel(cpf);
  
  // Depois valida usando a função existente
  return validarCPF(cpfProcessado);
}