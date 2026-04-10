'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, UserIcon, PhoneIcon, EnvelopeIcon, BuildingOfficeIcon, IdentificationIcon } from '@heroicons/react/24/outline';
import { formatDate } from '@/utils/dateUtils';
import { FuncionarioCompleto } from '@/types';

interface FuncionarioDetailModalProps {
  funcionarioId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FuncionarioDetailModal({ funcionarioId, isOpen, onClose }: FuncionarioDetailModalProps) {
  const [funcionario, setFuncionario] = useState<FuncionarioCompleto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFuncionarioDetails = useCallback(async () => {
    if (!funcionarioId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${funcionarioId}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do funcionário');
      }

      const data = await response.json();
      setFuncionario(data.funcionario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [funcionarioId]);

  useEffect(() => {
    if (funcionarioId && isOpen) {
      fetchFuncionarioDetails();
    }
  }, [funcionarioId, isOpen, fetchFuncionarioDetails]);

  const getStatusBadge = (status: string) => {
    const variants = {
      'VIGENTE': 'default',
      'VENCENDO': 'secondary',
      'VENCIDO': 'destructive',
      'VENCIDA': 'destructive',
      'SEM_CNH': 'outline',
      'SEM_ASO': 'outline',
      'SEM_HAR': 'outline'
    } as const;

    const labels = {
      'VIGENTE': 'Vigente',
      'VENCENDO': 'Vencendo',
      'VENCIDO': 'Vencido',
      'VENCIDA': 'Vencida',
      'SEM_CNH': 'Sem CNH',
      'SEM_ASO': 'Sem ASO',
      'SEM_HAR': 'Sem HAR'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Detalhes do Funcionário
          </DialogTitle>
          <DialogDescription>
            Informações completas do funcionário incluindo documentos e vencimentos
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {funcionario && !loading && (
          <div className="space-y-6">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nome Completo</label>
                    <p className="text-lg font-semibold">{funcionario.nome}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Matrícula</label>
                    <p className="text-lg">{funcionario.matricula}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">CPF</label>
                    <p className="text-lg">{funcionario.cpf ? formatCPF(funcionario.cpf) : 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Data de Nascimento</label>
                    <p className="text-lg">{funcionario.data_nascimento ? formatDate(funcionario.data_nascimento) : 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">
                      <Badge variant={
                        funcionario.status === 'ativo' ? 'default' : 
                        funcionario.status === 'suspenso' ? 'secondary' : 'secondary'
                      }>
                        {funcionario.status === 'ativo' ? 'Ativo' : 
                         funcionario.status === 'suspenso' ? 'Suspenso' : funcionario.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nível de Acesso</label>
                    <p className="text-lg">{funcionario.nivel_acesso}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informações de Contato */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PhoneIcon className="h-5 w-5" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-lg flex items-center gap-2">
                      <EnvelopeIcon className="h-4 w-4" />
                      {funcionario.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Telefone Pessoal</label>
                    <p className="text-lg flex items-center gap-2">
                      <PhoneIcon className="h-4 w-4" />
                      {funcionario.telefone || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Telefone Empresarial</label>
                    <p className="text-lg flex items-center gap-2">
                      <PhoneIcon className="h-4 w-4" />
                      {funcionario.telefone_empresarial || 'Não informado'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informações Profissionais */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BuildingOfficeIcon className="h-5 w-5" />
                  Informações Profissionais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Cargo</label>
                    <p className="text-lg font-semibold">{funcionario.cargo}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Posição</label>
                    <p className="text-lg">{funcionario.posicao || 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Operação</label>
                    <p className="text-lg">{funcionario.operacao}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Departamento</label>
                    <p className="text-lg">{funcionario.departamento || 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Base</label>
                    <p className="text-lg">{funcionario.base?.nome || 'Não informado'}</p>
                    {funcionario.base?.cidade && funcionario.base?.estado && (
                      <p className="text-sm text-gray-500">{funcionario.base.cidade}, {funcionario.base.estado}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Contrato</label>
                    <p className="text-lg">{funcionario.contrato?.nome || 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Data de Admissão</label>
                    <p className="text-lg">{funcionario.data_admissao ? formatDate(funcionario.data_admissao) : 'Não informado'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documentos e Vencimentos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IdentificationIcon className="h-5 w-5" />
                  Documentos e Vencimentos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* CNH */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">CNH - Carteira Nacional de Habilitação</h4>
                    {getStatusBadge(funcionario.vencimentos.cnh.status)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <label className="text-gray-500">Número</label>
                      <p>{funcionario.cnh || 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">Categoria</label>
                      <p>{funcionario.cnh_categoria || 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">Validade</label>
                      <p>{funcionario.vencimentos.cnh.data_vencimento ? formatDate(funcionario.vencimentos.cnh.data_vencimento) : 'Não informado'}</p>
                    </div>
                  </div>
                  {funcionario.vencimentos.cnh.dias_vencimento !== null && (
                    <p className="text-sm text-gray-600">
                      {funcionario.vencimentos.cnh.dias_vencimento > 0 
                        ? `${funcionario.vencimentos.cnh.dias_vencimento} dias para vencer`
                        : funcionario.vencimentos.cnh.dias_vencimento === 0
                        ? 'Vence hoje'
                        : `${Math.abs(funcionario.vencimentos.cnh.dias_vencimento)} dias vencido`
                      }
                    </p>
                  )}
                </div>

                <Separator />

                {/* ASO */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">ASO - Atestado de Saúde Ocupacional</h4>
                    {getStatusBadge(funcionario.vencimentos.aso.status)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-gray-500">Último ASO</label>
                      <p>{funcionario.vencimentos.aso.data_ultimo ? formatDate(funcionario.vencimentos.aso.data_ultimo) : 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">Próximo Vencimento</label>
                      <p>{funcionario.vencimentos.aso.data_vencimento ? formatDate(funcionario.vencimentos.aso.data_vencimento) : 'Não informado'}</p>
                    </div>
                  </div>
                  {funcionario.vencimentos.aso.dias_vencimento !== null && (
                    <p className="text-sm text-gray-600">
                      {funcionario.vencimentos.aso.dias_vencimento > 0 
                        ? `${funcionario.vencimentos.aso.dias_vencimento} dias para vencer`
                        : funcionario.vencimentos.aso.dias_vencimento === 0
                        ? 'Vence hoje'
                        : `${Math.abs(funcionario.vencimentos.aso.dias_vencimento)} dias vencido`
                      }
                    </p>
                  )}
                </div>

                <Separator />

                {/* HAR */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">HAR - Homologação de Aptidão para Risco</h4>
                    {getStatusBadge(funcionario.vencimentos.har.status)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4 text-sm">
                    <div>
                      <label className="text-gray-500">Vencimento</label>
                      <p>{funcionario.vencimentos.har.data_vencimento ? formatDate(funcionario.vencimentos.har.data_vencimento) : 'Não informado'}</p>
                    </div>
                  </div>
                  {funcionario.vencimentos.har.dias_vencimento !== null && (
                    <p className="text-sm text-gray-600">
                      {funcionario.vencimentos.har.dias_vencimento > 0 
                        ? `${funcionario.vencimentos.har.dias_vencimento} dias para vencer`
                        : funcionario.vencimentos.har.dias_vencimento === 0
                        ? 'Vence hoje'
                        : `${Math.abs(funcionario.vencimentos.har.dias_vencimento)} dias vencido`
                      }
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Informações do Sistema */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Informações do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-gray-500">Criado em</label>
                    <p>{funcionario.criado_em ? formatDate(funcionario.criado_em) : 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-gray-500">Última atualização</label>
                    <p>{funcionario.atualizado_em ? formatDate(funcionario.atualizado_em) : 'Não informado'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

