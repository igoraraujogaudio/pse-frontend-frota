'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TruckIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowPathIcon,
  UserGroupIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions';
import {
  disponibilidadeFrotaService,
  DisponibilidadeRota,
  ResumoContrato,
  StatusDisponibilidade,
  ManutencaoTipo,
  ManutencaoComplexidade,
  ManutencaoSetor,
} from '@/services/disponibilidadeRotaService';

const STATUS_CONFIG: Record<StatusDisponibilidade, { label: string; color: string; bg: string; icon: typeof CheckCircleIcon }> = {
  disponivel: { label: 'Disponível', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircleIcon },
  em_operacao: { label: 'Em Operação', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: UserGroupIcon },
  manutencao: { label: 'Manutenção', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: WrenchScrewdriverIcon },
};

export function DisponibilidadeRotaContent() {
  // Mapear status do veículo (tabela) para StatusDisponibilidade
  const mapVeiculoStatus = (s: string | undefined): StatusDisponibilidade | undefined => {
    if (!s) return undefined;
    if (s === 'disponivel') return 'disponivel';
    if (s === 'operacao' || s === 'em_operacao' || s === 'operando') return 'em_operacao';
    if (s === 'manutenção' || s === 'manutencao' || s === 'em_manutencao') return 'manutencao';
    return undefined;
  };

  const { notify } = useNotification();
  const { user, userContratoIds } = useAuth();
  const { hasPermission } = useModularPermissions();

  const canRegister = hasPermission(PERMISSION_CODES.DISPONIBILIDADE_FROTA.REGISTRAR);
  const canEncerrar = hasPermission(PERMISSION_CODES.DISPONIBILIDADE_FROTA.ENCERRAR_REUNIAO);
  const canViewAll = hasPermission(PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR_TODOS_CONTRATOS);
  const canEnviarForaHorario = hasPermission(PERMISSION_CODES.DISPONIBILIDADE_FROTA.ENVIAR_FORA_HORARIO);

  const [loading, setLoading] = useState(true);
  const [dataReferencia, setDataReferencia] = useState(disponibilidadeFrotaService.getDataHojeBrasilia());
  const [resumos, setResumos] = useState<ResumoContrato[]>([]);
  const [selectedContrato, setSelectedContrato] = useState<string | null>(null);
  const [registros, setRegistros] = useState<DisponibilidadeRota[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [oficinas, setOficinas] = useState<Array<{ id: string; nome: string }>>([]);
  const [equipes, setEquipes] = useState<Array<{ id: string; nome: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [veiculoBusca, setVeiculoBusca] = useState('');
  const [ultimoRegistroMap, setUltimoRegistroMap] = useState<Record<string, DisponibilidadeRota>>({});

  // Modal seleção de equipe (Em Operação)
  const [showEquipeModal, setShowEquipeModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [equipeVeiculo, setEquipeVeiculo] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [equipeBusca, setEquipeBusca] = useState('');
  const [equipeSelectedIds, setEquipeSelectedIds] = useState<string[]>([]);

  // Modal manutenção
  const [showManutModal, setShowManutModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [manutVeiculo, setManutVeiculo] = useState<any>(null);
  const [manutTipo, setManutTipo] = useState<ManutencaoTipo>('em_manutencao');
  const [manutProblema, setManutProblema] = useState('');
  const [manutPrevisao, setManutPrevisao] = useState('');
  const [manutOficinaId, setManutOficinaId] = useState('');
  const [manutOficinaNome, setManutOficinaNome] = useState('');
  const [manutObs, setManutObs] = useState('');
  const [oficinaBusca, setOficinaBusca] = useState('');
  const [showOficinaDropdown, setShowOficinaDropdown] = useState(false);
  const [manutComplexidade, setManutComplexidade] = useState<ManutencaoComplexidade | ''>('');
  const [manutSetor, setManutSetor] = useState<ManutencaoSetor | ''>('');

  // Modal detalhes
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [detalhesRegistro, setDetalhesRegistro] = useState<DisponibilidadeRota | null>(null);

  const horarioInfo = disponibilidadeFrotaService.getHorarioAtual();
  const foraDoHorario = horarioInfo.horario === 'fora';

  // Converter data ISO (YYYY-MM-DD) para BR (DD/MM/AAAA)
  const isoToBr = (iso: string): string => { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // Converter data BR (DD/MM/AAAA) para ISO (YYYY-MM-DD)
  const brToIso = (br: string): string => { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (!br || br.length < 10) return '';
    const [d, m, y] = br.split('/');
    return `${y}-${m}-${d}`;
  };

  // Formatar input de data BR enquanto digita
  const formatDateInput = (value: string): string => { // eslint-disable-line @typescript-eslint/no-unused-vars
    const nums = value.replace(/\D/g, '');
    if (nums.length <= 2) return nums;
    if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
    return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4, 8)}`;
  };

  // Bloquear scroll da página quando algum modal está aberto
  const anyModalOpen = showManutModal || showEquipeModal || showDetalhesModal;
  useEffect(() => {
    if (anyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [anyModalOpen]);

  const loadResumos = useCallback(async () => {
    setLoading(true);
    try {
      const ids = canViewAll ? undefined : (userContratoIds || []);
      const data = await disponibilidadeFrotaService.getResumoContratos(dataReferencia, ids);
      setResumos(data);
      if (data.length === 1 && !selectedContrato) {
        setSelectedContrato(data[0].contrato_id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar resumos';
      notify(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [dataReferencia, canViewAll, userContratoIds, notify, selectedContrato]);

  const loadDetalheContrato = useCallback(async () => {
    if (!selectedContrato) return;
    try {
      const [regs, veics, ofs, eqs] = await Promise.all([
        disponibilidadeFrotaService.getByContratoEData(selectedContrato, dataReferencia),
        disponibilidadeFrotaService.getVeiculosPorContrato(selectedContrato),
        disponibilidadeFrotaService.getOficinasPorContrato(selectedContrato),
        disponibilidadeFrotaService.getEquipesPorContrato(selectedContrato),
      ]);
      setRegistros(regs);
      setVeiculos(veics);
      setOficinas(ofs);
      setEquipes(eqs);

      // Carregar último registro de cada veículo para pré-preencher status
      const veicIds = veics.map((v: any) => v.id); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (veicIds.length > 0) {
        const ultimosRegs = await disponibilidadeFrotaService.getUltimoRegistroPorVeiculo(selectedContrato, veicIds);
        setUltimoRegistroMap(ultimosRegs);
      } else {
        setUltimoRegistroMap({});
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar detalhes';
      notify(message, 'error');
    }
  }, [selectedContrato, dataReferencia, notify]);

  useEffect(() => { loadResumos(); }, [loadResumos]);
  useEffect(() => { loadDetalheContrato(); }, [loadDetalheContrato]);

  const getRegistroVeiculo = (veiculoId: string) => registros.find(r => r.veiculo_id === veiculoId);

  const contratoResumo = resumos.find(r => r.contrato_id === selectedContrato);
  const reuniaoEncerrada = contratoResumo?.reuniao_encerrada ?? false;
  const podeEditar = canRegister && !reuniaoEncerrada && (!foraDoHorario || canEnviarForaHorario);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSetStatus = async (veiculo: any, status: StatusDisponibilidade) => {
    if (!podeEditar || !selectedContrato || !user?.id) return;
    if (status === 'manutencao') {
      setManutVeiculo(veiculo);
      // Pré-preencher com dados existentes do registro do dia, se houver
      const regExistente = getRegistroVeiculo(veiculo.id);
      const regParaPreencher = regExistente || ultimoRegistroMap[veiculo.id];
      if (regParaPreencher && regParaPreencher.status === 'manutencao' && regParaPreencher.manutencao_tipo) {
        setManutTipo(regParaPreencher.manutencao_tipo as ManutencaoTipo);
        setManutProblema(regParaPreencher.manutencao_problema || '');
        setManutPrevisao(regParaPreencher.manutencao_previsao || '');
        setManutOficinaId(regParaPreencher.manutencao_oficina_id || '');
        setManutOficinaNome(regParaPreencher.manutencao_oficina_nome || '');
        setManutComplexidade((regParaPreencher.manutencao_complexidade as ManutencaoComplexidade) || '');
        setManutSetor((regParaPreencher.manutencao_setor as ManutencaoSetor) || '');
        setManutObs(regParaPreencher.observacoes || '');
      } else {
        setManutTipo('em_manutencao');
        setManutProblema('');
        setManutPrevisao('');
        setManutOficinaId('');
        setManutOficinaNome('');
        setManutComplexidade('');
        setManutSetor('');
        setManutObs('');
      }
      setOficinaBusca('');
      setShowOficinaDropdown(false);
      setShowManutModal(true);
      return;
    }
    setSaving(true);
    try {
      await disponibilidadeFrotaService.upsert({
        contrato_id: selectedContrato,
        veiculo_id: veiculo.id,
        data_referencia: dataReferencia,
        status,
        enviado_por: user.id,
      });
      // Atualizar apenas o registro localmente sem recarregar tudo
      setRegistros(prev => {
        const existe = prev.find(r => r.veiculo_id === veiculo.id);
        if (existe) {
          return prev.map(r => r.veiculo_id === veiculo.id ? { ...r, status } : r);
        }
        return [...prev, { veiculo_id: veiculo.id, status, contrato_id: selectedContrato, data_referencia: dataReferencia } as DisponibilidadeRota];
      });
      // Atualizar status do veículo localmente também
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setVeiculos((prev: any[]) => prev.map((v: any) => {
        if (v.id === veiculo.id) {
          const statusMap: Record<string, string> = { disponivel: 'disponivel', em_operacao: 'operacao', manutencao: 'manutenção' };
          return { ...v, status: statusMap[status] || v.status };
        }
        return v;
      }));
      notify('Status atualizado', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar';
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarManutencao = async () => {
    if (!manutVeiculo || !selectedContrato || !user?.id) return;
    if (!manutProblema.trim()) {
      notify('Informe o problema da manutenção', 'warning');
      return;
    }
    if (!manutComplexidade) {
      notify('Selecione a complexidade da manutenção', 'warning');
      return;
    }
    if (!manutSetor) {
      notify('Selecione o setor responsável', 'warning');
      return;
    }
    if (manutTipo === 'em_manutencao' && !manutPrevisao) {
      notify('Informe a previsão de conclusão', 'warning');
      return;
    }
    setSaving(true);
    try {
      await disponibilidadeFrotaService.upsert({
        contrato_id: selectedContrato,
        veiculo_id: manutVeiculo.id,
        data_referencia: dataReferencia,
        status: 'manutencao',
        manutencao_tipo: manutTipo,
        manutencao_problema: manutProblema.trim(),
        manutencao_previsao: manutTipo === 'em_manutencao' ? (manutPrevisao || undefined) : undefined,
        manutencao_oficina_id: manutOficinaId || undefined,
        manutencao_oficina_nome: manutOficinaNome || undefined,
        manutencao_complexidade: manutComplexidade || undefined,
        manutencao_setor: manutSetor || undefined,
        observacoes: manutObs || undefined,
        enviado_por: user.id,
      });
      // Atualizar registro localmente
      setRegistros(prev => {
        const existe = prev.find(r => r.veiculo_id === manutVeiculo.id);
        const novoReg = {
          veiculo_id: manutVeiculo.id,
          status: 'manutencao' as StatusDisponibilidade,
          manutencao_tipo: manutTipo,
          manutencao_problema: manutProblema.trim(),
          manutencao_previsao: manutTipo === 'em_manutencao' ? (manutPrevisao || undefined) : undefined,
          manutencao_oficina_id: manutOficinaId || undefined,
          manutencao_oficina_nome: manutOficinaNome || undefined,
          manutencao_complexidade: manutComplexidade || undefined,
          manutencao_setor: manutSetor || undefined,
          observacoes: manutObs || undefined,
          contrato_id: selectedContrato,
          data_referencia: dataReferencia,
        } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (existe) {
          return prev.map(r => r.veiculo_id === manutVeiculo.id ? { ...r, ...novoReg } : r);
        }
        return [...prev, novoReg];
      });
      setShowManutModal(false);
      // Atualizar status do veículo localmente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setVeiculos((prev: any[]) => prev.map((v: any) => v.id === manutVeiculo.id ? { ...v, status: 'manutenção' } : v));
      notify('Manutenção registrada', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar manutenção';
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleEquipeSelection = (id: string) => {
    setEquipeSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleConfirmarEquipe = async () => {
    if (!equipeVeiculo || !selectedContrato || !user?.id) return;
    if (equipeSelectedIds.length === 0) {
      notify('Selecione ao menos uma equipe', 'warning');
      return;
    }
    setSaving(true);
    try {
      await disponibilidadeFrotaService.upsert({
        contrato_id: selectedContrato,
        veiculo_id: equipeVeiculo.id,
        equipe_id: equipeSelectedIds[0],
        data_referencia: dataReferencia,
        status: 'em_operacao',
        enviado_por: user.id,
        observacoes: equipeSelectedIds.length > 1
          ? `Equipes: ${equipeSelectedIds.map(id => equipes.find(e => e.id === id)?.nome).filter(Boolean).join(', ')}`
          : undefined,
      });
      setShowEquipeModal(false);
      notify('Status atualizado — Em Operação', 'success');
      await Promise.all([loadResumos(), loadDetalheContrato()]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar';
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEncerrarReuniao = async () => {
    if (!canEncerrar || !selectedContrato || !user?.id) return;

    // Veículos sem registro do dia
    const veiculosSemRegistro = veiculos.filter(v => !registros.find(r => r.veiculo_id === v.id));
    const veiculosComStatus = veiculosSemRegistro
      .map(v => {
        const ultimoReg = ultimoRegistroMap[v.id];
        const statusMapeado = ultimoReg?.status as StatusDisponibilidade | undefined || mapVeiculoStatus(v.status);
        return { veiculo: v, statusMapeado, ultimoReg };
      })
      .filter(x => x.statusMapeado);

    // Veículos totalmente pendentes (sem registro E sem status mapeável)
    const veiculosPendentes = veiculosSemRegistro.filter(v => {
      const ultimoReg = ultimoRegistroMap[v.id];
      return !(ultimoReg?.status || mapVeiculoStatus(v.status));
    });

    if (veiculosPendentes.length > 0) {
      const placas = veiculosPendentes.map(v => v.placa).join(', ');
      notify(`Não é possível publicar. ${veiculosPendentes.length} veículo(s) sem status definido: ${placas}`, 'warning');
      return;
    }

    const msgExtra = veiculosComStatus.length > 0
      ? `\n\n${veiculosComStatus.length} veículo(s) sem alteração terão o status atual enviado automaticamente.`
      : '';

    if (!confirm(`Deseja publicar a disponibilidade? Após publicar, os dados não poderão ser alterados.${msgExtra}`)) return;
    setSaving(true);
    try {
      // Criar registro pra TODOS os veículos sem registro do dia usando ultimoRegistroMap
      if (veiculosComStatus.length > 0) {
        await Promise.all(
          veiculosComStatus.map(({ veiculo, statusMapeado, ultimoReg }) => {
            const payload: Parameters<typeof disponibilidadeFrotaService.upsert>[0] = {
              contrato_id: selectedContrato,
              veiculo_id: veiculo.id,
              data_referencia: dataReferencia,
              status: statusMapeado!,
              enviado_por: user.id,
            };
            // Se tem último registro, copiar todos os dados de manutenção dele
            if (statusMapeado === 'manutencao' && ultimoReg) {
              if (ultimoReg.manutencao_tipo) payload.manutencao_tipo = ultimoReg.manutencao_tipo;
              if (ultimoReg.manutencao_problema) payload.manutencao_problema = ultimoReg.manutencao_problema;
              if (ultimoReg.manutencao_previsao) payload.manutencao_previsao = ultimoReg.manutencao_previsao;
              if (ultimoReg.manutencao_oficina_id) payload.manutencao_oficina_id = ultimoReg.manutencao_oficina_id;
              if (ultimoReg.manutencao_oficina_nome) payload.manutencao_oficina_nome = ultimoReg.manutencao_oficina_nome;
              if (ultimoReg.manutencao_complexidade) payload.manutencao_complexidade = ultimoReg.manutencao_complexidade;
              if (ultimoReg.manutencao_setor) payload.manutencao_setor = ultimoReg.manutencao_setor;
              if (ultimoReg.observacoes) payload.observacoes = ultimoReg.observacoes;
            } else if (statusMapeado === 'manutencao') {
              payload.manutencao_tipo = 'em_manutencao' as ManutencaoTipo;
            }
            return disponibilidadeFrotaService.upsert(payload);
          })
        );
      }

      // Também garantir que veículos em manutenção COM registro do dia mas sem manutencao_tipo sejam atualizados
      const registrosManutSemTipo = registros.filter(r => r.status === 'manutencao' && !r.manutencao_tipo);
      if (registrosManutSemTipo.length > 0) {
        await Promise.all(
          registrosManutSemTipo.map(r => {
            const ultimoReg = ultimoRegistroMap[r.veiculo_id];
            const payload: Parameters<typeof disponibilidadeFrotaService.upsert>[0] = {
              contrato_id: selectedContrato,
              veiculo_id: r.veiculo_id,
              data_referencia: dataReferencia,
              status: 'manutencao' as StatusDisponibilidade,
              enviado_por: user.id,
            };
            if (ultimoReg && ultimoReg.manutencao_tipo) {
              payload.manutencao_tipo = ultimoReg.manutencao_tipo;
              if (ultimoReg.manutencao_problema) payload.manutencao_problema = ultimoReg.manutencao_problema;
              if (ultimoReg.manutencao_previsao) payload.manutencao_previsao = ultimoReg.manutencao_previsao;
              if (ultimoReg.manutencao_oficina_id) payload.manutencao_oficina_id = ultimoReg.manutencao_oficina_id;
              if (ultimoReg.manutencao_oficina_nome) payload.manutencao_oficina_nome = ultimoReg.manutencao_oficina_nome;
              if (ultimoReg.manutencao_complexidade) payload.manutencao_complexidade = ultimoReg.manutencao_complexidade;
              if (ultimoReg.manutencao_setor) payload.manutencao_setor = ultimoReg.manutencao_setor;
              if (ultimoReg.observacoes) payload.observacoes = ultimoReg.observacoes;
            } else {
              payload.manutencao_tipo = 'em_manutencao' as ManutencaoTipo;
            }
            return disponibilidadeFrotaService.upsert(payload);
          })
        );
      }

      await disponibilidadeFrotaService.encerrarReuniao(selectedContrato, dataReferencia, user.id);

      // Enviar notificações (email + WhatsApp) — não bloqueia
      const { data: { session: notifSession } } = await supabase.auth.getSession();
      fetch('/api/disponibilidade-frota/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${notifSession?.access_token || ''}` },
        body: JSON.stringify({ contrato_id: selectedContrato, data_referencia: dataReferencia }),
      }).then(async res => {
        const data = await res.json();
        if (data.success) {
          const msgs: string[] = [];
          if (data.emails_enviados > 0) msgs.push(`${data.emails_enviados} email(s)`);
          if (data.whatsapp_enviados > 0) msgs.push(`${data.whatsapp_enviados} WhatsApp(s)`);
          if (msgs.length > 0) notify(`Notificações enviadas: ${msgs.join(', ')}`, 'success');
        }
      }).catch(() => { /* silenciar erro de notificação */ });

      notify('Disponibilidade publicada com sucesso', 'success');
      await loadResumos();
      await loadDetalheContrato();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao encerrar';
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReativarReuniao = async () => {
    if (!canEncerrar || !selectedContrato) return;
    if (!confirm('Deseja reativar a disponibilidade? Os registros poderão ser alterados novamente.')) return;
    setSaving(true);
    try {
      await disponibilidadeFrotaService.reativarReuniao(selectedContrato, dataReferencia);
      notify('Disponibilidade reativada', 'success');
      await loadResumos();
      await loadDetalheContrato();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao reativar';
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TruckIcon className="w-7 h-7 text-cyan-600" />
              Disponibilidade de Frota
            </h1>
            <p className="text-sm text-gray-500 mt-1">Indicação diária de disponibilidade de veículos</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dataReferencia}
              onChange={e => { if (e.target.value) setDataReferencia(e.target.value); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer"
            />
            <Link
              href="/disponibilidade-frota-historico"
              className="flex items-center gap-1 px-3 py-2 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 rounded-lg text-sm border border-cyan-200"
            >
              <DocumentTextIcon className="w-4 h-4" />
              Histórico
            </Link>
            <button
              onClick={() => { loadResumos(); loadDetalheContrato(); }}
              className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>
        {!reuniaoEncerrada && (
          <div className={clsx(
            'mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm',
            horarioInfo.horario === 'manha' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : horarioInfo.horario === 'tarde' ? 'bg-blue-50 border border-blue-200 text-blue-800'
              : canEnviarForaHorario ? 'bg-blue-50 border border-blue-200 text-blue-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          )}>
            <CalendarIcon className="w-4 h-4" />
            {horarioInfo.horario === 'manha' && 'Envio da manhã — até às 11h (horário de Brasília)'}
            {horarioInfo.horario === 'tarde' && 'Envio da tarde — até às 17h (horário de Brasília)'}
            {horarioInfo.horario === 'fora' && (canEnviarForaHorario
              ? 'Fora do horário — enviando com permissão especial'
              : 'Horário limite (17h) ultrapassado. Novos registros bloqueados.')}
          </div>
        )}
        {reuniaoEncerrada && selectedContrato && (
          <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-800">
            <CheckCircleIcon className="w-4 h-4" />
            Reunião encerrada para este contrato.
            {canEncerrar && (
              <button
                onClick={handleReativarReuniao}
                disabled={saving}
                className="ml-auto flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                Reativar
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Painel lateral - Contratos */}
            <div className="col-span-12 lg:col-span-4 xl:col-span-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-700 text-sm">Contratos ({resumos.length})</h2>
                </div>
                <div className="divide-y divide-gray-100 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {resumos.map(r => (
                    <button
                      key={r.contrato_id}
                      onClick={() => setSelectedContrato(r.contrato_id)}
                      className={clsx(
                        'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                        selectedContrato === r.contrato_id && 'bg-cyan-50 border-l-4 border-cyan-500'
                      )}
                    >
                      <div className="font-medium text-sm text-gray-900">{r.contrato_nome}</div>
                      {r.contrato_codigo && <div className="text-xs text-gray-500">{r.contrato_codigo}</div>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{r.disponiveis}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{r.em_operacao}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{r.manutencao}</span>
                        {r.nao_informados > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{r.nao_informados} pend.</span>
                        )}
                      </div>
                      {r.reuniao_encerrada && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-600">
                          <CheckCircleIcon className="w-3 h-3" /> Encerrada
                        </span>
                      )}
                    </button>
                  ))}
                  {resumos.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">Nenhum contrato encontrado</div>
                  )}
                </div>
              </div>
            </div>

            {/* Painel principal - Veículos */}
            <div className="col-span-12 lg:col-span-8 xl:col-span-9">
              {!selectedContrato ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <TruckIcon className="w-12 h-12 text-gray-300 mx-auto" />
                  <p className="mt-3 text-gray-500">Selecione um contrato para ver os veículos</p>
                </div>
              ) : (
                <>
                  {/* Resumo cards */}
                  {contratoResumo && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-500 p-4">
                        <div className="text-2xl font-bold text-gray-900">{contratoResumo.disponiveis}</div>
                        <div className="text-xs text-gray-500 mt-1">Disponíveis</div>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-4">
                        <div className="text-2xl font-bold text-gray-900">{contratoResumo.em_operacao}</div>
                        <div className="text-xs text-gray-500 mt-1">Em Operação</div>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-4">
                        <div className="text-2xl font-bold text-gray-900">{contratoResumo.manutencao}</div>
                        <div className="text-xs text-gray-500 mt-1">Manutenção</div>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border-l-4 border-gray-400 p-4">
                        <div className="text-2xl font-bold text-gray-900">{contratoResumo.nao_informados}</div>
                        <div className="text-xs text-gray-500 mt-1">Pendentes</div>
                      </div>
                    </div>
                  )}

                  {/* Encerrar Reunião */}
                  {canEncerrar && !reuniaoEncerrada && (
                    <div className="mb-4 flex justify-end">
                      <button
                        onClick={handleEncerrarReuniao}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Publicar Disponibilidade
                      </button>
                    </div>
                  )}

                  {/* Lista de veículos */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="font-semibold text-gray-700 text-sm">Veículos ({veiculos.filter((v: any) => // eslint-disable-line @typescript-eslint/no-explicit-any 
                          v.placa?.toLowerCase().includes(veiculoBusca.toLowerCase()) ||
                          v.modelo?.toLowerCase().includes(veiculoBusca.toLowerCase())
                        ).length})</h2>
                      </div>
                      <input
                        type="text"
                        value={veiculoBusca}
                        onChange={e => setVeiculoBusca(e.target.value)}
                        placeholder="Buscar por placa ou modelo..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                    </div>
                    <div className="divide-y divide-gray-100">
                      {veiculos
                        .filter((v: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                          v.placa?.toLowerCase().includes(veiculoBusca.toLowerCase()) ||
                          v.modelo?.toLowerCase().includes(veiculoBusca.toLowerCase())
                        )
                        .map(veiculo => {
                        const reg = getRegistroVeiculo(veiculo.id);
                        const statusRegistro = reg?.status as StatusDisponibilidade | undefined;
                        const equipesVeiculo: Array<{ id: string; nome: string }> = Array.isArray(veiculo.equipe)
                          ? veiculo.equipe.filter((e: any) => e?.id) // eslint-disable-line @typescript-eslint/no-explicit-any
                          : veiculo.equipe?.id ? [veiculo.equipe] : [];

                        // Prioridade: registro do dia > último registro > status do veículo
                        const ultimoReg = ultimoRegistroMap[veiculo.id];
                        const statusEfetivo = statusRegistro || (ultimoReg?.status as StatusDisponibilidade | undefined) || mapVeiculoStatus(veiculo.status);

                        return (
                          <div key={veiculo.id} className="px-4 py-3 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div>
                                  <span className="font-bold text-gray-900">{veiculo.placa}</span>
                                  <span className="ml-2 text-sm text-gray-500">{veiculo.modelo}</span>
                                  {equipesVeiculo.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {equipesVeiculo.map((eq: { id: string; nome: string }) => (
                                        <span key={eq.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-medium text-gray-600">
                                          <UserGroupIcon className="w-3 h-3" />{eq.nome}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {statusEfetivo === 'manutencao' && reg && (
                                <button
                                  onClick={() => { setDetalhesRegistro(reg); setShowDetalhesModal(true); }}
                                  className="text-xs text-red-600 hover:text-red-800 underline"
                                >
                                  Ver detalhes
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {(['disponivel', 'em_operacao', 'manutencao'] as StatusDisponibilidade[]).map(st => {
                                const c = STATUS_CONFIG[st];
                                const ativo = statusEfetivo === st;
                                return (
                                  <button
                                    key={st}
                                    onClick={() => podeEditar ? handleSetStatus(veiculo, st) : undefined}
                                    disabled={saving || !podeEditar}
                                    className={clsx(
                                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50',
                                      ativo ? `${c.bg} ${c.color} border-current font-bold` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    )}
                                  >
                                    <c.icon className="w-3.5 h-3.5" />
                                    {c.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {veiculos.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">Nenhum veículo encontrado</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Manutenção */}
      {showManutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Informar Manutenção</h3>
              <button onClick={() => setShowManutModal(false)}>
                <XMarkIcon className="w-5 h-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {manutVeiculo && (
                <p className="text-sm text-gray-500">{manutVeiculo.placa} - {manutVeiculo.modelo}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setManutTipo('em_manutencao'); setManutPrevisao(''); }}
                    className={clsx(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                      manutTipo === 'em_manutencao'
                        ? 'bg-red-50 text-red-700 border-red-300'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <WrenchScrewdriverIcon className="w-4 h-4 inline mr-1" />
                    Em Manutenção
                  </button>
                  <button
                    type="button"
                    onClick={() => { setManutTipo('em_orcamento'); setManutPrevisao(''); }}
                    className={clsx(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                      manutTipo === 'em_orcamento'
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <DocumentTextIcon className="w-4 h-4 inline mr-1" />
                    Em Orçamento
                  </button>
                </div>
                {manutTipo === 'em_orcamento' && (
                  <p className="text-xs text-amber-600 mt-1">Veículo pode ficar em orçamento por no máximo 3 dias.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Problema *</label>
                <textarea
                  value={manutProblema}
                  onChange={e => setManutProblema(e.target.value)}
                  placeholder="Descreva o problema"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Complexidade *</label>
                <div className="flex gap-2">
                  {([['alta', 'Alta', 'red'] as const, ['media', 'Média', 'amber'] as const, ['baixa', 'Baixa', 'emerald'] as const]).map(([val, label, cor]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setManutComplexidade(val)}
                      className={clsx(
                        'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                        manutComplexidade === val
                          ? `bg-${cor}-50 text-${cor}-700 border-${cor}-300`
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Setor *</label>
                <div className="flex gap-2">
                  {(['STCO', 'O&M', 'APOIO'] as const).map((setor) => (
                    <button
                      key={setor}
                      type="button"
                      onClick={() => setManutSetor(setor)}
                      className={clsx(
                        'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                        manutSetor === setor
                          ? 'bg-cyan-50 text-cyan-700 border-cyan-300'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      {setor}
                    </button>
                  ))}
                </div>
              </div>
              {manutTipo === 'em_manutencao' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Previsão de conclusão *</label>
                  <input
                    type="date"
                    value={manutPrevisao}
                    onChange={e => setManutPrevisao(e.target.value)}
                    lang="pt-BR"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              )}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Oficina</label>
                <div className="relative">
                  <input
                    value={oficinaBusca}
                    onChange={e => {
                      setOficinaBusca(e.target.value);
                      setShowOficinaDropdown(true);
                      if (!e.target.value) {
                        setManutOficinaId('');
                        setManutOficinaNome('');
                      }
                    }}
                    onFocus={() => setShowOficinaDropdown(true)}
                    placeholder="Buscar oficina do contrato..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                  {manutOficinaId && (
                    <button
                      onClick={() => { setManutOficinaId(''); setManutOficinaNome(''); setOficinaBusca(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {showOficinaDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {oficinas
                      .filter(o => o.nome.toLowerCase().includes(oficinaBusca.toLowerCase()))
                      .map(o => (
                        <button
                          key={o.id}
                          onClick={() => {
                            setManutOficinaId(o.id);
                            setManutOficinaNome(o.nome);
                            setOficinaBusca(o.nome);
                            setShowOficinaDropdown(false);
                          }}
                          className={clsx(
                            'w-full text-left px-3 py-2 text-sm hover:bg-cyan-50 transition-colors',
                            manutOficinaId === o.id && 'bg-cyan-50 text-cyan-700 font-medium'
                          )}
                        >
                          <BuildingOfficeIcon className="w-4 h-4 inline mr-2 text-gray-400" />
                          {o.nome}
                        </button>
                      ))}
                    {oficinas.filter(o => o.nome.toLowerCase().includes(oficinaBusca.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">Nenhuma oficina encontrada</div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={manutObs}
                  onChange={e => setManutObs(e.target.value)}
                  placeholder="Observações adicionais"
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowManutModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarManutencao}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Manutenção'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes Manutenção */}
      {showDetalhesModal && detalhesRegistro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Detalhes da Manutenção</h3>
              <button onClick={() => setShowDetalhesModal(false)}>
                <XMarkIcon className="w-5 h-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-gray-500">Problema</div>
                  <div className="text-sm text-gray-900 mt-0.5">{detalhesRegistro.manutencao_problema || '-'}</div>
                </div>
              </div>
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <CalendarIcon className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-gray-500">Previsão</div>
                  <div className="text-sm text-gray-900 mt-0.5">
                    {detalhesRegistro.manutencao_previsao
                      ? detalhesRegistro.manutencao_previsao.split('-').reverse().join('/')
                      : 'Não informada'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <BuildingOfficeIcon className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-gray-500">Oficina</div>
                  <div className="text-sm text-gray-900 mt-0.5">
                    {detalhesRegistro.manutencao_oficina_nome || detalhesRegistro.oficina?.nome || 'Não informada'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <ExclamationTriangleIcon className="w-5 h-5 text-purple-500 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-gray-500">Complexidade</div>
                  <div className="text-sm text-gray-900 mt-0.5">
                    {detalhesRegistro.manutencao_complexidade
                      ? detalhesRegistro.manutencao_complexidade === 'alta' ? 'Alta'
                        : detalhesRegistro.manutencao_complexidade === 'media' ? 'Média' : 'Baixa'
                      : 'Não informada'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <UserGroupIcon className="w-5 h-5 text-cyan-500 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-gray-500">Setor</div>
                  <div className="text-sm text-gray-900 mt-0.5">
                    {detalhesRegistro.manutencao_setor || 'Não informado'}
                  </div>
                </div>
              </div>
              {detalhesRegistro.observacoes && (
                <div className="flex items-start gap-3">
                  <DocumentTextIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs font-medium text-gray-500">Observações</div>
                    <div className="text-sm text-gray-900 mt-0.5">{detalhesRegistro.observacoes}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDetalhesModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Seleção de Equipe (Em Operação) */}
      {showEquipeModal && equipeVeiculo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Selecionar Equipe</h3>
              <button onClick={() => setShowEquipeModal(false)}>
                <XMarkIcon className="w-5 h-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{equipeVeiculo.placa}</span> — {equipeVeiculo.modelo}
              </p>
              {equipeSelectedIds.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Selecionadas ({equipeSelectedIds.length})</label>
                  <div className="flex flex-wrap gap-1.5">
                    {equipeSelectedIds.map(id => {
                      const eq = equipes.find(e => e.id === id);
                      return eq ? (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                          <UserGroupIcon className="w-3 h-3" />
                          {eq.nome}
                          <button onClick={() => toggleEquipeSelection(id)} className="ml-0.5 hover:text-blue-900">
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipes em operação *</label>
                <input
                  value={equipeBusca}
                  onChange={e => setEquipeBusca(e.target.value)}
                  placeholder="Buscar equipe..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                />
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {equipes
                    .filter(e => e.nome.toLowerCase().includes(equipeBusca.toLowerCase()))
                    .map(e => {
                      const selected = equipeSelectedIds.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          onClick={() => toggleEquipeSelection(e.id)}
                          className={clsx(
                            'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors',
                            selected
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'hover:bg-gray-50 text-gray-700'
                          )}
                        >
                          <div className={clsx(
                            'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                            selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          )}>
                            {selected && <CheckCircleIcon className="w-3 h-3 text-white" />}
                          </div>
                          <UserGroupIcon className="w-4 h-4 flex-shrink-0" />
                          {e.nome}
                        </button>
                      );
                    })}
                  {equipes.filter(e => e.nome.toLowerCase().includes(equipeBusca.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500">Nenhuma equipe encontrada</div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowEquipeModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEquipe}
                disabled={saving || equipeSelectedIds.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Salvando...' : `Confirmar Em Operação (${equipeSelectedIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="fixed inset-0 z-40 bg-white/60 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" />
        </div>
      )}
    </div>
  );
}
