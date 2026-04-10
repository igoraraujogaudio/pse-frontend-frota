'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KeyIcon, CarIcon, ClockIcon, UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface MovimentacaoChave {
  id: string;
  tipo: 'retirada' | 'entrega';
  data_movimentacao: string;
  colaborador: { nome: string; matricula: string };
  chave: { codigo: string; veiculo: { placa: string; modelo: string } };
  observacoes?: string;
}

interface MovimentacaoVeiculo {
  id: string;
  tipo: 'entrada' | 'saida';
  data_movimentacao: string;
  quilometragem: number;
  tipo_veiculo?: 'frota' | 'particular';
  veiculo?: { placa: string; modelo: string };
  carro_particular?: { 
    placa: string; 
    funcionario?: { nome: string; matricula: string } 
  };
  observacoes?: string;
}

export default function RelatorioPortaria() {
  const [movimentacaoChaves, setMovimentacaoChaves] = useState<MovimentacaoChave[]>([]);
  const [movimentacaoVeiculos, setMovimentacaoVeiculos] = useState<MovimentacaoVeiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const { userContratoIds } = useAuth();

  const carregarMovimentacoes = useCallback(async () => {
    try {
      // Construir URL com filtros de contrato para veículos
      const veiculosUrl = userContratoIds && userContratoIds.length > 0 
        ? `/api/portaria/relatorio/veiculos?contratoIds=${userContratoIds.join(',')}`
        : '/api/portaria/relatorio/veiculos';

      const [chavesRes, veiculosRes] = await Promise.all([
        fetch('/api/portaria/relatorio/chaves'),
        fetch(veiculosUrl)
      ]);

      const chaves = await chavesRes.json();
      const veiculos = await veiculosRes.json();

      console.log('📊 [RELATÓRIO] Resposta da API de chaves:', chaves);
      console.log('📊 [RELATÓRIO] Resposta da API de veículos:', veiculos);
      console.log('📊 [RELATÓRIO] Chaves encontradas:', chaves.data?.length || 0);
      console.log('📊 [RELATÓRIO] Veículos encontrados:', veiculos.data?.length || 0);

      setMovimentacaoChaves(chaves.data || []);
      setMovimentacaoVeiculos(veiculos.data || []);
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
    } finally {
      setLoading(false);
    }
  }, [userContratoIds]);

  useEffect(() => {
    carregarMovimentacoes();
  }, [carregarMovimentacoes]);

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const getTipoChaveBadge = (tipo: string) => {
    return tipo === 'retirada' 
      ? <Badge className="bg-blue-100 text-blue-800">Retirada</Badge>
      : <Badge className="bg-green-100 text-green-800">Entrega</Badge>;
  };

  const getTipoVeiculoBadge = (tipo: string) => {
    return tipo === 'saida' 
      ? <Badge className="bg-orange-100 text-orange-800">Saída</Badge>
      : <Badge className="bg-green-100 text-green-800">Entrada</Badge>;
  };

  const getVeiculoInfo = (movimentacao: MovimentacaoVeiculo) => {
    if (movimentacao.tipo_veiculo === 'particular' && movimentacao.carro_particular) {
      return {
        placa: movimentacao.carro_particular.placa,
        modelo: movimentacao.carro_particular.funcionario?.nome || 'N/A',
        isParticular: true
      };
    } else if (movimentacao.veiculo) {
      return {
        placa: movimentacao.veiculo.placa,
        modelo: movimentacao.veiculo.modelo,
        isParticular: false
      };
    } else {
      return {
        placa: 'N/A',
        modelo: 'N/A',
        isParticular: false
      };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <ClockIcon className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Carregando movimentações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Movimentações do Dia</h2>
        <Button onClick={carregarMovimentacoes} variant="outline">
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movimentações de Chaves */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5" />
              Controle de Chaves
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movimentacaoChaves.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Nenhuma movimentação de chave hoje
              </p>
            ) : (
              <div className="space-y-3">
                {movimentacaoChaves.slice(0, 10).map((mov) => (
                  <div key={mov.id} className="border-l-4 border-blue-200 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">
                        {mov.chave.veiculo.placa} - {mov.chave.veiculo.modelo}
                      </span>
                      {getTipoChaveBadge(mov.tipo)}
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {mov.colaborador.nome} ({mov.colaborador.matricula})
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <ClockIcon className="h-3 w-3" />
                        {formatarData(mov.data_movimentacao)}
                      </div>
                      {mov.observacoes && (
                        <p className="mt-1 text-xs italic">{mov.observacoes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Movimentações de Veículos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CarIcon className="h-5 w-5" />
              Entrada/Saída Veículos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movimentacaoVeiculos.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Nenhuma movimentação de veículo hoje
              </p>
            ) : (
              <div className="space-y-3">
                {movimentacaoVeiculos.slice(0, 10).map((mov) => {
                  const veiculoInfo = getVeiculoInfo(mov);
                  return (
                    <div key={mov.id} className="border-l-4 border-orange-200 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {veiculoInfo.placa} - {veiculoInfo.modelo}
                          </span>
                          {veiculoInfo.isParticular && (
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              CARRO PARTICULAR
                            </Badge>
                          )}
                        </div>
                        {getTipoVeiculoBadge(mov.tipo)}
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>
                          Quilometragem: {mov.quilometragem.toLocaleString()} km
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <ClockIcon className="h-3 w-3" />
                          {formatarData(mov.data_movimentacao)}
                        </div>
                        {mov.observacoes && (
                          <p className="mt-1 text-xs italic">{mov.observacoes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}