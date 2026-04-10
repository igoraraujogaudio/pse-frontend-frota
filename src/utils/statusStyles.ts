export function getSolicitacaoStatusClass(
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'entregue' | 'parcialmente_aprovada' | 'cancelada' | 'aguardando_estoque'
): string {
  switch (status) {
    case 'pendente':
      return 'bg-amber-500 text-white border-transparent'
    case 'aprovada':
      return 'bg-emerald-600 text-white border-transparent'
    case 'rejeitada':
      return 'bg-red-600 text-white border-transparent'
    case 'entregue':
      return 'bg-sky-600 text-white border-transparent'
    case 'parcialmente_aprovada':
      return 'bg-violet-600 text-white border-transparent'
    case 'cancelada':
      return 'bg-slate-500 text-white border-transparent'
    case 'aguardando_estoque':
      return 'bg-orange-600 text-white border-transparent'
    default:
      return 'bg-slate-800 text-white border-transparent'
  }
}

export function getHistoricoStatusClass(
  status: 'liberado' | 'rejeitado'
): string {
  switch (status) {
    case 'liberado':
      return 'bg-emerald-600 text-white border-transparent'
    case 'rejeitado':
      return 'bg-red-600 text-white border-transparent'
    default:
      return 'bg-slate-800 text-white border-transparent'
  }
}

export function getEstoqueStatusClass(
  status: 'normal' | 'baixo' | 'critico' | 'zerado'
): string {
  switch (status) {
    case 'normal':
      return 'bg-emerald-600 text-white border-transparent'
    case 'baixo':
      return 'bg-amber-500 text-white border-transparent'
    case 'critico':
      return 'bg-red-600 text-white border-transparent'
    case 'zerado':
      return 'bg-slate-700 text-white border-transparent'
    default:
      return 'bg-slate-800 text-white border-transparent'
  }
}


