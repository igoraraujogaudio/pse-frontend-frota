'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  ShieldCheckIcon, 
  CogIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { modularPermissionService } from '@/services/modularPermissionService';
import ProfileFormModal from './ProfileFormModal';
import DeleteProfileDialog from './DeleteProfileDialog';
import type { 
  FuncionalidadeModular, 
  ModuloSistema, 
  Plataforma, 
  PerfilAcesso, 
  PerfilFuncionalidadesPadrao 
} from '@/types/permissions';

export default function ProfilePermissionsManager() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estados para dados modulares
  const [funcionalidadesModulares, setFuncionalidadesModulares] = useState<FuncionalidadeModular[]>([]);
  const [modulosSistema, setModulosSistema] = useState<ModuloSistema[]>([]);
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [perfilFuncionalidadesPadrao, setPerfilFuncionalidadesPadrao] = useState<PerfilFuncionalidadesPadrao[]>([]);

  // Estados para edição
  const [selectedProfile, setSelectedProfile] = useState<PerfilAcesso | null>(null);
  const [profilePermissions, setProfilePermissions] = useState<{[funcionalidadeId: string]: boolean}>({});

  // Estados para modais de CRUD de perfis
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PerfilAcesso | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<PerfilAcesso | null>(null);

  // Carregar dados modulares
  useEffect(() => {
    loadModularData();
  }, []);

  const loadModularData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Carregando dados modulares para ProfilePermissionsManager...');
      
      const [
        funcionalidadesData,
        modulosData,
        plataformasData,
        perfisData,
        perfilFuncionalidadesData
      ] = await Promise.all([
        modularPermissionService.getFuncionalidadesModulares(),
        modularPermissionService.getModulosSistema(),
        modularPermissionService.getPlataformas(),
        modularPermissionService.getPerfisAcesso(),
        modularPermissionService.getPerfilFuncionalidadesPadrao()
      ]);

      console.log('✅ Dados carregados:', {
        funcionalidades: funcionalidadesData.length,
        modulos: modulosData.length,
        plataformas: plataformasData.length,
        perfis: perfisData.length,
        perfilFuncionalidades: perfilFuncionalidadesData.length
      });

      setFuncionalidadesModulares(funcionalidadesData);
      setModulosSistema(modulosData);
      setPlataformas(plataformasData);
      setPerfisAcesso(perfisData);
      setPerfilFuncionalidadesPadrao(perfilFuncionalidadesData);
    } catch (error) {
      console.error('❌ Erro ao carregar dados modulares:', error);
    } finally {
      setLoading(false);
    }
  };

  // Selecionar perfil para edição
  const selectProfile = (perfil: PerfilAcesso) => {
    console.log('🎯 Selecionando perfil:', perfil.nome);
    setSelectedProfile(perfil);
    
    // Carregar permissões padrão do perfil
    const permissoesPadrao = perfilFuncionalidadesPadrao.filter(pfp => pfp.perfil_id === perfil.id);
    const permissoesMap: {[funcionalidadeId: string]: boolean} = {};
    
    funcionalidadesModulares.forEach(funcionalidade => {
      const permissaoPadrao = permissoesPadrao.find(pfp => pfp.funcionalidade_id === funcionalidade.id);
      permissoesMap[funcionalidade.id] = permissaoPadrao ? permissaoPadrao.concedido : false;
    });
    
    console.log('📋 Permissões carregadas:', Object.keys(permissoesMap).length);
    setProfilePermissions(permissoesMap);
  };

  // Toggle permissão
  const togglePermission = (funcionalidadeId: string) => {
    setProfilePermissions(prev => ({
      ...prev,
      [funcionalidadeId]: !prev[funcionalidadeId]
    }));
  };

  // Toggle status do perfil (ativo/inativo)
  const toggleProfileStatus = async (perfil: PerfilAcesso) => {
    try {
      console.log(`🔄 Alternando status do perfil ${perfil.nome} de ${perfil.ativo ? 'ATIVO' : 'INATIVO'} para ${!perfil.ativo ? 'ATIVO' : 'INATIVO'}`);
      
      await modularPermissionService.updatePerfilAcesso(perfil.id, !perfil.ativo);
      
      // Atualizar a lista local
      setPerfisAcesso(prev => 
        prev.map(p => 
          p.id === perfil.id 
            ? { ...p, ativo: !p.ativo }
            : p
        )
      );
      
      console.log(`✅ Perfil ${perfil.nome} ${!perfil.ativo ? 'ATIVADO' : 'DESATIVADO'} com sucesso!`);
    } catch (error) {
      console.error('❌ Erro ao alterar status do perfil:', error);
    }
  };

  // Ativar todos os perfis
  const activateAllProfiles = async () => {
    try {
      console.log('🔄 Ativando todos os perfis...');
      
      const perfisInativos = perfisAcesso.filter(p => !p.ativo);
      console.log(`📋 Perfis inativos encontrados: ${perfisInativos.length}`);
      
      if (perfisInativos.length === 0) {
        console.log('ℹ️ Todos os perfis já estão ativos!');
        alert('ℹ️ Todos os perfis já estão ativos!');
        return;
      }
      
      // Ativar cada perfil sequencialmente
      for (const perfil of perfisInativos) {
        console.log(`🔄 Ativando perfil ${perfil.nome} (ID: ${perfil.id})...`);
        try {
          await modularPermissionService.updatePerfilAcesso(perfil.id, true);
          console.log(`✅ Perfil ${perfil.nome} ativado com sucesso!`);
        } catch (perfilError) {
          console.error(`❌ Erro ao ativar perfil ${perfil.nome}:`, perfilError);
        }
      }
      
      // Atualizar a lista local
      setPerfisAcesso(prev => 
        prev.map(p => ({ ...p, ativo: true }))
      );
      
      console.log(`✅ ${perfisInativos.length} perfis ativados com sucesso!`);
      alert(`✅ ${perfisInativos.length} perfis ativados com sucesso!`);
    } catch (error) {
      console.error('❌ Erro ao ativar todos os perfis:', error);
      alert('❌ Erro ao ativar perfis. Verifique os logs no console.');
    }
  };

  // Aplicar permissões padrão a todos os usuários existentes
  const applyDefaultPermissionsToAllUsers = async () => {
    console.log('🚀 FUNÇÃO CHAMADA: applyDefaultPermissionsToAllUsers');
    console.log('📊 Estado atual dos dados:', {
      perfisAcesso: perfisAcesso.length,
      funcionalidadesModulares: funcionalidadesModulares.length,
      modulosSistema: modulosSistema.length,
      plataformas: plataformas.length,
      perfilFuncionalidadesPadrao: perfilFuncionalidadesPadrao.length
    });
    alert('🚀 Função chamada! Verifique o console para logs detalhados.');
    
    try {
      console.log('🔄 Aplicando permissões padrão a todos os usuários existentes...');
      console.log('📊 Estado atual dos perfis:', perfisAcesso.map(p => ({ nome: p.nome, ativo: p.ativo, id: p.id })));
      
      const perfisAtivos = perfisAcesso.filter(p => p.ativo);
      console.log(`📋 Perfis ativos encontrados: ${perfisAtivos.length}`);
      
      if (perfisAtivos.length === 0) {
        console.log('⚠️ Nenhum perfil ativo encontrado! Ative os perfis primeiro.');
        alert('⚠️ Nenhum perfil ativo encontrado! Ative os perfis primeiro.');
        return;
      }
      
      let totalPermissoesAplicadas = 0;
      
      for (const perfil of perfisAtivos) {
        console.log(`🔄 Aplicando permissões do perfil ${perfil.nome} (ID: ${perfil.id})...`);
        try {
          // Usar null para concedido_por (campo opcional)
          await modularPermissionService.applyProfileDefaultPermissionsToAllUsers(perfil.id, null);
          console.log(`✅ Permissões do perfil ${perfil.nome} aplicadas com sucesso!`);
          totalPermissoesAplicadas++;
        } catch (perfilError) {
          console.error(`❌ Erro ao aplicar permissões do perfil ${perfil.nome}:`, perfilError);
        }
      }
      
      console.log(`✅ Processo concluído! Permissões aplicadas para ${totalPermissoesAplicadas}/${perfisAtivos.length} perfis ativos.`);
      
      if (totalPermissoesAplicadas > 0) {
        alert(`✅ Permissões aplicadas com sucesso para ${totalPermissoesAplicadas} perfis!`);
      } else {
        alert('⚠️ Nenhuma permissão foi aplicada. Verifique os logs no console.');
      }
    } catch (error) {
      console.error('❌ Erro ao aplicar permissões padrão a todos os usuários:', error);
      alert('❌ Erro ao aplicar permissões. Verifique os logs no console.');
    }
  };

  // Salvar permissões padrão do perfil
  const saveProfilePermissions = async () => {
    if (!selectedProfile) return;

    setSaving(true);
    try {
      console.log('💾 Salvando permissões para perfil:', selectedProfile.nome);
      console.log('📊 Total de funcionalidades:', funcionalidadesModulares.length);
      
      // Identificar permissões que foram removidas (mudaram de true para false)
      const permissoesRemovidas = [];
      
      // Atualizar cada permissão
      for (const funcionalidade of funcionalidadesModulares) {
        const concedido = profilePermissions[funcionalidade.id] || false;
        
        console.log(`🔧 Processando funcionalidade ${funcionalidade.nome} (${funcionalidade.id}): ${concedido ? 'CONCEDIDO' : 'NEGADO'}`);
        
        // Verificar se já existe uma entrada para esta combinação
        const existingEntry = perfilFuncionalidadesPadrao.find(
          pfp => pfp.perfil_id === selectedProfile.id && pfp.funcionalidade_id === funcionalidade.id
        );

        console.log(`🔍 Entrada existente para ${funcionalidade.nome}:`, existingEntry ? 'SIM' : 'NÃO');

        // Verificar se a permissão foi removida (estava concedida e agora não está)
        if (existingEntry && existingEntry.concedido === true && !concedido) {
          permissoesRemovidas.push(funcionalidade.id);
          console.log(`🚫 Permissão removida: ${funcionalidade.nome}`);
        }

        if (existingEntry) {
          // Atualizar entrada existente
          console.log(`🔄 Atualizando entrada existente para ${funcionalidade.nome}`);
          await modularPermissionService.updatePerfilFuncionalidadesPadrao(
            selectedProfile.id,
            funcionalidade.id,
            concedido
          );
        } else {
          // Criar nova entrada
          console.log(`➕ Criando nova entrada para ${funcionalidade.nome}`);
          await modularPermissionService.createPerfilFuncionalidadesPadrao(
            selectedProfile.id,
            funcionalidade.id,
            concedido
          );
        }
      }

      // Se houve permissões removidas, aplicar a remoção aos usuários
      if (permissoesRemovidas.length > 0) {
        console.log(`🔄 ${permissoesRemovidas.length} permissões foram removidas, aplicando remoção aos usuários...`);
        console.log(`📋 Permissões removidas:`, permissoesRemovidas);
        try {
          await modularPermissionService.removeProfileDefaultPermissionsFromAllUsers(selectedProfile.id, permissoesRemovidas);
          console.log(`✅ Permissões removidas aplicadas aos usuários com sucesso!`);
        } catch (removeError) {
          console.error('❌ Erro ao remover permissões dos usuários:', removeError);
          // Não falha o processo todo se a remoção falhar
        }
      }

      // Recarregar dados
      console.log('🔄 Recarregando dados...');
      await loadModularData();
      
      console.log(`✅ Permissões padrão do perfil ${selectedProfile.nome} salvas com sucesso!`);
      alert(`✅ Permissões padrão do perfil ${selectedProfile.nome} salvas com sucesso!`);
    } catch (error) {
      console.error('❌ Erro ao salvar permissões padrão:', error);
      console.error('❌ Detalhes do erro:', {
        message: (error as Error).message,
        code: (error as Record<string, unknown>).code,
        details: (error as Record<string, unknown>).details,
        hint: (error as Record<string, unknown>).hint
      });
      alert('❌ Erro ao salvar permissões padrão. Verifique os logs no console.');
    } finally {
      setSaving(false);
    }
  };

  // Agrupar funcionalidades por módulo e plataforma
  const funcionalidadesPorModulo = modulosSistema.map(modulo => {
    const funcionalidadesModulo = funcionalidadesModulares.filter(f => f.modulo_id === modulo.id);
    
    const funcionalidadesPorPlataforma = plataformas.map(plataforma => {
      const funcionalidadesPlataforma = funcionalidadesModulo.filter(f => f.plataforma_id === plataforma.id);
      
      return {
        ...plataforma,
        funcionalidades: funcionalidadesPlataforma,
        total: funcionalidadesPlataforma.length
      };
    });

    return {
      ...modulo,
      plataformas: funcionalidadesPorPlataforma,
      totalFuncionalidades: funcionalidadesModulo.length
    };
  });

  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando gerenciador de permissões padrão...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">⚙️ Gerenciador de Permissões Padrão</h2>
          <p className="text-gray-600 mt-1">
            Configure as permissões padrão para cada nível de acesso ({funcionalidadesModulares.length} funcionalidades)
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={applyDefaultPermissionsToAllUsers} 
            variant="default"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CheckIcon className="h-4 w-4 mr-2" />
            Aplicar Permissões a Todos os Usuários
          </Button>
          <Button 
            onClick={activateAllProfiles} 
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckIcon className="h-4 w-4 mr-2" />
            Ativar Todos os Perfis
          </Button>
          <Button onClick={loadModularData} variant="outline" disabled={loading}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Atualizar Dados
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Perfis */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5" />
                Perfis de Acesso ({perfisAcesso.length})
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingProfile(null);
                  setShowFormModal(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Novo Perfil
              </Button>
            </div>
            <CardDescription>
              Selecione um perfil para configurar suas permissões padrão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {perfisAcesso.map(perfil => {
                const permissoesPadrao = perfilFuncionalidadesPadrao.filter(pfp => pfp.perfil_id === perfil.id);
                const permissoesConcedidas = permissoesPadrao.filter(pfp => pfp.concedido).length;
                
                return (
                  <div 
                    key={perfil.id} 
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedProfile?.id === perfil.id 
                        ? 'bg-blue-50 border-blue-400' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => selectProfile(perfil)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{perfil.nome}</h3>
                      <div className="flex items-center gap-2">
                      <button
                        title="Editar perfil"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProfile(perfil);
                          setShowFormModal(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title="Excluir perfil"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProfile(perfil);
                          setShowDeleteDialog(true);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Badge variant={perfil.ativo ? "default" : "secondary"}>
                        {perfil.ativo ? "✅ Ativo" : "❌ Inativo"}
                      </Badge>
                      <Button
                        size="sm"
                        variant={perfil.ativo ? "destructive" : "default"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProfileStatus(perfil);
                        }}
                        className="text-xs"
                      >
                        {perfil.ativo ? "Desativar" : "Ativar"}
                      </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{perfil.descricao}</p>
                    <div className="flex justify-between text-sm">
                      <span>Nível:</span>
                      <Badge variant="outline">{perfil.nivel_hierarquia || perfil.codigo}</Badge>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span>Permissões Padrão:</span>
                      <Badge variant="outline">{permissoesConcedidas}/{funcionalidadesModulares.length}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Editor de Permissões */}
        <div className="lg:col-span-2">
          {selectedProfile ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CogIcon className="h-5 w-5" />
                      Permissões Padrão: {selectedProfile.nome}
                    </CardTitle>
                    <CardDescription>
                      Configure as permissões que serão aplicadas automaticamente a usuários com este nível de acesso
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={saveProfilePermissions} 
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckIcon className="h-4 w-4 mr-2" />
                    {saving ? 'Salvando...' : 'Salvar Permissões'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {funcionalidadesPorModulo.map(modulo => (
                    <div key={modulo.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-4">{modulo.nome}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {modulo.plataformas.map(plataforma => (
                          <div key={plataforma.id} className={`p-4 rounded-lg border-l-4 ${
                            plataforma.nome === 'Sistema Web' 
                              ? 'bg-blue-50 border-blue-400' 
                              : 'bg-green-50 border-green-400'
                          }`}>
                            <div className="flex items-center gap-3 mb-4">
                              {plataforma.nome === 'Sistema Web' ? (
                                <ComputerDesktopIcon className="h-6 w-6 text-blue-600" />
                              ) : (
                                <DevicePhoneMobileIcon className="h-6 w-6 text-green-600" />
                              )}
                              <h4 className="font-semibold">{plataforma.nome}</h4>
                              <Badge variant="outline">{plataforma.total} funcionalidades</Badge>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {plataforma.funcionalidades.map(funcionalidade => (
                                <div key={funcionalidade.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={funcionalidade.id}
                                    checked={profilePermissions[funcionalidade.id] || false}
                                    onCheckedChange={() => togglePermission(funcionalidade.id)}
                                  />
                                  <Label htmlFor={funcionalidade.id} className="text-sm flex-1">
                                    {funcionalidade.nome}
                                  </Label>
                                  {profilePermissions[funcionalidade.id] ? (
                                    <CheckIcon className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XMarkIcon className="h-4 w-4 text-gray-400" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecione um Perfil</h3>
                <p className="text-gray-600">
                  Escolha um perfil de acesso na lista ao lado para configurar suas permissões padrão
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de criação/edição de perfil */}
      <ProfileFormModal
        open={showFormModal}
        onOpenChange={setShowFormModal}
        perfil={editingProfile}
        onSuccess={(perfil: PerfilAcesso) => {
          if (editingProfile) {
            // Modo edição: atualizar o perfil na lista local
            setPerfisAcesso(prev =>
              prev.map(p => (p.id === perfil.id ? perfil : p))
            );
            // Atualizar selectedProfile se o perfil editado estava selecionado
            if (selectedProfile?.id === perfil.id) {
              setSelectedProfile(perfil);
            }
            alert(`✅ Perfil "${perfil.nome}" atualizado com sucesso!`);
          } else {
            // Modo criação: adicionar novo perfil à lista, selecionar e recarregar dados
            setPerfisAcesso(prev => [...prev, perfil]);
            setSelectedProfile(perfil);
            loadModularData();
            alert(`✅ Perfil "${perfil.nome}" criado com sucesso!`);
          }
          setShowFormModal(false);
          setEditingProfile(null);
        }}
      />

      {/* Diálogo de confirmação de exclusão */}
      <DeleteProfileDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        perfil={deletingProfile}
        onSuccess={() => {
          if (deletingProfile) {
            // Remover perfil da lista local
            setPerfisAcesso(prev => prev.filter(p => p.id !== deletingProfile.id));
            // Limpar seleção se o perfil excluído estava selecionado
            if (selectedProfile?.id === deletingProfile.id) {
              setSelectedProfile(null);
            }
            alert(`✅ Perfil "${deletingProfile.nome}" excluído com sucesso!`);
          }
          setShowDeleteDialog(false);
          setDeletingProfile(null);
        }}
      />
    </div>
  );
}
