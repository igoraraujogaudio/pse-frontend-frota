/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService } from '@/services/teamService';
import { ContratoService } from '@/services/contratoService';
import { OperacoesAtividadesService } from '@/services/operacoesAtividadesService';
import { SetoresService } from '@/services/setoresService';
import { useAuth } from '@/contexts/AuthContext';
import { Team } from '@/types/team';
import type { Contrato } from '@/types/contratos';
import { OperacaoPadrao } from '@/types/operacoes-atividades';
import { SetorPadrao } from '@/types/setores';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';

// Shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
// import { Alert, AlertDescription } from '@/components/ui/alert'; // TODO: Implement alert messages

export default function EditarEquipePage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.EQUIPES.EDITAR_EQUIPE
    ]}>
      <EditarEquipePageContent />
    </ProtectedRoute>
  );
}

function EditarEquipePageContent() {
  const router = useRouter();
  const params = useParams();
  const { } = useAuth(); // user and userLocationIds available if needed
  const queryClient = useQueryClient();
  const teamId = params.id as string;

  // Estados
  const [formData, setFormData] = useState({
    nome: '',
    operacao: '',
    operacao_id: '',
    encarregado_id: '',
    setor: '',
    prefixo: '',
    contrato_id: '',
    status: 'active' as 'active' | 'parada',
    motivoParada: ''
  });

  const [operacoesPadrao, setOperacoesPadrao] = useState<OperacaoPadrao[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<SetorPadrao[]>([]);
  const [operacaoSelecionada, setOperacaoSelecionada] = useState<OperacaoPadrao | null>(null);
  const [encarregadoSearch, setEncarregadoSearch] = useState('');
  const [showEncarregadoDropdown, setShowEncarregadoDropdown] = useState(false);

  // Buscar equipe
  const { data: team, isLoading, error } = useQuery<Team>({
    queryKey: ['team', teamId],
    queryFn: async () => {
      try {
        console.log('🔍 Carregando equipe:', teamId);
        const data = await teamService.getById(teamId);
        console.log('✅ Equipe carregada:', data);
        return data;
      } catch (err) {
        console.error('❌ Erro ao carregar equipe:', err);
        throw err;
      }
    },
    enabled: !!teamId
  });

  // Buscar contratos
  const { data: contratos = [] } = useQuery<Contrato[]>({
    queryKey: ['contratos'],
    queryFn: async () => {
      const contratoService = new ContratoService();
      return contratoService.getContratosAtivos();
    },
  });

  // Carregar operações quando contrato_id estiver disponível
  useEffect(() => {
    const loadOperacoes = async () => {
      if (!formData.contrato_id) {
        console.log('⏩ Contrato não selecionado, não carregar operações');
        setOperacoesPadrao([]);
        return;
      }

      try {
        console.log('🔍 Carregando operações para contrato:', formData.contrato_id);
        const ops = await OperacoesAtividadesService.getOperacoes({ 
          ativo: true,
          contratoId: formData.contrato_id 
        });
        console.log('✅ Operações carregadas:', ops.length);
        console.log('   Operações:', ops.map(o => `${o.nome} (${o.codigo})`).join(', '));
        setOperacoesPadrao(ops);
      } catch (error) {
        console.error('❌ Erro ao carregar operações:', error);
        setOperacoesPadrao([]);
      }
    };

    loadOperacoes();
  }, [formData.contrato_id]);

  // Carregar funcionários para o seletor de encarregado
  useEffect(() => {
    const loadFuncionarios = async () => {
      try {
        console.log('🔍 Carregando funcionários...');
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          console.log('📦 Resposta da API:', data);
          
          // A API retorna { usuarios }, não { users }
          const funcionariosList = data.usuarios || data.users || [];
          
          // Remover duplicados por ID para evitar erro de keys duplicadas
          const uniqueFuncionarios = funcionariosList.filter((funcionario: any, index: number, self: any[]) => 
            index === self.findIndex((f: any) => f.id === funcionario.id)
          );
          
          console.log('✅ Funcionários carregados:', funcionariosList.length);
          console.log('   - Únicos:', uniqueFuncionarios.length);
          console.log('   - Ativos:', uniqueFuncionarios.filter((f: any) => f.status === 'ativo').length);
          
          if (funcionariosList.length !== uniqueFuncionarios.length) {
            console.warn('⚠️  Funcionários duplicados removidos:', funcionariosList.length - uniqueFuncionarios.length);
          }
          
          setFuncionarios(uniqueFuncionarios);
        } else {
          console.error('❌ Erro ao carregar funcionários:', response.status);
        }
      } catch (error) {
        console.error('❌ Erro ao carregar funcionários:', error);
      }
    };

    loadFuncionarios();
  }, []);

  // Atualizar operação selecionada quando operacao_id mudar
  useEffect(() => {
    if (formData.operacao_id) {
      const op = operacoesPadrao.find(o => o.id === formData.operacao_id);
      console.log('🔍 Operação selecionada:', op);
      console.log('   - Requer encarregado?', op?.requerEncarregado);
      setOperacaoSelecionada(op || null);
    } else {
      setOperacaoSelecionada(null);
    }
  }, [formData.operacao_id, operacoesPadrao]);

  // Carregar setores disponíveis quando operação mudar
  useEffect(() => {
    const loadSetores = async () => {
      if (!formData.operacao_id) {
        setSetoresDisponiveis([]);
        return;
      }

      try {
        const setores = await SetoresService.getSetoresDaOperacao(formData.operacao_id);
        setSetoresDisponiveis(setores);
      } catch (error) {
        console.error('Erro ao carregar setores:', error);
        setSetoresDisponiveis([]);
      }
    };

    loadSetores();
  }, [formData.operacao_id]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#encarregado') && !target.closest('.absolute.z-50')) {
        setShowEncarregadoDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Preencher formulário quando equipe for carregada
  useEffect(() => {
    if (team) {
      console.log('📋 Preenchendo formulário com dados da equipe:', team);
      console.log('   ├─ Nome:', team.nome);
      console.log('   ├─ Contrato ID:', team.contrato_id);
      console.log('   ├─ Operação:', team.operacao);
      console.log('   ├─ Operação ID:', team.operacao_id);
      console.log('   ├─ Encarregado ID:', team.encarregado_id);
      console.log('   ├─ Encarregado Obj:', (team as any).encarregado);
      console.log('   ├─ Setor:', team.setor);
      console.log('   ├─ Prefixo:', (team as any).prefixo);
      console.log('   └─ Status:', team.status);
      
      const formDataToSet = {
        nome: team.nome || '',
        operacao: team.operacao || '',
        operacao_id: team.operacao_id || '',
        encarregado_id: team.encarregado_id || '',
        setor: team.setor || '',
        prefixo: (team as any).prefixo || '',
        contrato_id: team.contrato_id ? String(team.contrato_id) : '',
        status: team.status || 'active',
        motivoParada: team.motivoParada || ''
      };
      
      console.log('✅ FormData configurado:', formDataToSet);
      setFormData(formDataToSet);
      
      // Se tem encarregado, buscar o nome
      if (team.encarregado_id && (team as any).encarregado) {
        const nomeEncarregado = `${(team as any).encarregado.nome} - ${(team as any).encarregado.matricula}`;
        console.log('✅ Campo encarregado preenchido:', nomeEncarregado);
        setEncarregadoSearch(nomeEncarregado);
      } else if (team.encarregado_id) {
        console.log('⚠️  Equipe tem encarregado_id mas objeto encarregado não foi carregado');
      }
    }
  }, [team]);

  // Mutação para atualizar equipe
  const updateTeamMutation = useMutation({
    mutationFn: (data: Partial<Team>) => teamService.update(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      router.push('/frota/equipes');
    },
    onError: (error) => {
      alert(`Erro ao atualizar equipe: ${error.message || 'Erro desconhecido'}`);
    }
  });

  // Filtrar funcionários ativos por busca
  const funcionariosFiltrados = funcionarios
    .filter(f => f.status === 'ativo')
    .filter(f => {
      if (!encarregadoSearch) return true;
      const search = encarregadoSearch.toLowerCase();
      return (
        f.nome?.toLowerCase().includes(search) ||
        f.matricula?.toLowerCase().includes(search)
      );
    });

  // Debug: Log quando filtro muda
  useEffect(() => {
    console.log('🔍 Busca encarregado:', encarregadoSearch);
    console.log('📋 Total funcionários:', funcionarios.length);
    console.log('✅ Funcionários filtrados:', funcionariosFiltrados.length);
    console.log('👁️  Mostrar dropdown?', showEncarregadoDropdown);
  }, [encarregadoSearch, funcionarios, funcionariosFiltrados.length, showEncarregadoDropdown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updateData: any = {
      nome: formData.nome,
      operacao_id: formData.operacao_id || undefined,
      encarregado_id: formData.encarregado_id || null,
      setor: formData.setor || null,
      prefixo: formData.prefixo || undefined,
      contrato_id: formData.contrato_id || undefined,
      status: formData.status,
      motivoParada: formData.status === 'parada' ? formData.motivoParada : undefined
    };

    console.log('💾 Enviando atualização da equipe:', updateData);
    console.log('   - Encarregado ID sendo enviado:', updateData.encarregado_id);

    // O campo 'operacao' (texto) será atualizado automaticamente pelo trigger
    // baseado no operacao_id

    updateTeamMutation.mutate(updateData);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando equipe...</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600 text-lg font-semibold mb-2">Erro ao carregar equipe</p>
            {error && (
              <p className="text-sm text-red-700 mb-2">
                {error instanceof Error ? error.message : 'Erro desconhecido'}
              </p>
            )}
            <details className="text-xs text-left text-red-600 mt-2">
              <summary className="cursor-pointer font-medium">Detalhes técnicos</summary>
              <pre className="mt-2 p-2 bg-red-100 rounded overflow-auto">
                {JSON.stringify(error, null, 2)}
              </pre>
            </details>
          </div>
          <Button onClick={() => router.push('/frota/equipes')} className="mt-4">
            Voltar para Equipes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => router.push('/frota/equipes')}
              className="mb-4"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Editar Equipe</h1>
            <p className="text-gray-600 mt-1">Atualize as informações da equipe</p>
          </div>

          {/* Formulário */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome da Equipe */}
                <div>
                  <Label htmlFor="nome">Nome da Equipe *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    required
                    placeholder="Nome da equipe"
                  />
                </div>

                {/* Contrato */}
                <div>
                  <Label htmlFor="contrato_id">Contrato *</Label>
                  <Select 
                    key={`contrato-${formData.contrato_id}`}
                    value={formData.contrato_id} 
                    onValueChange={(value) => {
                      console.log('🔄 Mudando contrato:', value);
                      setFormData(prev => ({ ...prev, contrato_id: value, operacao_id: '' }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contratos.map(contrato => (
                        <SelectItem key={contrato.id} value={String(contrato.id)}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Ao mudar o contrato, selecione a operação novamente
                  </p>
                </div>

                {/* Operação */}
                <div>
                  <Label htmlFor="operacao">Operação *</Label>
                  <Select 
                    key={`operacao-${formData.operacao_id}-${formData.contrato_id}`}
                    value={formData.operacao_id} 
                    onValueChange={(value) => {
                      console.log('🔄 Mudando operação:', value);
                      setFormData(prev => ({ ...prev, operacao_id: value }));
                    }}
                    disabled={!formData.contrato_id || operacoesPadrao.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.contrato_id ? "Selecione a operação" : "Selecione um contrato primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {operacoesPadrao.map(operacao => (
                        <SelectItem key={operacao.id} value={operacao.id}>
                          {operacao.nome} ({operacao.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {operacoesPadrao.length === 0 && formData.contrato_id 
                      ? 'Nenhuma operação cadastrada para este contrato' 
                      : 'Operação vinculada à equipe'}
                  </p>
                </div>

                {/* Prefixo */}
                <div>
                  <Label htmlFor="prefixo">Prefixo</Label>
                  <Input
                    id="prefixo"
                    value={formData.prefixo}
                    onChange={(e) => setFormData(prev => ({ ...prev, prefixo: e.target.value }))}
                    placeholder="Prefixo da equipe"
                  />
                </div>

                {/* Encarregado - Mostrar apenas se operação requer */}
                {operacaoSelecionada?.requerEncarregado && (
                  <div className="relative">
                    <Label htmlFor="encarregado">
                      Encarregado
                      <span className="text-xs text-blue-600 ml-1">(Recomendado para esta operação)</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="encarregado"
                        value={encarregadoSearch}
                        onChange={(e) => {
                          setEncarregadoSearch(e.target.value);
                          setShowEncarregadoDropdown(true);
                        }}
                        onFocus={() => setShowEncarregadoDropdown(true)}
                        placeholder="Buscar por nome ou matrícula..."
                        className="w-full"
                      />
                      {formData.encarregado_id && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, encarregado_id: '' }));
                            setEncarregadoSearch('');
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    {showEncarregadoDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {funcionariosFiltrados.length > 0 ? (
                          funcionariosFiltrados.map(funcionario => (
                            <button
                              key={funcionario.id}
                              type="button"
                              onClick={() => {
                                console.log('✅ Selecionado:', funcionario.nome);
                                setFormData(prev => ({ ...prev, encarregado_id: funcionario.id }));
                                setEncarregadoSearch(`${funcionario.nome} - ${funcionario.matricula}`);
                                setShowEncarregadoDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                                formData.encarregado_id === funcionario.id ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="font-medium">{funcionario.nome}</div>
                              <div className="text-sm text-gray-500">
                                Matrícula: {funcionario.matricula} • {funcionario.cargo}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-center text-gray-500">
                            <p className="text-sm">Nenhum funcionário encontrado</p>
                            <p className="text-xs mt-1">
                              Total: {funcionarios.length} | Ativos: {funcionarios.filter(f => f.status === 'ativo').length}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-1">
                      Busque funcionários ativos por nome ou matrícula (opcional)
                    </p>
                  </div>
                )}

                {/* Setor - Mostrar apenas se operação tiver setores associados */}
                {setoresDisponiveis.length > 0 && (
                  <div>
                    <Label htmlFor="setor">
                      Setor
                      <span className="text-xs text-gray-500 ml-1">
                        (Setores disponíveis para {operacaoSelecionada?.nome})
                      </span>
                    </Label>
                    <Select 
                      key={`setor-${formData.setor}`}
                      value={formData.setor || undefined} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, setor: value === 'NENHUM' ? '' : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o setor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NENHUM">Nenhum</SelectItem>
                        {setoresDisponiveis.map(setor => (
                          <SelectItem key={setor.id} value={setor.codigo}>
                            {setor.nome} ({setor.codigo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Apenas setores associados à operação selecionada
                    </p>
                  </div>
                )}

                {/* Status */}
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: 'active' | 'parada') => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="parada">Parada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Motivo da Parada */}
              {formData.status === 'parada' && (
                <div>
                  <Label htmlFor="motivoParada">Motivo da Parada</Label>
                  <Textarea
                    id="motivoParada"
                    value={formData.motivoParada}
                    onChange={(e) => setFormData(prev => ({ ...prev, motivoParada: e.target.value }))}
                    placeholder="Descreva o motivo da parada"
                    rows={3}
                  />
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/frota/equipes')}
                  disabled={updateTeamMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateTeamMutation.isPending}
                  className="min-w-[120px]"
                >
                  {updateTeamMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Salvar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}