export type Vehicle = {
  id: number;
  placa: string;
  ano_fabricacao: number;
  ano_modelo: number;
  renavam: string;
  chassis: string;
  numero_crlv: string;
  operacao_combustivel: string;
  modelo: string;
  tipo_modelo: string;
  versao: string;
  tipo_veiculo: string;
  marca_equipamento: string;
  valor_aluguel: number | null;
  tipo_combustivel: string;
  equipamentos: Record<string, unknown>;
  rastreador: string | null;
  propriedade: string;
  condicao: string;
  status: string;
  contrato_id: string | null; // Nova estrutura - região de acesso
  base_id: string | null; // Nova estrutura - localização física
  supervisor_id: number | null;
  ultima_manutencao: string | null;
  proxima_manutencao: string | null;
  quilometragem_atual: number;
  quilometragem_preventiva: number | null;
  intervalo_preventiva: number;
  proxima_preventiva_km: number | null;
  alerta_preventiva_km: number;
  criado_em: string;
  atualizado_em: string;
  prefixo_fixo: string; // Prefixo fixo do veículo (não pode ser alterado pelo funcionário)
  equipe_id: string | null; // ID da equipe alocada ao veículo (UUID)
  contrato?: {
    id: string;
    nome: string;
    codigo: string;
  };
  base?: {
    id: string;
    nome: string;
    codigo: string;
  };
}; 