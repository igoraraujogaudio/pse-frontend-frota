'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShieldCheckIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  LinkIcon as HeroLinkIcon,
} from '@heroicons/react/24/outline';
import { Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { filterCargos, getCargoSummary, enrichCargosWithPerfis } from '@/utils/cargoProfileUtils';
import LinkProfileDialog from './LinkProfileDialog';
import UnlinkProfileDialog from './UnlinkProfileDialog';
import ApplyPermissionsDialog from './ApplyPermissionsDialog';
import type { Cargo, CargoComPerfil } from '@/types/cargos';
import type { PerfilAcesso, PerfilFuncionalidadesPadrao } from '@/types/permissions';

interface CargoProfileManagerProps {
  perfisAcesso: PerfilAcesso[];
  perfilFuncionalidadesPadrao: PerfilFuncionalidadesPadrao[];
}

export default function CargoProfileManager({
  perfisAcesso,
  perfilFuncionalidadesPadrao,
}: CargoProfileManagerProps) {
  const { hasPermission } = useModularPermissions();

  // Permission check
  const canManageCargos = hasPermission(PERMISSION_CODES.FUNCIONARIOS.GERENCIAR_CARGOS);

  // Data states
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargo, setSelectedCargo] = useState<CargoComPerfil | null>(null);

  // Dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogCargo, setLinkDialogCargo] = useState<Cargo | null>(null);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [unlinkDialogCargo, setUnlinkDialogCargo] = useState<Cargo | null>(null);
  const [unlinkPerfilNome, setUnlinkPerfilNome] = useState('');
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyDialogCargo, setApplyDialogCargo] = useState<Cargo | null>(null);
  const [applyPerfilId, setApplyPerfilId] = useState('');
  const [applyPerfilNome, setApplyPerfilNome] = useState('');

  // Derived data
  const cargosComPerfil = useMemo(
    () => enrichCargosWithPerfis(cargos, perfisAcesso),
    [cargos, perfisAcesso]
  );

  const filteredCargos = useMemo(
    () => filterCargos(cargosComPerfil, searchTerm),
    [cargosComPerfil, searchTerm]
  );

  const summary = useMemo(
    () => getCargoSummary(cargosComPerfil),
    [cargosComPerfil]
  );

  // Fetch cargos on mount
  useEffect(() => {
    if (canManageCargos) {
      fetchCargos();
    }
  }, [canManageCargos]);

  const fetchCargos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cargos');
      if (!response.ok) {
        throw new Error(`Erro ao carregar cargos (${response.status})`);
      }
      const data = await response.json();
      setCargos(data.cargos || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro de conexão. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Refresh local list after link/unlink operations
  const handleLinkSuccess = () => {
    fetchCargos();
    // Update selected cargo if it was the one being modified
    if (linkDialogCargo && selectedCargo?.id === linkDialogCargo.id) {
      setSelectedCargo(null);
    }
  };

  const handleUnlinkSuccess = () => {
    fetchCargos();
    if (unlinkDialogCargo && selectedCargo?.id === unlinkDialogCargo.id) {
      setSelectedCargo(null);
    }
  };

  const handleApplySuccess = () => {
    // No need to refresh cargos list, just close dialog
  };

  // Action handlers
  const openLinkDialog = (cargo: CargoComPerfil) => {
    setLinkDialogCargo(cargo);
    setLinkDialogOpen(true);
  };

  const openUnlinkDialog = (cargo: CargoComPerfil) => {
    setUnlinkDialogCargo(cargo);
    setUnlinkPerfilNome(cargo.perfil?.nome || '');
    setUnlinkDialogOpen(true);
  };

  const openApplyDialog = (cargo: CargoComPerfil) => {
    if (!cargo.perfil_acesso_id || !cargo.perfil) return;
    setApplyDialogCargo(cargo);
    setApplyPerfilId(cargo.perfil_acesso_id);
    setApplyPerfilNome(cargo.perfil.nome);
    setApplyDialogOpen(true);
  };

  // Get permission counts for a profile
  const getPerfilPermissionCounts = (perfilId: string) => {
    const perfilFuncs = perfilFuncionalidadesPadrao.filter(
      (pf) => pf.perfil_id === perfilId
    );
    const concedidas = perfilFuncs.filter((pf) => pf.concedido).length;
    const negadas = perfilFuncs.filter((pf) => !pf.concedido).length;
    return { concedidas, negadas };
  };

  // Access denied
  if (!canManageCargos) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Acesso Negado</h3>
          <p className="text-gray-600">
            Você não possui permissão para gerenciar perfis por cargo.
            É necessária a permissão <code className="text-sm bg-gray-100 px-1 rounded">funcionarios.site.gerenciar_cargos</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando cargos...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar cargos</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchCargos} variant="outline">
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📋 Perfis por Cargo</h2>
          <p className="text-gray-600 mt-1">
            Gerencie a vinculação entre cargos e perfis de acesso
          </p>
        </div>
        <Button onClick={fetchCargos} variant="outline" disabled={loading}>
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{summary.total}</div>
            <p className="text-sm text-gray-600">Total de Cargos</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{summary.comPerfil}</div>
            <p className="text-sm text-gray-600">Com Perfil</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{summary.semPerfil}</div>
            <p className="text-sm text-gray-600">Sem Perfil</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nome do cargo ou perfil..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Split view: List + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cargo List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              Cargos ({filteredCargos.length})
            </CardTitle>
            <CardDescription>
              Selecione um cargo para ver detalhes do perfil vinculado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredCargos.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhum cargo encontrado
                </p>
              ) : (
                filteredCargos.map((cargo) => (
                  <div
                    key={cargo.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedCargo?.id === cargo.id
                        ? 'bg-blue-50 border-blue-400'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedCargo(cargo)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm">{cargo.nome}</h3>
                      <Badge variant="outline" className="text-xs">
                        {cargo.nivel_acesso}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      {cargo.perfil ? (
                        <div className="flex items-center gap-2">
                          {cargo.perfil.cor && (
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ backgroundColor: cargo.perfil.cor }}
                            />
                          )}
                          <span className="text-sm text-gray-700">{cargo.perfil.nome}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Sem perfil</span>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        title="Editar vinculação"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLinkDialog(cargo);
                        }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Vincular
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        title="Remover vinculação"
                        disabled={!cargo.perfil_acesso_id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openUnlinkDialog(cargo);
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Desvincular
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        title={
                          cargo.perfil_acesso_id
                            ? 'Aplicar permissões do perfil aos usuários deste cargo'
                            : 'Vincule um perfil primeiro para aplicar permissões'
                        }
                        disabled={!cargo.perfil_acesso_id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openApplyDialog(cargo);
                        }}
                      >
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Aplicar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details Panel */}
        <div className="lg:col-span-2">
          {selectedCargo ? (
            selectedCargo.perfil ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <HeroLinkIcon className="h-5 w-5" />
                        Perfil: {selectedCargo.perfil.nome}
                      </CardTitle>
                      <CardDescription>
                        Detalhes do perfil vinculado ao cargo <strong>{selectedCargo.nome}</strong>
                      </CardDescription>
                    </div>
                    {selectedCargo.perfil.cor && (
                      <span
                        className="inline-block h-6 w-6 rounded-full border"
                        style={{ backgroundColor: selectedCargo.perfil.cor }}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Nome</p>
                        <p className="font-medium">{selectedCargo.perfil.nome}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Código</p>
                        <p className="font-medium">{selectedCargo.perfil.codigo}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Nível Hierárquico</p>
                        <Badge variant="outline">{selectedCargo.perfil.nivel_hierarquia}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Cor</p>
                        <div className="flex items-center gap-2">
                          {selectedCargo.perfil.cor ? (
                            <>
                              <span
                                className="inline-block h-4 w-4 rounded-full border"
                                style={{ backgroundColor: selectedCargo.perfil.cor }}
                              />
                              <span className="text-sm">{selectedCargo.perfil.cor}</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">Sem cor definida</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedCargo.perfil.descricao && (
                      <div>
                        <p className="text-sm text-gray-500">Descrição</p>
                        <p className="text-sm text-gray-700">{selectedCargo.perfil.descricao}</p>
                      </div>
                    )}

                    {/* Permission counts */}
                    {(() => {
                      const counts = getPerfilPermissionCounts(selectedCargo.perfil!.id);
                      return (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Permissões Padrão</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                              <div className="text-xl font-bold text-green-700">{counts.concedidas}</div>
                              <p className="text-xs text-green-600">Concedidas</p>
                            </div>
                            <div className="text-center p-3 bg-red-50 rounded-lg">
                              <div className="text-xl font-bold text-red-700">{counts.negadas}</div>
                              <p className="text-xs text-red-600">Negadas</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <HeroLinkIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Sem Perfil Vinculado</h3>
                  <p className="text-gray-600 mb-4">
                    O cargo <strong>{selectedCargo.nome}</strong> não possui um perfil de acesso vinculado.
                    Vincule um perfil para definir as permissões padrão dos usuários com este cargo.
                  </p>
                  <Button onClick={() => openLinkDialog(selectedCargo)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Vincular Perfil
                  </Button>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecione um Cargo</h3>
                <p className="text-gray-600">
                  Escolha um cargo na lista ao lado para visualizar os detalhes do perfil de acesso vinculado
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <LinkProfileDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        cargo={linkDialogCargo}
        perfisAcesso={perfisAcesso}
        onSuccess={handleLinkSuccess}
      />

      <UnlinkProfileDialog
        open={unlinkDialogOpen}
        onOpenChange={setUnlinkDialogOpen}
        cargo={unlinkDialogCargo}
        perfilNome={unlinkPerfilNome}
        onSuccess={handleUnlinkSuccess}
      />

      <ApplyPermissionsDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        cargo={applyDialogCargo}
        perfilId={applyPerfilId}
        perfilNome={applyPerfilNome}
        onSuccess={handleApplySuccess}
      />
    </div>
  );
}
