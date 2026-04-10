'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ObraApontamentoWebService,
  ApontamentoExecucaoWeb,
  StatusApontamento,
} from '@/services/obraApontamentoWebService';
import { ObraHistoricoService } from '@/services/obraHistoricoService';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  HardHat,
  Loader2,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';

const STATUS_BADGE: Record<StatusApontamento, { className: string; icon: React.ReactNode; label: string }> = {
  pendente: { className: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" />, label: 'Pendente' },
  aprovado: { className: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Aprovado' },
  reprovado: { className: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" />, label: 'Reprovado' },
};

const TIPO_LABELS: Record<string, string> = {
  reserva_corrigida: 'Corrigido',
  reserva_original: 'Original',
  avulso: 'Avulso',
};

interface Props {
  obraId: string;
  numeroProjeto: string;
  isOpen: boolean;
  onClose: () => void;
  onAprovado?: () => void;
}

export function AprovacaoMedicaoModal({ obraId, numeroProjeto, isOpen, onClose, onAprovado }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [apontamentos, setApontamentos] = useState<ApontamentoExecucaoWeb[]>([]);
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [aprovandoTodos, setAprovandoTodos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ObraApontamentoWebService.getByObra(obraId);
      setApontamentos(data);
    } catch (e) {
      console.error('Erro ao carregar apontamentos:', e);
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const pendentes = apontamentos.filter(a => a.status === 'pendente');
  const temPendentes = pendentes.length > 0;

  const handleAprovar = async (apont: ApontamentoExecucaoWeb) => {
    setAprovando(apont.id);
    try {
      await ObraApontamentoWebService.aprovar(apont.id);
      await ObraHistoricoService.addLog({
        obraId,
        tipo: 'apontamento',
        descricao: `Apontamento aprovado — ${apont.programacao?.data ?? ''} Etapa ${apont.programacao?.etapa ?? ''} (${apont.materiais.length} mat, ${apont.maoDeObra.length} MO)`,
        usuarioId: user?.id ?? null,
        usuarioNome: user?.nome ?? null,
        metadata: { apontamentoId: apont.id },
      }).catch(() => {});
      await load();
      onAprovado?.();
    } catch (e) {
      alert('Erro ao aprovar apontamento.');
      console.error(e);
    } finally {
      setAprovando(null);
    }
  };

  const handleReprovar = async (apont: ApontamentoExecucaoWeb) => {
    setAprovando(apont.id);
    try {
      await ObraApontamentoWebService.reprovar(apont.id);
      await ObraHistoricoService.addLog({
        obraId,
        tipo: 'apontamento',
        descricao: `Apontamento reprovado — ${apont.programacao?.data ?? ''} Etapa ${apont.programacao?.etapa ?? ''}`,
        usuarioId: user?.id ?? null,
        usuarioNome: user?.nome ?? null,
        metadata: { apontamentoId: apont.id },
      }).catch(() => {});
      await load();
    } catch (e) {
      alert('Erro ao reprovar apontamento.');
      console.error(e);
    } finally {
      setAprovando(null);
    }
  };

  const handleAprovarTodos = async () => {
    if (!confirm(`Aprovar todos os ${pendentes.length} apontamento(s) pendente(s)?`)) return;
    setAprovandoTodos(true);
    try {
      const count = await ObraApontamentoWebService.aprovarTodos(obraId);
      await ObraHistoricoService.addLog({
        obraId,
        tipo: 'apontamento',
        descricao: `${count} apontamento(s) aprovado(s) em lote`,
        usuarioId: user?.id ?? null,
        usuarioNome: user?.nome ?? null,
      }).catch(() => {});
      await load();
      onAprovado?.();
    } catch (e) {
      alert('Erro ao aprovar apontamentos.');
      console.error(e);
    } finally {
      setAprovandoTodos(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCheck className="h-5 w-5 text-purple-600" />
            Aprovação de Medição — {numeroProjeto}
          </DialogTitle>
          <DialogDescription>
            Revise e aprove os apontamentos de execução (materiais e mão de obra utilizados).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando apontamentos...
          </div>
        ) : apontamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Package className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum apontamento de execução encontrado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Botão aprovar todos */}
            {temPendentes && (
              <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">
                    {pendentes.length} apontamento(s) pendente(s) de aprovação
                  </span>
                </div>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={aprovandoTodos}
                  onClick={handleAprovarTodos}
                >
                  {aprovandoTodos ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Aprovando...</>
                  ) : (
                    <><CheckCheck className="h-3.5 w-3.5 mr-1" /> Aprovar Todos</>
                  )}
                </Button>
              </div>
            )}

            {/* Lista de apontamentos */}
            {apontamentos.map(apont => {
              const badge = STATUS_BADGE[apont.status];
              const isProcessing = aprovando === apont.id;
              return (
                <Card key={apont.id} className={`${apont.status === 'pendente' ? 'border-yellow-300' : apont.status === 'aprovado' ? 'border-green-200' : 'border-red-200'}`}>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm font-semibold">
                          {apont.programacao?.data ?? '—'} — Etapa {apont.programacao?.etapa ?? '—'}
                        </CardTitle>
                        {apont.programacao?.equipeNome && (
                          <Badge variant="outline" className="text-xs">{apont.programacao.equipeNome}</Badge>
                        )}
                        <Badge className={`${badge.className} text-[10px] px-1.5 py-0 gap-0.5`}>
                          {badge.icon} {badge.label}
                        </Badge>
                        {apont.encarregadoNome && (
                          <span className="text-xs text-gray-400">por {apont.encarregadoNome}</span>
                        )}
                      </div>
                      {apont.status === 'pendente' && (
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                            disabled={isProcessing}
                            onClick={() => handleReprovar(apont)}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Reprovar
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                            disabled={isProcessing}
                            onClick={() => handleAprovar(apont)}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Aprovar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-3">
                    {/* Materiais usados */}
                    {apont.materiais.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                          <Package className="h-3 w-3" /> Materiais ({apont.materiais.length})
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs py-1">Descrição</TableHead>
                              <TableHead className="text-xs py-1 w-20 text-right">Qtd</TableHead>
                              <TableHead className="text-xs py-1 w-16">Unid.</TableHead>
                              <TableHead className="text-xs py-1 w-20">Tipo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {apont.materiais.map(mat => (
                              <TableRow key={mat.id}>
                                <TableCell className="text-xs py-1">{mat.descricao}</TableCell>
                                <TableCell className="text-xs py-1 text-right font-medium">{mat.quantidade}</TableCell>
                                <TableCell className="text-xs py-1 text-gray-500">{mat.unidade || '—'}</TableCell>
                                <TableCell className="text-xs py-1">
                                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${mat.tipo === 'avulso' ? 'border-orange-300 text-orange-700' : ''}`}>
                                    {TIPO_LABELS[mat.tipo] ?? mat.tipo}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Mão de obra usada */}
                    {apont.maoDeObra.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                          <HardHat className="h-3 w-3" /> Mão de Obra ({apont.maoDeObra.length})
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs py-1">Descrição</TableHead>
                              <TableHead className="text-xs py-1 w-20 text-right">Qtd</TableHead>
                              <TableHead className="text-xs py-1 w-20">Tipo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {apont.maoDeObra.map(mo => (
                              <TableRow key={mo.id}>
                                <TableCell className="text-xs py-1">{mo.descricao}</TableCell>
                                <TableCell className="text-xs py-1 text-right font-medium">{mo.quantidade}</TableCell>
                                <TableCell className="text-xs py-1">
                                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${mo.tipo === 'avulso' ? 'border-orange-300 text-orange-700' : ''}`}>
                                    {TIPO_LABELS[mo.tipo] ?? mo.tipo}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {apont.observacoes && (
                      <p className="text-xs text-gray-500 italic">Obs: {apont.observacoes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
