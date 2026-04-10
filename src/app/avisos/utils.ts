// Funções auxiliares para a página de avisos
export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pendente':
      return 'ClockIcon';
    case 'assinado':
      return 'CheckCircleIcon';
    case 'recusado':
      return 'XCircleIcon';
    default:
      return 'ClockIcon';
  }
};

export const getTipoAvisoIcon = (tipo: string) => {
  switch (tipo) {
    case 'advertencia':
      return 'ExclamationTriangleIcon';
    case 'suspensao':
      return 'ClockIcon';
    case 'falta_grave':
      return 'XCircleIcon';
    default:
      return 'ExclamationTriangleIcon';
  }
};

export const getTipoAvisoColor = (tipo: string) => {
  switch (tipo) {
    case 'advertencia':
      return 'bg-yellow-100 text-yellow-800';
    case 'suspensao':
      return 'bg-orange-100 text-orange-800';
    case 'falta_grave':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'pendente':
      return 'bg-yellow-100 text-yellow-800';
    case 'assinado':
      return 'bg-green-100 text-green-800';
    case 'recusado':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const calculateDataFimSuspensao = (dataInicio: string, periodo: number) => {
  if (!dataInicio || !periodo) return '';
  
  const inicio = new Date(dataInicio);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + periodo);
  
  return fim.toISOString().split('T')[0];
};
