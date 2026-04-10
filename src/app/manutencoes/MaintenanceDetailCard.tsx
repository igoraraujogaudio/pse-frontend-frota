import React, { useEffect, useState } from 'react';
import { TruckIcon, CurrencyDollarIcon, WrenchScrewdriverIcon, DocumentTextIcon, UserIcon, ExclamationTriangleIcon, BuildingOffice2Icon, ClockIcon } from '@heroicons/react/24/outline';
import { Maintenance, MaintenanceAttachment } from '@/types';
import { userService } from '@/services/userService';
import { MaintenanceAttachmentManager } from '@/components/maintenance/MaintenanceAttachmentManager';
import { MaintenanceAttachmentService } from '@/services/maintenanceAttachmentService';

interface MaintenanceDetailCardProps {
  maintenance: Maintenance;
  expanded: boolean;
  onClose: () => void;
}

const statusFriendly: Record<string, string> = {
  pendente: 'Solicitado',
  aprovada: 'Aprovado',
  entregue: 'Entregue na oficina',
  em_orcamento: 'Orçamento informado',
  em_manutencao: 'Em manutenção',
  pronto_retirada: 'Pronto para retirada',
  retornado: 'Retornado',
  cancelada: 'Cancelado',
};

export default function MaintenanceDetailCard({ maintenance, expanded, onClose }: MaintenanceDetailCardProps) {
  const [solicitanteNome, setSolicitanteNome] = useState<string>('');
  const [aprovadorNome, setAprovadorNome] = useState<string>('');
  const [historicoNomes, setHistoricoNomes] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<MaintenanceAttachment[]>([]);

  useEffect(() => {
    async function fetchNomes() {
      if (maintenance.solicitante_id) {
        try {
          const user = await userService.getById(maintenance.solicitante_id);
          setSolicitanteNome(user.nome);
        } catch { setSolicitanteNome(maintenance.solicitante_id); }
      }
      if (maintenance.aprovador_id) {
        try {
          const user = await userService.getById(maintenance.aprovador_id);
          setAprovadorNome(user.nome);
        } catch { setAprovadorNome(maintenance.aprovador_id); }
      }
      // Buscar nomes do histórico
      if (Array.isArray(maintenance.historico)) {
        const ids = Array.from(new Set(
          maintenance.historico.map(ev => (typeof ev === 'object' && ev && 'usuario_id' in ev ? (ev as unknown as { usuario_id: string }).usuario_id : null)).filter(Boolean)
        ));
        const nomes: Record<string, string> = {};
        for (const id of ids) {
          if (id) {
            try {
              const user = await userService.getById(id);
              nomes[id] = user.nome;
            } catch {
              nomes[id] = id;
            }
          }
        }
        setHistoricoNomes(nomes);
      }
    }
    if (expanded) fetchNomes();
  }, [expanded, maintenance.solicitante_id, maintenance.aprovador_id, maintenance.historico]);

  // Carregar anexos do backend
  useEffect(() => {
    const loadAttachments = async () => {
      try {
        const data = await MaintenanceAttachmentService.getAttachmentsByMaintenance(maintenance.id);
        setAttachments(data);
      } catch (error) {
        console.error('Erro ao carregar anexos:', error);
        // Fallback para anexos antigos se existirem
        if (maintenance.anexos && Array.isArray(maintenance.anexos)) {
          setAttachments(maintenance.anexos);
        }
      }
    };

    if (expanded) {
      loadAttachments();
    }
  }, [maintenance.id, expanded, maintenance.anexos]);

  const handleAttachmentAdded = (attachment: MaintenanceAttachment) => {
    setAttachments(prev => [...prev, attachment]);
    // O upload já foi feito pelo serviço, apenas atualizar a UI
  };

  const handleAttachmentDeleted = (attachmentId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
    // A remoção já foi feita pelo serviço, apenas atualizar a UI
  };

  if (!expanded) return null;
  const vehicle = maintenance.veiculo;
  const workshop = maintenance.oficina;

  // Função para formatar data
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Timeline steps
  const baseSteps = [
    { label: 'Abertura', key: 'pendente', date: maintenance.criado_em },
    { label: 'Aprovada', key: 'aprovada', date: maintenance.aprovado_em },
    { label: 'Entregue', key: 'entregue', date: maintenance.entregue_em },
    { label: 'Orçamento', key: 'em_orcamento', date: maintenance.orcado_em },
    { label: 'Em manutenção', key: 'em_manutencao', date: maintenance.em_manutencao_em },
    { label: 'Pronto para retirada', key: 'pronto_retirada', date: maintenance.pronto_em },
    { label: 'Retornado', key: 'retornado', date: maintenance.retornado_em },
  ];
  const isCancelled = maintenance.status === 'cancelada';
  const steps = isCancelled
    ? [...baseSteps, { label: 'Cancelada', key: 'cancelada', date: maintenance.cancelado_em }]
    : baseSteps;
  const currentStatus = maintenance.status;
  const currentIdx = steps.findIndex(s => s.key === currentStatus);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
      {/* Header do Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl shadow-sm">
            <TruckIcon className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-gray-900 tracking-tight">
              {vehicle ? `${vehicle.placa} - ${vehicle.modelo}` : 'Veículo não encontrado'}
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div><span className="font-semibold">Abertura:</span> {formatDate(maintenance.criado_em || '')}</div>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700">Fechar</button>
      </div>

      {/* Timeline visual */}
      <ul className="flex items-center justify-between w-full max-w-4xl mx-auto py-6 px-4 relative">
        {/* Linha de fundo cinza */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 z-0" style={{ transform: 'translateY(-50%)' }} />
        {/* Linha de progresso colorida */}
        <div
          className="absolute top-1/2 left-0 h-1 z-0"
          style={{
            width: `${(steps.length > 1 ? (100 * (steps.filter((s, idx) => idx <= currentIdx && (s.key !== 'cancelada' || isCancelled)).length - 1) / (steps.length - 1)) : 0)}%`,
            background: isCancelled
              ? 'linear-gradient(to right, #f87171, #fecaca)'
              : 'linear-gradient(to right, #22c55e, #bbf7d0)',
            transform: 'translateY(-50%)'
          }}
        />
        {steps.map((step, idx) => (
          <li key={step.key} className="relative z-10 flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 ${idx <= currentIdx ? 'border-green-500 bg-green-100' : 'border-gray-300 bg-white'}`}>{idx + 1}</div>
            <span className="mt-2 text-xs text-gray-700 whitespace-nowrap">{step.label}</span>
            <span className="text-[10px] text-gray-400">{formatDate(step.date || '')}</span>
          </li>
        ))}
      </ul>

      {/* Detalhes e histórico */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 px-8 pb-8">
        {/* Coluna 1 */}
        <div className="space-y-6 md:pr-4">
          <div>
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1 text-base"><DocumentTextIcon className="h-4 w-4 text-gray-400" />Descrição</div>
            <div className="text-gray-700 text-sm">{maintenance.descricao || '-'}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1 text-base"><WrenchScrewdriverIcon className="h-4 w-4 text-gray-400" />Tipo de Manutenção</div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">{maintenance.tipo === 'preventive' ? 'Preventiva' : maintenance.tipo === 'corrective' ? 'Corretiva' : 'Emergencial'}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1 text-base"><UserIcon className="h-4 w-4 text-gray-400" />Responsáveis</div>
            <div className="text-gray-700 text-sm">Solicitante: {solicitanteNome || '-'}</div>
            <div className="text-gray-700 text-sm">Aprovador: {aprovadorNome || '-'}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1 text-base"><ExclamationTriangleIcon className="h-4 w-4 text-gray-400" />Prioridade</div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${maintenance.prioridade === 'alta' ? 'bg-orange-100 text-orange-700' : maintenance.prioridade === 'urgente' ? 'bg-red-100 text-red-700' : maintenance.prioridade === 'baixa' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>{maintenance.prioridade ? maintenance.prioridade.charAt(0).toUpperCase() + maintenance.prioridade.slice(1) : '-'}</span>
          </div>
          {maintenance.observacoes && (
            <div>
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1 text-base"><DocumentTextIcon className="h-4 w-4 text-gray-400" />Observações</div>
              <div className="text-gray-700 text-sm">{maintenance.observacoes}</div>
            </div>
          )}
        </div>
        {/* Coluna 2+3 - Histórico centralizado e destacado */}
        <div className="md:col-span-2 flex flex-col items-center justify-center">
          <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-4 text-lg"><ClockIcon className="h-5 w-5 text-gray-400" />Histórico</div>
            {Array.isArray(maintenance.historico) && maintenance.historico.length > 0 ? (
              <ul className="flex flex-col gap-3 text-base text-gray-800 pl-0 w-full">
                {maintenance.historico
                  .filter(ev => typeof ev === 'object' && ev !== null && 'data' in ev && 'status' in ev)
                  .map((ev, idx) => {
                    const evento = ev as { data: string; status: string; usuario_id?: string; comentario?: string };
                    return (
                      <li key={idx} className="flex items-start gap-2 whitespace-pre-line">
                        <span className="text-gray-400 mt-1">•</span>
                        <span>
                          <span className="font-medium text-gray-900">{formatDate(evento.data)}</span>
                          {statusFriendly[evento.status] ? ` • ${statusFriendly[evento.status]}` : ''}
                          {evento.usuario_id && historicoNomes[evento.usuario_id] ? ` por ${historicoNomes[evento.usuario_id]}` : ''}
                          {evento.comentario ? ` – ${evento.comentario}` : ''}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            ) : <div className="text-gray-400">Nenhum histórico</div>}
          </div>
        </div>
        {/* Coluna 4 */}
        <div className="space-y-6 md:pl-4">
          <div>
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1 text-base"><CurrencyDollarIcon className="h-4 w-4 text-gray-400" />Custos</div>
            <div className="text-gray-700 text-sm">Estimado: <b>R$ {(maintenance.custo_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b></div>
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1 text-base"><BuildingOffice2Icon className="h-4 w-4 text-gray-400" />Oficina</div>
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="font-semibold">{workshop?.nome || '-'}</div>
              <div className="text-xs text-gray-500">{workshop?.endereco || ''}</div>
              <div className="text-xs text-gray-500">{workshop?.telefone || ''}</div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1 text-base"><WrenchScrewdriverIcon className="h-4 w-4 text-gray-400" />Itens/Serviços</div>
            {Array.isArray(maintenance.servicos) && maintenance.servicos.length > 0 ? (
              <ul className="list-disc ml-6">
                {maintenance.servicos.map((serv, idx) => {
                  if (typeof serv === 'object' && serv !== null && 'nome' in serv) {
                    const s = serv as { nome?: string; valor?: number };
                    return (
                      <li key={idx}>{s.nome}{s.valor ? ` - R$ ${s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}</li>
                    );
                  }
                  return null;
                })}
              </ul>
            ) : <div className="text-gray-400">Nenhum serviço informado</div>}
          </div>
          <div>
            <MaintenanceAttachmentManager
              maintenanceId={maintenance.id}
              attachments={attachments}
              onAttachmentAdded={handleAttachmentAdded}
              onAttachmentDeleted={handleAttachmentDeleted}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 