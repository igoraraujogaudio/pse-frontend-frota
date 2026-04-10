'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { memo } from 'react';

interface MovimentacaoVeiculo {
  id: string;
  tipo: string;
  data_movimentacao: string;
  quilometragem?: number;
  observacoes?: string;
  tipo_veiculo?: string;
  veiculo_id?: string;
  carro_particular_id?: string;
  base?: {
    nome: string;
    codigo: string;
  };
  veiculo?: {
    placa: string;
    modelo: string;
    marca_equipamento: string;
    tipo_veiculo: string;
  };
  carro_particular?: {
    placa: string;
    funcionario?: {
      nome: string;
      matricula: string;
    };
  };
  colaborador?: {
    nome: string;
    matricula: string;
  };
}

interface MovimentacaoChave {
  id: string;
  tipo: string;
  data_movimentacao: string;
  observacoes?: string;
  status?: string;
  colaborador?: {
    nome: string;
    matricula: string;
  };
  chave?: {
    codigo: string;
    veiculo?: {
      placa: string;
      base?: {
        nome: string;
        codigo: string;
      };
    };
  };
}

interface VeiculosTableProps {
  data: MovimentacaoVeiculo[];
}

interface ChavesTableProps {
  data: MovimentacaoChave[];
}

const getTipoBadgeColor = (tipo: string) => {
  switch (tipo) {
    case 'entrada':
      return 'bg-green-100 text-green-800';
    case 'saida':
      return 'bg-blue-100 text-blue-800';
    case 'retirada':
      return 'bg-orange-100 text-orange-800';
    case 'entrega':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getTipoLabel = (tipo: string) => {
  switch (tipo) {
    case 'entrada':
      return 'Entrada';
    case 'saida':
      return 'Saída';
    case 'retirada':
      return 'Retirada';
    case 'entrega':
      return 'Entrega';
    default:
      return tipo;
  }
};

export const VeiculosTable = memo(({ data }: VeiculosTableProps) => {
  const getVeiculoInfo = (mov: MovimentacaoVeiculo) => {
    if (mov.tipo_veiculo === 'frota' && mov.veiculo) {
      return {
        placa: mov.veiculo.placa,
        modelo: `${mov.veiculo.marca_equipamento} ${mov.veiculo.modelo}`,
        tipo: mov.veiculo.tipo_veiculo || 'Frota',
        isParticular: false
      };
    } else if (mov.carro_particular) {
      return {
        placa: mov.carro_particular.placa,
        modelo: `${mov.carro_particular.funcionario?.nome || 'N/A'} (${mov.carro_particular.funcionario?.matricula || 'N/A'})`,
        tipo: 'Particular',
        isParticular: true
      };
    } else if (mov.carro_particular_id) {
      return {
        placa: 'N/A',
        modelo: 'Carro Particular',
        tipo: 'Particular',
        isParticular: true
      };
    } else if (mov.veiculo_id) {
      return {
        placa: 'N/A',
        modelo: 'Veículo da Frota',
        tipo: 'Frota',
        isParticular: false
      };
    } else {
      return {
        placa: 'N/A',
        modelo: 'N/A',
        tipo: mov.tipo_veiculo === 'frota' ? 'Frota' : 'Particular',
        isParticular: mov.tipo_veiculo === 'particular'
      };
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhuma movimentação de veículo encontrada
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Data/Hora</TableHead>
            <TableHead className="w-[100px]">Tipo</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Base</TableHead>
            <TableHead>Motorista</TableHead>
            <TableHead className="w-[120px]">KM</TableHead>
            <TableHead>Observações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((mov) => {
            const veiculoInfo = getVeiculoInfo(mov);
            return (
              <TableRow key={mov.id}>
                <TableCell className="text-sm">
                  {format(new Date(mov.data_movimentacao), 'dd/MM/yy HH:mm', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <Badge className={getTipoBadgeColor(mov.tipo)}>
                    {getTipoLabel(mov.tipo)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{veiculoInfo.placa}</div>
                    <div className="text-sm text-gray-500">{veiculoInfo.modelo}</div>
                    {veiculoInfo.isParticular ? (
                      <Badge className="bg-purple-100 text-purple-800 text-xs mt-1">
                        PARTICULAR
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs mt-1">
                        {veiculoInfo.tipo}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{mov.base?.nome || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{mov.base?.codigo || ''}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{mov.colaborador?.nome || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{mov.colaborador?.matricula || 'N/A'}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {mov.quilometragem ? (
                    <span className="font-medium">{mov.quilometragem.toLocaleString('pt-BR')} km</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">{mov.observacoes || '-'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});

VeiculosTable.displayName = 'VeiculosTable';

export const ChavesTable = memo(({ data }: ChavesTableProps) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhuma movimentação de chave encontrada
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Data/Hora</TableHead>
            <TableHead className="w-[100px]">Tipo</TableHead>
            <TableHead>Chave</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Base</TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead>Observações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((mov) => (
            <TableRow key={mov.id}>
              <TableCell className="text-sm">
                {format(new Date(mov.data_movimentacao), 'dd/MM/yy HH:mm', { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Badge className={getTipoBadgeColor(mov.tipo)}>
                  {getTipoLabel(mov.tipo)}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">ID: {mov.chave?.codigo || 'N/A'}</TableCell>
              <TableCell>
                <div className="font-medium">{mov.chave?.veiculo?.placa || 'N/A'}</div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{mov.chave?.veiculo?.base?.nome || 'N/A'}</div>
                  <div className="text-sm text-gray-500">{mov.chave?.veiculo?.base?.codigo || ''}</div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{mov.colaborador?.nome || 'N/A'}</div>
                  <div className="text-sm text-gray-500">{mov.colaborador?.matricula || 'N/A'}</div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={mov.status === 'ativa' ? 'default' : 'secondary'}>
                  {mov.status === 'ativa' ? 'Ativa' : 'Finalizada'}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">{mov.observacoes || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

ChavesTable.displayName = 'ChavesTable';
