/**
 * Utilitário para geração de senhas seguras
 */

export interface PasswordOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  excludeSimilar?: boolean; // Exclui caracteres similares (0, O, l, I, etc.)
  excludeAmbiguous?: boolean; // Exclui caracteres ambíguos ({, }, [, ], (, ), /, \, ', ", `, ~, ,, ., <, >)
}

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/**
 * Gera uma senha aleatória baseada nas opções fornecidas
 */
export function generatePassword(options: PasswordOptions = {}): string {
  const {
    length = 12,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = false,
    excludeSimilar = true,
    excludeAmbiguous = true,
  } = options;

  let charset = '';
  let requiredChars = '';

  // Construir charset baseado nas opções
  if (includeUppercase) {
    let upperChars = UPPERCASE;
    if (excludeSimilar) upperChars = upperChars.replace(/[O]/g, '');
    if (excludeAmbiguous) upperChars = upperChars.replace(/[{}[\]()\/\\'"`,.<>]/g, '');
    charset += upperChars;
    requiredChars += upperChars[Math.floor(Math.random() * upperChars.length)];
  }

  if (includeLowercase) {
    let lowerChars = LOWERCASE;
    if (excludeSimilar) lowerChars = lowerChars.replace(/[l]/g, '');
    if (excludeAmbiguous) lowerChars = lowerChars.replace(/[{}[\]()\/\\'"`,.<>]/g, '');
    charset += lowerChars;
    requiredChars += lowerChars[Math.floor(Math.random() * lowerChars.length)];
  }

  if (includeNumbers) {
    let numberChars = NUMBERS;
    if (excludeSimilar) numberChars = numberChars.replace(/[01]/g, '');
    charset += numberChars;
    requiredChars += numberChars[Math.floor(Math.random() * numberChars.length)];
  }

  if (includeSymbols) {
    let symbolChars = SYMBOLS;
    if (excludeSimilar) symbolChars = symbolChars.replace(/[|`]/g, '');
    if (excludeAmbiguous) symbolChars = symbolChars.replace(/[{}[\]()\/\\'"`,.<>]/g, '');
    charset += symbolChars;
    requiredChars += symbolChars[Math.floor(Math.random() * symbolChars.length)];
  }

  if (charset === '') {
    throw new Error('Pelo menos um tipo de caractere deve ser incluído');
  }

  // Gerar caracteres restantes
  let password = requiredChars;
  for (let i = requiredChars.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Embaralhar a senha para que os caracteres obrigatórios não fiquem no início
  return shuffleString(password);
}

/**
 * Embaralha uma string aleatoriamente
 */
function shuffleString(str: string): string {
  return str
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Avalia a força de uma senha
 */
export function evaluatePasswordStrength(password: string): {
  score: number; // 0-4
  level: 'muito_fraca' | 'fraca' | 'media' | 'forte' | 'muito_forte';
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Critérios básicos
  if (password.length >= 8) score++;
  else feedback.push('Use pelo menos 8 caracteres');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Inclua letras minúsculas');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Inclua letras maiúsculas');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('Inclua números');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('Inclua símbolos');

  // Critérios adicionais
  if (password.length >= 12) score += 0.5;
  if (password.length >= 16) score += 0.5;

  // Penalidades
  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('Evite caracteres repetidos consecutivos');
  }

  // Determinar nível
  const finalScore = Math.max(0, Math.min(4, Math.floor(score)));
  let level: 'muito_fraca' | 'fraca' | 'media' | 'forte' | 'muito_forte';

  switch (finalScore) {
    case 0:
    case 1:
      level = 'muito_fraca';
      break;
    case 2:
      level = 'fraca';
      break;
    case 3:
      level = 'media';
      break;
    case 4:
      level = 'forte';
      break;
    default:
      level = 'muito_forte';
  }

  return { score: finalScore, level, feedback };
}

/**
 * Senhas padrão pré-definidas para diferentes cenários
 */
export const PRESET_PASSWORDS = {
  simple: {
    name: 'Simples',
    description: 'Senha simples com letras e números',
    options: {
      length: 8,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
    }
  },
  medium: {
    name: 'Média',
    description: 'Senha média com letras, números e alguns símbolos',
    options: {
      length: 10,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
    }
  },
  strong: {
    name: 'Forte',
    description: 'Senha forte com todos os tipos de caracteres',
    options: {
      length: 14,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
    }
  },
  corporate: {
    name: 'Corporativa',
    description: 'Senha adequada para ambiente corporativo',
    options: {
      length: 12,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: true,
      excludeAmbiguous: true,
    }
  },
  temporary: {
    name: 'Temporária',
    description: 'Senha temporária fácil de digitar',
    options: {
      length: 8,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
      excludeSimilar: true,
      excludeAmbiguous: true,
    }
  }
};

/**
 * Gera múltiplas senhas de uma vez
 */
export function generateMultiplePasswords(count: number, options: PasswordOptions = {}): string[] {
  const passwords: string[] = [];
  const maxAttempts = count * 10; // Evita loop infinito
  let attempts = 0;

  while (passwords.length < count && attempts < maxAttempts) {
    const password = generatePassword(options);
    
    // Evita senhas duplicadas
    if (!passwords.includes(password)) {
      passwords.push(password);
    }
    
    attempts++;
  }

  return passwords;
}

/**
 * Gera uma senha pronunciável (mais fácil de lembrar)
 */
export function generatePronounceablePassword(length: number = 10): string {
  const consonants = 'bcdfghjklmnpqrstvwxyz';
  const vowels = 'aeiou';
  const numbers = '23456789'; // Exclui 0 e 1 que podem ser confusos
  
  let password = '';
  
  for (let i = 0; i < length; i++) {
    if (i % 4 === 3) {
      // A cada 4 caracteres, adiciona um número
      password += numbers[Math.floor(Math.random() * numbers.length)];
    } else if (i % 2 === 0) {
      // Posições pares: consoantes
      const char = consonants[Math.floor(Math.random() * consonants.length)];
      password += Math.random() > 0.5 ? char.toUpperCase() : char;
    } else {
      // Posições ímpares: vogais
      password += vowels[Math.floor(Math.random() * vowels.length)];
    }
  }
  
  return password;
}
