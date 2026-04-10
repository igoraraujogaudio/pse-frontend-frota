"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, XCircle, AlertCircle, Building2, MapPin, User } from 'lucide-react';
import { contratoService } from '@/services/contratoService';
import { baseService } from '@/services/baseService';
import ProtectedRoute from '@/components/ProtectedRoute';

interface Usuario {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  departamento: string;
  cargo: string;
}

interface Contrato {
  id: string;
  nome: string;
  codigo: string;
  status: 'ativo' | 'inativo' | 'suspenso';
  responsavel_id?: string;
}

interface Base {
  id: string;
  nome: string;
  codigo: string;
  cidade?: string;
  estado?: string;
  contrato_id?: string;
  ativa: boolean;
  contrato?: Contrato;
}

interface UsuarioContrato {
  usuario_id: string;
  contrato_id: string;
  perfil_contrato: string;
  ativo: boolean;
  contrato?: Contrato;
}

interface UsuarioBase {
  usuario_id: string;
  base_id: string;
  tipo_acesso: 'total' | 'restrito' | 'leitura';
  ativo: boolean;
  base?: Base;
}

export default function ManageContratosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [usuariosContratos, setUsuariosContratos] = useState<UsuarioContrato[]>([]);
  const [usuariosBases, setUsuariosBases] = useState<UsuarioBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContrato, setSelectedContrato] = useState<string>('');
  const [selectedBase, setSelectedBase] = useState<string>('');
  const [activeTab, setActiveTab] = useState('contratos');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      console.log('DEBUG - Testando conexão direta com Supabase...');
      
      // Teste direto: Contratos ativos
      const { data: contratosTest, error: contratosError } = await supabase
        .from('contratos')
        .select('*')
        .eq('status', 'ativo')
        .order('nome', { ascending: true });
      
      console.log('DEBUG - Teste direto contratos:', { data: contratosTest, error: contratosError });
      
      // Teste direto: Todas as bases
      const { data: todasBasesTest, error: todasBasesError } = await supabase
        .from('bases')
        .select('*')
        .order('nome', { ascending: true });
      
      console.log('DEBUG - Todas as bases:', { data: todasBasesTest, error: todasBasesError });

      // Teste direto: Bases com filtro boolean
      const { data: basesBooleanTest, error: basesBooleanError } = await supabase
        .from('bases')
        .select('*')
        .eq('ativa', true)
        .order('nome', { ascending: true });
      
      console.log('DEBUG - Bases filtro boolean:', { data: basesBooleanTest, error: basesBooleanError });

      // Teste direto: Bases com filtro string
      const { data: basesStringTest, error: basesStringError } = await supabase
        .from('bases')
        .select('*')
        .eq('ativa', 'true')
        .order('nome', { ascending: true });
      
      console.log('DEBUG - Bases filtro string:', { data: basesStringTest, error: basesStringError });
      
      // Carregar dados em paralelo
      const [
        usuariosResult,
        contratosResult,
        basesResult,
        usuariosContratosResult,
        usuariosBasesResult
      ] = await Promise.all([
        supabase.from('usuarios').select('id, nome, matricula, email, departamento, cargo').order('nome'),
        contratoService.getContratosAtivos(),
        baseService.getBasesAtivas(),
        supabase.from('usuario_contratos').select('*, contrato:contratos(id, nome, codigo)').eq('ativo', true),
        supabase.from('usuario_bases').select('*, base:bases(id, nome, codigo, cidade, estado)').eq('ativo', true)
      ]);

      // Extract data and errors from results
      const { data: usuariosData, error: usuariosError } = usuariosResult;
      const contratosData = contratosResult; // This is already the data array
      const basesData = basesResult; // This is already the data array
      const { data: usuariosContratosData, error: usuariosContratosError } = usuariosContratosResult;
      const { data: usuariosBasesData, error: usuariosBasesError } = usuariosBasesResult;

      if (usuariosError) throw usuariosError;
      if (usuariosContratosError) throw usuariosContratosError;
      if (usuariosBasesError) throw usuariosBasesError;

      setUsuarios(usuariosData || []);
      setContratos(contratosData || []);
      setBases(basesData || []);
      setUsuariosContratos(usuariosContratosData || []);
      setUsuariosBases(usuariosBasesData || []);

      // Debug logs detalhados
      console.log('DADOS CARREGADOS:');
      console.log('Usuarios:', usuariosData?.length || 0, usuariosData);
      console.log('Contratos (service):', contratosData?.length || 0, contratosData);
      console.log('Bases (service):', basesData?.length || 0, basesData);
      console.log('UsuariosContratos:', usuariosContratosData?.length || 0);
      console.log('UsuariosBases:', usuariosBasesData?.length || 0);
      
      // Debug do estado após setters
      setTimeout(() => {
        console.log('ESTADO APOS SETTERS:');
        console.log('contratos state:', contratos.length, contratos);
        console.log('bases state:', bases.length, bases);
      }, 100);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsuarios = usuarios.filter((usuario) => {
    return usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getUserContratos = (usuarioId: string) => {
    return usuariosContratos
      .filter(uc => uc.usuario_id === usuarioId)
      .map(uc => uc.contrato);
  };

  const getUserBases = (usuarioId: string) => {
    return usuariosBases
      .filter(ub => ub.usuario_id === usuarioId)
      .map(ub => ub.base);
  };

  const handleUpdateUserContratos = async (usuarioId: string, contratoIds: string[]) => {
    try {
      setUpdating(true);

      // Desativar contratos existentes
      await supabase
        .from('usuario_contratos')
        .update({ ativo: false })
        .eq('usuario_id', usuarioId);

      // Adicionar novos contratos
      if (contratoIds.length > 0) {
        const newContratos = contratoIds.map(contratoId => ({
          usuario_id: usuarioId,
          contrato_id: contratoId,
          perfil_contrato: 'operador',
          data_inicio: new Date().toISOString().split('T')[0],
          ativo: true
        }));

        const { error } = await supabase
          .from('usuario_contratos')
          .upsert(newContratos, { onConflict: 'usuario_id,contrato_id' });

        if (error) throw error;
      }

      await loadData();
      setMessage({ type: 'success', text: 'Contratos atualizados com sucesso!' });
    } catch (error) {
      console.error('Erro ao atualizar contratos:', error);
      setMessage({ type: 'error', text: 'Erro ao atualizar contratos' });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateUserBases = async (usuarioId: string, baseIds: string[]) => {
    try {
      setUpdating(true);
      console.log('🔄 Iniciando atualização de bases para usuário:', usuarioId);
      console.log('🔄 Bases a serem atribuídas:', baseIds);

      // Validar se o usuário existe
      const { data: existingUser, error: userValidationError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', usuarioId)
        .single();

      if (userValidationError) {
        console.error('❌ Erro ao validar usuário:', userValidationError);
        throw new Error(`Usuário não encontrado: ${userValidationError.message}`);
      }

      if (!existingUser) {
        throw new Error(`Usuário com ID ${usuarioId} não encontrado`);
      }

      // 1. BUSCAR BASES ATUAIS DO USUÁRIO
      console.log('🔄 Buscando bases atuais do usuário...');
      const { data: currentBases, error: currentBasesError } = await supabase
        .from('usuario_bases')
        .select('base_id')
        .eq('usuario_id', usuarioId)
        .eq('ativo', true);

      if (currentBasesError) {
        console.error('❌ Erro ao buscar bases atuais:', currentBasesError);
        throw new Error(`Erro ao buscar bases atuais: ${currentBasesError.message}`);
      }

      const currentBaseIds = currentBases?.map(b => b.base_id) || [];
      console.log('🔄 Bases atuais:', currentBaseIds);

      // 2. IDENTIFICAR BASES PARA ADICIONAR E REMOVER
      const basesToAdd = baseIds.filter(baseId => !currentBaseIds.includes(baseId));
      const basesToRemove = currentBaseIds.filter(baseId => !baseIds.includes(baseId));

      console.log('🔄 Bases para adicionar:', basesToAdd);
      console.log('🔄 Bases para remover:', basesToRemove);

      // 3. REMOVER BASES NÃO SELECIONADAS
      if (basesToRemove.length > 0) {
        console.log('🔄 Removendo bases não selecionadas...');
        const { error: removeError } = await supabase
          .from('usuario_bases')
          .update({ ativo: false })
          .eq('usuario_id', usuarioId)
          .in('base_id', basesToRemove);

        if (removeError) {
          console.error('❌ Erro ao remover bases:', removeError);
          throw new Error(`Erro ao remover bases: ${removeError.message}`);
        }
        console.log('✅ Bases removidas com sucesso');
      }

      // 4. ADICIONAR NOVAS BASES
      if (basesToAdd.length > 0) {
        console.log('🔄 Adicionando novas bases...');
        
        // Validar se as bases existem
        const { data: existingBases, error: validationError } = await supabase
          .from('bases')
          .select('id')
          .in('id', basesToAdd);

        if (validationError) {
          console.error('❌ Erro ao validar bases:', validationError);
          throw new Error(`Erro ao validar bases: ${validationError.message}`);
        }

        const validBaseIds = existingBases?.map(b => b.id) || [];
        const invalidBaseIds = basesToAdd.filter(id => !validBaseIds.includes(id));

        if (invalidBaseIds.length > 0) {
          console.error('❌ Bases inválidas encontradas:', invalidBaseIds);
          throw new Error(`Bases não encontradas: ${invalidBaseIds.join(', ')}`);
        }

        // Preparar dados para inserção
        const basesToInsert = validBaseIds.map(baseId => ({
          usuario_id: usuarioId,
          base_id: baseId,
          tipo_acesso: 'total' as const,
          data_inicio: new Date().toISOString().split('T')[0],
          ativo: true
        }));

        console.log('🔄 Inserindo novas bases:', basesToInsert);

        // Inserir novas bases
        const { error: insertError } = await supabase
          .from('usuario_bases')
          .insert(basesToInsert);

        if (insertError) {
          console.error('❌ Erro ao inserir bases:', insertError);
          throw new Error(`Erro ao inserir bases: ${insertError.message}`);
        }
        console.log('✅ Bases adicionadas com sucesso');
      }

      console.log('✅ Bases atualizadas com sucesso, recarregando dados...');
      await loadData();
      setMessage({ type: 'success', text: 'Bases atualizadas com sucesso!' });
    } catch (error) {
      console.error('Erro ao atualizar bases:', error);
      console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
          ? error 
          : 'Erro desconhecido ao atualizar bases';
          
      setMessage({ 
        type: 'error', 
        text: `Erro ao atualizar bases: ${errorMessage}` 
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkAssignContrato = async () => {
    if (!selectedContrato) return;

    try {
      setUpdating(true);
      const filteredUserIds = filteredUsuarios.map(u => u.id);
      
      for (const userId of filteredUserIds) {
        const existingContratos = getUserContratos(userId).map(c => c?.id).filter(Boolean);
        if (selectedContrato && !existingContratos.includes(selectedContrato)) {
          await handleUpdateUserContratos(userId, [...existingContratos.filter(Boolean) as string[], selectedContrato!]);
        }
      }

      setMessage({ type: 'success', text: `Contrato atribuído a ${filteredUserIds.length} usuários!` });
    } catch (error) {
      console.error('Erro na atribuição em massa:', error);
      setMessage({ type: 'error', text: 'Erro na atribuição em massa' });
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkAssignBase = async () => {
    if (!selectedBase) return;

    try {
      setUpdating(true);
      const filteredUserIds = filteredUsuarios.map(u => u.id);
      
      for (const userId of filteredUserIds) {
        const existingBases = getUserBases(userId).map(b => b?.id).filter(Boolean);
        if (selectedBase && !existingBases.includes(selectedBase)) {
          await handleUpdateUserBases(userId, [...existingBases.filter(Boolean) as string[], selectedBase!]);
        }
      }

      setMessage({ type: 'success', text: `Base atribuída a ${filteredUserIds.length} usuários!` });
    } catch (error) {
      console.error('Erro na atribuição em massa:', error);
      setMessage({ type: 'error', text: 'Erro na atribuição em massa' });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Carregando dados...</span>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredAccessLevel={["admin"]}>
      <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestão de Contratos e Bases</h1>
        <p className="text-muted-foreground">
          Gerencie a associação de usuários com contratos e bases físicas
        </p>
      </div>

      {message && (
        <Alert className={`mb-4 ${message.type === 'error' ? 'border-red-200' : message.type === 'success' ? 'border-green-200' : 'border-blue-200'}`}>
          {message.type === 'error' && <XCircle className="h-4 w-4" />}
          {message.type === 'success' && <CheckCircle className="h-4 w-4" />}
          {message.type === 'info' && <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contratos" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Contratos (Regiões)
          </TabsTrigger>
          <TabsTrigger value="bases" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Bases (Locais Físicos)
          </TabsTrigger>
        </TabsList>

        {/* Filtros e Busca */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Filtros e Busca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Buscar Usuário</Label>
                <Input
                  id="search"
                  placeholder="Nome, matrícula ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {activeTab === 'contratos' && (
                <>
                  <div>
                    <Label htmlFor="contrato-select">Contrato para Atribuição</Label>
                    <Select value={selectedContrato} onValueChange={setSelectedContrato}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          console.log('Renderizando select contratos - Length:', contratos.length, 'Data:', contratos);
                          return contratos.length === 0 ? (
                            <SelectItem value="no-data" disabled>
                              Nenhum contrato encontrado ({contratos.length} contratos)
                            </SelectItem>
                          ) : (
                            contratos.map(contrato => (
                              <SelectItem key={contrato.id} value={contrato.id}>
                                {contrato.nome} ({contrato.codigo})
                              </SelectItem>
                            ))
                          );
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleBulkAssignContrato}
                      disabled={!selectedContrato || updating}
                    >
                      {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Atribuir a Todos Filtrados
                    </Button>
                  </div>
                </>
              )}

              {activeTab === 'bases' && (
                <>
                  <div>
                    <Label htmlFor="base-select">Base para Atribuição</Label>
                    <Select value={selectedBase} onValueChange={setSelectedBase}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma base" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          console.log('Renderizando select bases - Length:', bases.length, 'Data:', bases);
                          return bases.length === 0 ? (
                            <SelectItem value="no-data" disabled>
                              Nenhuma base encontrada ({bases.length} bases)
                            </SelectItem>
                          ) : (
                            bases.map(base => (
                              <SelectItem key={base.id} value={base.id}>
                                {base.nome} ({base.codigo})
                                {base.contrato && ` - ${base.contrato.nome}`}
                              </SelectItem>
                            ))
                          );
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleBulkAssignBase}
                      disabled={!selectedBase || updating}
                    >
                      {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Atribuir a Todos Filtrados
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <TabsContent value="contratos" className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            <strong>{filteredUsuarios.length}</strong> usuários encontrados | 
            <strong> {contratos.length}</strong> contratos disponíveis
          </div>
          
          {filteredUsuarios.map(usuario => (
            <Card key={usuario.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    <span>{usuario.nome}</span>
                    <Badge variant="outline" className="ml-2">
                      {usuario.matricula}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {usuario.departamento} - {usuario.cargo}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Contratos Atuais:</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getUserContratos(usuario.id).map(contrato => (
                        contrato && (
                          <Badge key={contrato.id} variant="secondary">
                            {contrato.nome} ({contrato.codigo})
                          </Badge>
                        )
                      ))}
                      {getUserContratos(usuario.id).length === 0 && (
                        <span className="text-sm text-muted-foreground">Nenhum contrato atribuído</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Atribuir Contratos:</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {contratos.map(contrato => {
                        const isAssigned = getUserContratos(usuario.id).some(c => c?.id === contrato.id);
                        return (
                          <div key={contrato.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${usuario.id}-${contrato.id}`}
                              checked={isAssigned}
                              onCheckedChange={(checked) => {
                                const currentContratos = getUserContratos(usuario.id).map(c => c?.id).filter(Boolean);
                                const newContratos = checked 
                                  ? [...currentContratos, contrato.id]
                                  : currentContratos.filter(id => id !== contrato.id);
                                handleUpdateUserContratos(usuario.id, newContratos.filter((id): id is string => Boolean(id)));
                              }}
                            />
                            <Label 
                              htmlFor={`${usuario.id}-${contrato.id}`}
                              className="text-sm cursor-pointer"
                            >
                              {contrato.nome}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="bases" className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            <strong>{filteredUsuarios.length}</strong> usuários encontrados | 
            <strong> {bases.length}</strong> bases disponíveis
          </div>
          
          {filteredUsuarios.map(usuario => (
            <Card key={usuario.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    <span>{usuario.nome}</span>
                    <Badge variant="outline" className="ml-2">
                      {usuario.matricula}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {usuario.departamento} - {usuario.cargo}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Bases Atuais:</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getUserBases(usuario.id).map(base => (
                        base && (
                          <Badge key={base.id} variant="secondary">
                            {base.nome} ({base.codigo})
                            {base.cidade && ` - ${base.cidade}`}
                          </Badge>
                        )
                      ))}
                      {getUserBases(usuario.id).length === 0 && (
                        <span className="text-sm text-muted-foreground">Nenhuma base atribuída</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Atribuir Bases:</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {bases.map(base => {
                        const isAssigned = getUserBases(usuario.id).some(b => b?.id === base.id);
                        return (
                          <div key={base.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${usuario.id}-${base.id}`}
                              checked={isAssigned}
                              onCheckedChange={(checked) => {
                                const currentBases = getUserBases(usuario.id).map(b => b?.id).filter(Boolean);
                                const newBases = checked 
                                  ? [...currentBases, base.id]
                                  : currentBases.filter(id => id !== base.id);
                                handleUpdateUserBases(usuario.id, newBases.filter((id): id is string => Boolean(id)));
                              }}
                            />
                            <Label 
                              htmlFor={`${usuario.id}-${base.id}`}
                              className="text-sm cursor-pointer"
                            >
                              {base.nome}
                              {base.contrato && (
                                <span className="text-muted-foreground ml-1">
                                  ({base.contrato.nome})
                                </span>
                              )}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
    </ProtectedRoute>
  );
}
