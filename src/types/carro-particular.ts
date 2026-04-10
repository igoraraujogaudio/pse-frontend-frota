// =============================
// TIPOS PARA SISTEMA DE CARROS PARTICULARES
// =============================

export interface CarroParticular {
  id: string;
  funcionario_id: string;
  placa: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  
  // Dados relacionados
  funcionario?: {
    id: string;
    nome: string;
    matricula: string;
    email: string;
  };
}

export interface CarroParticularForm {
  placa: string;
  funcionario_id?: string;
}

export interface MovimentacaoCarroParticular {
  id: string;
  carro_particular_id: string;
  funcionario_id: string;
  tipo: 'entrada' | 'saida';
  data_movimentacao: string;
  observacoes?: string;
  base_id?: string;
  contrato_id?: string;
  
  // Dados relacionados
  carro_particular?: CarroParticular;
  funcionario?: {
    id: string;
    nome: string;
    matricula: string;
  };
}

// Tipo unificado para busca por QR code
export interface VeiculoUnificado {
  id: string;
  placa: string;
  tipo: 'frota' | 'particular';
  proxima_acao: 'entrada' | 'saida';
  
  // Dados específicos da frota
  modelo?: string;
  marca_equipamento?: string;
  quilometragem_atual?: number;
  
  // Dados específicos de carro particular
  funcionario_nome?: string;
  funcionario_matricula?: string;
}

// Formato de QR Code para carros particulares
export interface QRCodeCarroParticular {
  formato: 'PRIVATE:PLACA:ID';
  placa: string;
  id: string;
  data: string; // URL do QR code gerado
}

// Resposta da API de busca unificada
export interface BuscaVeiculoResponse {
  veiculo: VeiculoUnificado;
  alertas?: Array<{
    tipo: string;
    descricao: string;
    nivel: 'info' | 'warning' | 'error';
  }>;
}

// Dados para registrar movimentação
export interface DadosMovimentacao {
  veiculo_id?: string; // Para veículos da frota
  carro_particular_id?: string; // Para carros particulares
  colaborador_id: string;
  acao: 'entrada' | 'saida';
  quilometragem?: number; // Opcional para carros particulares
  observacoes?: string;
  base_id?: string;
  contrato_id?: string;
}

// Estatísticas para dashboard
export interface EstatisticasCarrosParticulares {
  total_carros: number;
  carros_ativos: number;
  movimentacoes_hoje: number;
  funcionarios_com_carro: number;
}

// Filtros para listagem
export interface FiltrosCarrosParticulares {
  funcionario_id?: string;
  placa?: string;
  ativo?: boolean;
  data_inicio?: string;
  data_fim?: string;
}

// Resposta da API de listagem
export interface ListaCarrosParticularesResponse {
  carros: CarroParticular[];
  total: number;
  pagina: number;
  limite: number;
}
