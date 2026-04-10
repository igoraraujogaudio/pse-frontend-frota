'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ObraProgramacaoEquipe,
  ObraProgramacaoEquipeService,
  StatusExecucao,
  STATUS_EXECUCAO_LABELS,
  STATUS_EXECUCAO_COLORS,
} from '@/services/obraProgramacaoEquipeService';
import { ObraHistoricoService } from '@/services/obraHistoricoService';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, XCircle, AlertTriangle, Clock, ArrowRightLeft } from 'lucide-react';

const STATUS_OPTIONS: StatusExecucao[] = ['PROG', 'EXEC', 'CANC', 'PARP', 'PANP'];

const STATUS_ICONS: Record<StatusExecucao, React.ReactNode> = {
  PROG: <Clock className="h-4 w-4" />,
  EXEC: <CheckCircle2 className="h-4 w-4" />,
  CANC: <XCircle className="h-4 w-4" />,
  PARP: <AlertTriangle className="h-4 w-4" />,
  PANP: <AlertTriangle className="h-4 w-4" />,
};

interface StatusExecucaoModalProps {
  programacao: ObraProgramacaoEquipe | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function RetornoExecucaoModal({ programacao, isOpen, onClose, onSaved }: StatusExecucaoModalProps) {
  const { hasPermission } = useModularPermissions();
  const podeAlterar = hasPermission(PERMISSION_CODES.OBRAS_MANUTENCAO.RETORNO_EXECUCAO);
  const { user } = useAuth();

  const [status, setStatus] = useState<StatusExecucao>('PROG');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen && programacao) {
      setStatus(programacao.statusExecucao ?? 'PROG');
      setMotivo(programacao.motivoStatus ?? '');
    }
  }, [isOpen, programacao]);

  if (!programacao) return null;

  const motivoObrigatorio = status !== 'EXEC';
  const podeConfirmar = podeAlterar && (status === 'EXEC' || motivo.trim().length > 0);
  const statusMudou = status !== (programacao.statusExecucao ?? 'PROG') || motivo !== (programacao.motivoStatus ?? '');

  const handleSalvar = async () => {
    if (!programacao.id || !podeConfirmar) return;
    setSalvando(true);
    try {
      const statusAnterior = programacao.statusExecucao ?? 'PROG';
      await ObraProgramacaoEquipeService.atualizarStatusExecucao(
        programacao.id,
        status,
        status === 'EXEC' ? null : motivo.trim() || null,
        user?.id
      );

      // Log no histórico da obra
      if (programacao.obraId) {
        await ObraHistoricoService.addLog({
          obraId: programacao.obraId,
          tipo: 'apontamento',
          descricao: `Retorno de execução: ${STATUS_EXECUCAO_LABELS[statusAnterior]} → ${STATUS_EXECUCAO_LABELS[status]}${status !== 'EXEC' && motivo.trim() ? ` — Motivo: ${motivo.trim()}` : ''}`,
          statusAnterior,
          statusNovo: status,
          usuarioId: user?.id ?? null,
          usuarioNome: user?.nome ?? null,
          metadata: {
            programacaoId: programacao.id,
            equipeId: programacao.equipeId,
            equipeNome: programacao.equipe?.nome ?? null,
            data: programacao.data,
            etapa: programacao.etapa,
            motivo: status !== 'EXEC' ? motivo.trim() : null,
          },
        });
      }

      onSaved?.();
      onClose();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-4 w-4 text-blue-600" />
            Retorno de Execução
          </DialogTitle>
          <DialogDescription className="text-xs">
            {programacao.data} — Etapa {programacao.etapa}
            {programacao.equipe?.nome && <> · <span className="font-medium text-blue-700">{programacao.equipe.nome}</span></>}
          </DialogDescription>
        </DialogHeader>

        {/* Status atual */}
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          Status atual:
          <Badge className={`${STATUS_EXECUCAO_COLORS[programacao.statusExecucao ?? 'PROG']} text-[10px] px-1.5 py-0 border-0`}>
            {STATUS_EXECUCAO_LABELS[programacao.statusExecucao ?? 'PROG']}
          </Badge>
          {programacao.motivoStatus && (
            <span className="text-gray-400 italic ml-1">— {programacao.motivoStatus}</span>
          )}
        </div>

        {/* Seleção de novo status */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Novo status</label>
          <div className="grid grid-cols-1 gap-1.5">
            {STATUS_OPTIONS.map(opt => {
              const selected = status === opt;
              return (
                <button
                  key={opt}
                  onClick={() => { setStatus(opt); if (opt === 'EXEC') setMotivo(''); }}
                  disabled={!podeAlterar}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 text-left transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    selected
                      ? `${STATUS_EXECUCAO_COLORS[opt]} border-current font-semibold`
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {STATUS_ICONS[opt]}
                  <span>{STATUS_EXECUCAO_LABELS[opt]}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Motivo — obrigatório quando status != EXEC */}
        {motivoObrigatorio && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder={`Informe o motivo para "${STATUS_EXECUCAO_LABELS[status]}"...`}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {motivo.trim().length === 0 && (
              <p className="text-xs text-red-500">Motivo obrigatório</p>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!podeConfirmar || !statusMudou || salvando}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSalvar}
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
