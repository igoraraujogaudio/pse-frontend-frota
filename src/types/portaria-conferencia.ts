export interface ConferenciaMaterialDTO {
  itemId: string;
  conferido: boolean;
  observacoes?: string;
}

export interface ConferirSaidaMaterialDTO {
  saidaMaterialId: string;
  usuarioPortariaId: string;
  veiculoPlaca: string;
  itens: ConferenciaMaterialDTO[];
  observacoesGerais?: string;
}

export interface SaidaMaterialPendente {
  id: string;
  equipeNome: string;
  responsavelNome: string;
  dataEntrega: string;
  totalItens: number;
  itens: Array<{
    id: string;
    numeroMaterial: string;
    descricaoMaterial: string;
    quantidade: number;
    unidadeMedida: string;
  }>;
}
