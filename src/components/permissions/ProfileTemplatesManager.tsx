'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  PlusIcon, 
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  DocumentDuplicateIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import type { GrupoPermissao, Funcionalidade } from '@/types/permissions';
import { permissionService } from '@/services/permissionService';

// interface NivelAcessoOption {
//   value: string;
//   label: string;
//   description: string;
// } // TODO: Use for access level options

interface Props {
  gruposPermissoes: GrupoPermissao[];
  funcionalidades: Funcionalidade[];
  onUpdate: () => void;
}

export default function ProfileTemplatesManager({ 
  gruposPermissoes, 
  funcionalidades, 
  onUpdate 
}: Props) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<GrupoPermissao | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    funcionalidadeIds: [] as string[]
  });
  const [loading, setLoading] = useState(false);

  // Templates pré-definidos (combos)
  const predefinedCombos = [
    {
      id: 'frota-almoxarifado',
      nome: 'Frota + Almoxarifado',
      descricao: 'Operador de frota com acesso básico ao almoxarifado',
      icon: '🚗📦',
      color: 'bg-blue-100 text-blue-800',
      funcionalidades: [
        'frota.visualizar_veiculos',
        'frota.visualizar_manutencoes',
        'almoxarifado.visualizar_estoque',
        'almoxarifado.visualizar_relatorios'
      ]
    },
    {
      id: 'supervisor-completo',
      nome: 'Supervisor Completo',
      descricao: 'Acesso supervisório a múltiplos módulos',
      icon: '👥🔧',
      color: 'bg-green-100 text-green-800',
      funcionalidades: [
        'equipes.visualizar',
        'equipes.editar',
        'equipes.gerenciar_membros',
        'frota.visualizar_veiculos',
        'frota.visualizar_manutencoes',
        'almoxarifado.visualizar_estoque',
        'almoxarifado.aprovar_requisicoes',
        'relatorios.gerar_basicos'
      ]
    },
    {
      id: 'portaria-relatorios',
      nome: 'Portaria + Relatórios',
      descricao: 'Controle de acesso com geração de relatórios',
      icon: '🏢📊',
      color: 'bg-orange-100 text-orange-800',
      funcionalidades: [
        'portaria.controlar_entrada',
        'portaria.controlar_saida',
        'portaria.visualizar_movimentacao',
        'portaria.gerenciar_chaves',
        'relatorios.gerar_basicos',
        'relatorios.exportar'
      ]
    }
  ];

  const handleCreateTemplate = async () => {
    if (!formData.nome.trim()) return;

    setLoading(true);
    try {
      const template = await permissionService.createGrupoPermissao({
        nome: formData.nome,
        descricao: formData.descricao,
        ativo: true
      });

      // Adicionar funcionalidades ao template
      for (const funcId of formData.funcionalidadeIds) {
        await permissionService.addFuncionalidadeToGrupo(template.id, funcId);
      }

      setFormData({ nome: '', descricao: '', funcionalidadeIds: [] });
      setIsCreateDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Erro ao criar template:', error);
      console.error('Detalhes do erro:', {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        formData: formData
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = async () => {
    if (!selectedTemplate || !formData.nome.trim()) return;

    setLoading(true);
    try {
      await permissionService.updateGrupoPermissao(selectedTemplate.id, {
        nome: formData.nome,
        descricao: formData.descricao
      });

      // TODO: Atualizar funcionalidades do template
      
      setFormData({ nome: '', descricao: '', funcionalidadeIds: [] });
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      onUpdate();
    } catch (error) {
      console.error('Erro ao editar template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      await permissionService.deleteGrupoPermissao(templateId);
      onUpdate();
    } catch (error) {
      console.error('Erro ao excluir template:', error);
    }
  };

  const handleApplyCombo = async (combo: { id: string; nome: string; descricao: string; icon: string; color: string; funcionalidades: string[] }) => {
    try {
      // Criar um template temporário para o combo
      const template = await permissionService.createGrupoPermissao({
        nome: `Combo: ${combo.nome}`,
        descricao: combo.descricao,
        ativo: true
      });

      // Adicionar funcionalidades ao template (apenas as que existem no sistema)
      const funcionalidadesExistentes = combo.funcionalidades.filter(funcCodigo => 
        funcionalidades.some(f => f.codigo === funcCodigo)
      );

      for (const funcCodigo of funcionalidadesExistentes) {
        const funcionalidade = funcionalidades.find(f => f.codigo === funcCodigo);
        if (funcionalidade) {
          await permissionService.addFuncionalidadeToGrupo(template.id, funcionalidade.id);
        }
      }

      // Notificar sucesso
      alert(`Combo "${combo.nome}" criado como template com ${funcionalidadesExistentes.length} funcionalidades!`);
      onUpdate();
    } catch (error) {
      console.error('Erro ao aplicar combo:', error);
      alert(`Erro ao aplicar combo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleDuplicateTemplate = async (template: GrupoPermissao) => {
    try {
      // Criar uma cópia do template
      const newTemplate = await permissionService.createGrupoPermissao({
        nome: `${template.nome} (Cópia)`,
        descricao: template.descricao || '',
        ativo: true
      });

      // Copiar funcionalidades
      if (template.grupo_funcionalidades) {
        for (const gf of template.grupo_funcionalidades) {
          await permissionService.addFuncionalidadeToGrupo(newTemplate.id, gf.funcionalidade_id);
        }
      }

      alert(`Template "${template.nome}" duplicado com sucesso!`);
      onUpdate();
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
      alert(`Erro ao duplicar template: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleApplyTemplate = async (template: GrupoPermissao) => {
    // TODO: Implementar seleção de usuários para aplicar o template
    alert(`Funcionalidade em desenvolvimento: Aplicar template "${template.nome}" a usuários selecionados`);
  };

  const openEditDialog = (template: GrupoPermissao) => {
    setSelectedTemplate(template);
    setFormData({
      nome: template.nome,
      descricao: template.descricao || '',
      funcionalidadeIds: template.grupo_funcionalidades?.map(gf => gf.funcionalidade_id) || []
    });
    setIsEditDialogOpen(true);
  };

  // Agrupar funcionalidades por módulo para seleção
  const funcionalidadesPorModulo = funcionalidades.reduce((acc, func) => {
    if (!acc[func.modulo]) {
      acc[func.modulo] = [];
    }
    acc[func.modulo].push(func);
    return acc;
  }, {} as Record<string, Funcionalidade[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5" />
                Templates e Combos de Permissões
              </CardTitle>
              <CardDescription>
                Crie e gerencie templates reutilizáveis de permissões
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Criar Template
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Combos Pré-definidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StarIcon className="h-5 w-5" />
            Combos Pré-configurados
          </CardTitle>
          <CardDescription>
            Combinações comuns de permissões prontas para uso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {predefinedCombos.map(combo => (
              <Card key={combo.id} className="border-2 border-dashed hover:border-solid transition-all">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="bg-gray-100 p-3 rounded-full w-fit mx-auto mb-3">
                      <span className="text-2xl">{combo.icon}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {combo.nome}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {combo.descricao}
                    </p>
                    <div className="space-y-2 text-xs text-gray-500 mb-4">
                      {combo.funcionalidades.slice(0, 3).map(func => (
                        <div key={func}>• {func}</div>
                      ))}
                      {combo.funcionalidades.length > 3 && (
                        <div>+ {combo.funcionalidades.length - 3} mais...</div>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleApplyCombo(combo)}
                    >
                      Aplicar Combo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Templates Personalizados */}
      <Card>
        <CardHeader>
          <CardTitle>Templates Personalizados</CardTitle>
          <CardDescription>
            Templates criados por você
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gruposPermissoes.map(template => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{template.nome}</h3>
                      {template.descricao && (
                        <p className="text-sm text-gray-600 mt-1">{template.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openEditDialog(template)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <Badge variant="outline">
                      {template.grupo_funcionalidades?.length || 0} funcionalidades
                    </Badge>
                    {template.ativo ? (
                      <Badge variant="default">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleDuplicateTemplate(template)}
                    >
                      <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                      Duplicar
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleApplyTemplate(template)}
                    >
                      Aplicar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog Criar Template */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Template</DialogTitle>
            <DialogDescription>
              Crie um template reutilizável de permissões
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome do Template</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Operador Frota Completo"
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva quando usar este template..."
              />
            </div>

            <div>
              <Label>Funcionalidades</Label>
              <div className="space-y-4 max-h-96 overflow-y-auto border rounded p-4">
                {Object.entries(funcionalidadesPorModulo).map(([modulo, funcs]) => (
                  <div key={modulo}>
                    <h4 className="font-medium text-sm mb-2 capitalize">
                      {modulo} ({funcs.length})
                    </h4>
                    <div className="space-y-2 pl-4">
                      {funcs.map(func => (
                        <div key={func.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={func.id}
                            checked={formData.funcionalidadeIds.includes(func.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  funcionalidadeIds: [...prev.funcionalidadeIds, func.id]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  funcionalidadeIds: prev.funcionalidadeIds.filter(id => id !== func.id)
                                }));
                              }
                            }}
                          />
                          <label htmlFor={func.id} className="text-sm font-medium">
                            {func.nome}
                          </label>
                          <Badge variant="outline" className="text-xs">
                            {func.categoria}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTemplate} disabled={loading}>
              {loading ? 'Criando...' : 'Criar Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Template */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>
              Edite as informações do template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-nome">Nome do Template</Label>
              <Input
                id="edit-nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="edit-descricao">Descrição</Label>
              <Textarea
                id="edit-descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditTemplate} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
