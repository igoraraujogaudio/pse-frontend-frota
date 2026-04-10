export function formatDate(dateString: string): string {
  if (!dateString) return 'Não informado';
  
  try {
    const date = new Date(dateString);
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return 'Data inválida';
  }
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return 'Não informado';
  
  try {
    const date = new Date(dateString);
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }
    
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Data inválida';
  }
}

export function formatDateISO(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export function getDaysUntilExpiration(expirationDate: string): number | null {
  if (!expirationDate) return null;
  
  try {
    const expiration = new Date(expirationDate);
    const today = new Date();
    
    // Zerar as horas para comparar apenas as datas
    today.setHours(0, 0, 0, 0);
    expiration.setHours(0, 0, 0, 0);
    
    const diffTime = expiration.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch {
    return null;
  }
}

export function isExpired(expirationDate: string): boolean {
  const days = getDaysUntilExpiration(expirationDate);
  return days !== null && days < 0;
}

export function isExpiringSoon(expirationDate: string, daysThreshold: number = 30): boolean {
  const days = getDaysUntilExpiration(expirationDate);
  return days !== null && days >= 0 && days <= daysThreshold;
}

