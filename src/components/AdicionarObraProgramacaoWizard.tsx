'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ObraRecursosCorrigidosService } from '@/services/obraRecursosCorrigidosService';
import { ObraMaterialRetiradoService } from '@/services/obraMaterialRetiradoService';
import { MateriaisService } from '@/services/materiaisService';
import { MaoDeObraService } from '@/services/maoDeObraService';
import { ObraProgramacaoEquipeService, EtapaObra } from '@/services/obraProgramacaoEquipeService';
import { ObraProgramacaoEquipeRecursosService, ReservaAgregada } from '@/services/obraProgramacaoEquipeRecursosService';
import { ObraHistoricoService } from '@/services/obraHistoricoService';
import { ObraManutencao, StatusObra } from '@/types/obras-manutencao';
import { ObrasManutencaoService } from '@/services/obrasManutencaoService';
import { ObraMaterialCorrigido, ObraMaoDeObraCorrigida } from '@/types/obra-recursos-corrigidos';
import { ObraMaterialRetirado } from '@/types/obra-material-retirado';
import { ObraMaterial, Material } from '@/types/materiais';
import { ObraMaoDeObra, MaoDeObra } from '@/types/mao-de-obra';
import { EquipeComEncarregado } from '@/services/equipesComEncarregadoService';
import { useAuth } from '@/contexts/AuthContext';

type Etapa = EtapaObra;

interface Props {
  equipe: EquipeComEncarregado;
  date: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'obra' | 'etapa' | 'mao-de-obra' | 'material';

interface RecursoStatus<T> {
  item: T;
  noCorrigido: boolean;
  noOriginal: boolean;
  selecionado: boolean;
  quantidadeDisponivel?: number; // saldo após descontar reservas de outras equipes
}

interface ItemAvulso {
  id: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  selecionado: boolean;
}

export function AdicionarObraProgramacaoWizard({ equipe, date, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('obra');
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  // Step 1
  const [obraSearch, setObraSearch] = useState('');
  const [obras, setObras] = useState<ObraManutencao[]>([]);
  const [loadingObras, setLoadingObras] = useState(false);
  const [obraSelecionada, setObraSelecionada] = useState<ObraManutencao | null>(null);

  // Step 2
  const [etapa, setEtapa] = useState<Etapa>('FINAL');
  const [etapaForcada, setEtapaForcada] = useState<Etapa | null>(null); // etapa já definida para obra/dia

  // Step 3 - Mão de obra
  const [loadingMO, setLoadingMO] = useState(false);
  const [moCorrigida, setMoCorrigida] = useState<RecursoStatus<ObraMaoDeObraCorrigida>[]>([]);
  const [moOriginal, setMoOriginal] = useState<RecursoStatus<ObraMaoDeObra>[]>([]);
  const [moAvulsos, setMoAvulsos] = useState<ItemAvulso[]>([]);
  const [showFormMO, setShowFormMO] = useState(false);
  const [listaMO, setListaMO] = useState<MaoDeObra[]>([]);
  const [buscaMO, setBuscaMO] = useState('');
  const [novoMOQtd, setNovoMOQtd] = useState('');
  const [moSelecionadaAvulso, setMoSelecionadaAvulso] = useState<MaoDeObra | null>(null);

  // Step 4 - Material + Retirado
  const [loadingMat, setLoadingMat] = useState(false);
  const [matCorrigido, setMatCorrigido] = useState<RecursoStatus<ObraMaterialCorrigido>[]>([]);
  const [matOriginal, setMatOriginal] = useState<RecursoStatus<ObraMaterial>[]>([]);
  const [matRetirado, setMatRetirado] = useState<RecursoStatus<ObraMaterialRetirado>[]>([]);
  const [matAvulsos, setMatAvulsos] = useState<ItemAvulso[]>([]);
  const [showFormMat, setShowFormMat] = useState(false);
  const [listaMat, setListaMat] = useState<Material[]>([]);
  const [buscaMat, setBuscaMat] = useState('');
  const [novoMatQtd, setNovoMatQtd] = useState('');
  const [matSelecionadaAvulso, setMatSelecionadaAvulso] = useState<Material | null>(null);

  // Carregar lista de MO ao entrar no step
  useEffect(() => {
    if (step !== 'mao-de-obra' || listaMO.length > 0) return;
    MaoDeObraService.getAll().then(setListaMO).catch(console.error);
  }, [step, listaMO.length]);

  // Carregar lista de Materiais ao entrar no step
  useEffect(() => {
    if (step !== 'material' || listaMat.length > 0) return;
    MateriaisService.getAll().then(setListaMat).catch(console.error);
  }, [step, listaMat.length]);

  // Carregar obras ao abrir
  useEffect(() => {
    setLoadingObras(true);
    ObrasManutencaoService.getAll()
      .then(all => setObras(all.filter(o => o.status === StatusObra.PROGRAMACAO || o.status === StatusObra.EXECUCAO)))
      .catch(console.error)
      .finally(() => setLoadingObras(false));
  }, []);

  // Carregar MO ao entrar no step mao-de-obra
  useEffect(() => {
    if (step !== 'mao-de-obra' || !obraSelecionada?.id) return;
    setLoadingMO(true);
    Promise.all([
      ObraRecursosCorrigidosService.getMaoDeObraByObra(obraSelecionada.id),
      MaoDeObraService.getObraMaoDeObra(obraSelecionada.id),
      ObraProgramacaoEquipeRecursosService.getMOReservadaByObra(obraSelecionada.id).catch(() => [] as ReservaAgregada[]),
    ]).then(([corrigidos, originais, reservas]) => {
      const reservaMap = new Map(reservas.map(r => [r.maoDeObraId ?? `__avulso__${r.descricao}`, r.quantidadeReservada]));
      setMoCorrigida(corrigidos.map(c => {
        const reservado = reservaMap.get(c.maoDeObraId ?? '') ?? 0;
        const disponivel = Math.max(0, (c.quantidade ?? 0) - reservado);
        return {
          item: { ...c, quantidade: disponivel },
          noCorrigido: true,
          noOriginal: originais.some(o => o.maoDeObraId === c.maoDeObraId),
          selecionado: disponivel > 0,
          quantidadeDisponivel: disponivel,
        };
      }));
      const idsCorrigidos = new Set(corrigidos.map(c => c.maoDeObraId).filter(Boolean));
      setMoOriginal(originais
        .filter(o => !idsCorrigidos.has(o.maoDeObraId))
        .map(o => {
          const reservado = reservaMap.get(o.maoDeObraId ?? '') ?? 0;
          const disponivel = Math.max(0, (o.quantidade ?? 0) - reservado);
          return {
            item: { ...o, quantidade: disponivel },
            noCorrigido: false,
            noOriginal: true,
            selecionado: false,
            quantidadeDisponivel: disponivel,
          };
        })
      );
    }).catch(console.error).finally(() => setLoadingMO(false));
  }, [step, obraSelecionada]);

  // Carregar materiais ao entrar no step material
  useEffect(() => {
    if (step !== 'material' || !obraSelecionada?.id) return;
    setLoadingMat(true);
    Promise.all([
      ObraRecursosCorrigidosService.getMateriaisByObra(obraSelecionada.id),
      MateriaisService.getObraMateriais(obraSelecionada.id),
      ObraMaterialRetiradoService.getByObra(obraSelecionada.id),
      ObraProgramacaoEquipeRecursosService.getMatReservadoByObra(obraSelecionada.id).catch(() => [] as ReservaAgregada[]),
    ]).then(([corrigidos, originais, retirados, reservas]) => {
      const reservaMap = new Map(reservas.map(r => [r.materialId ?? `__avulso__${r.descricao}`, r.quantidadeReservada]));
      setMatCorrigido(corrigidos.map(c => {
        const reservado = reservaMap.get(c.materialId ?? '') ?? 0;
        const disponivel = Math.max(0, (c.quantidade ?? 0) - reservado);
        return {
          item: { ...c, quantidade: disponivel },
          noCorrigido: true,
          noOriginal: originais.some(o => o.materialId === c.materialId),
          selecionado: disponivel > 0,
          quantidadeDisponivel: disponivel,
        };
      }));
      const idsCorrigidos = new Set(corrigidos.map(c => c.materialId).filter(Boolean));
      setMatOriginal(originais
        .filter(o => !idsCorrigidos.has(o.materialId))
        .map(o => {
          const reservado = reservaMap.get(o.materialId ?? '') ?? 0;
          const disponivel = Math.max(0, (o.quantidade ?? 0) - reservado);
          return {
            item: { ...o, quantidade: disponivel },
            noCorrigido: false,
            noOriginal: true,
            selecionado: false,
            quantidadeDisponivel: disponivel,
          };
        })
      );
      setMatRetirado(retirados.map(r => ({
        item: r,
        noCorrigido: false,
        noOriginal: false,
        selecionado: true,
      })));
    }).catch(console.error).finally(() => setLoadingMat(false));
  }, [step, obraSelecionada]);

  const handleSelecionarObra = async (obra: ObraManutencao) => {
    setObraSelecionada(obra);
    setEtapaForcada(null);
    // Verificar se já existe etapa definida para esta obra neste dia (pré-preenche como sugestão)
    try {
      const existentes = await ObraProgramacaoEquipeService.getByObraEData(obra.id!, date);
      if (existentes.length > 0 && existentes[0].etapa) {
        setEtapaForcada(existentes[0].etapa);
        setEtapa(existentes[0].etapa);
      } else {
        setEtapa('FINAL');
      }
    } catch {
      setEtapa('FINAL');
    }
    setStep('etapa');
  };

  const handleConfirmarEtapa = () => {
    setStep('mao-de-obra');
  };

  const handleConfirmarMO = () => {
    setShowFormMO(false);
    setStep('material');
  };

  const handleAdicionarMOAvulso = () => {
    if (!moSelecionadaAvulso) return;
    setMoAvulsos(prev => [...prev, {
      id: crypto.randomUUID(),
      descricao: moSelecionadaAvulso.descricao,
      quantidade: novoMOQtd || '1',
      unidade: '',
      selecionado: true,
    }]);
    setMoSelecionadaAvulso(null);
    setBuscaMO('');
    setNovoMOQtd('');
    setShowFormMO(false);
  };

  const handleAdicionarMatAvulso = () => {
    if (!matSelecionadaAvulso) return;
    setMatAvulsos(prev => [...prev, {
      id: crypto.randomUUID(),
      descricao: matSelecionadaAvulso.descricaoMaterial,
      quantidade: novoMatQtd || '1',
      unidade: matSelecionadaAvulso.unidadeMedida || '',
      selecionado: true,
    }]);
    setMatSelecionadaAvulso(null);
    setBuscaMat('');
    setNovoMatQtd('');
    setShowFormMat(false);
  };

  const handleSalvar = async () => {
    if (!obraSelecionada?.id) return;
    setSaving(true);
    try {
      // 1. Salvar a programação principal
      const programacao = await ObraProgramacaoEquipeService.add({
        obraId: obraSelecionada.id,
        equipeId: equipe.id,
        data: date,
        etapa,
      });

      const progId = programacao.id!;

      // 2. Montar lista de MO selecionada
      const moItems = [
        ...moCorrigida.filter(r => r.selecionado).map(r => ({
          programacaoId: progId,
          maoDeObraId: r.item.maoDeObraId ?? null,
          descricao: r.item.descricao || r.item.maoDeObraId || '',
          quantidade: r.item.quantidade ?? 1,
          tipo: 'reserva_corrigida' as const,
        })),
        ...moOriginal.filter(r => r.selecionado).map(r => ({
          programacaoId: progId,
          maoDeObraId: r.item.maoDeObraId ?? null,
          descricao: r.item.maoDeObra?.descricao || r.item.maoDeObraId || '',
          quantidade: r.item.quantidade ?? 1,
          tipo: 'reserva_original' as const,
        })),
        ...moAvulsos.filter(r => r.selecionado).map(r => ({
          programacaoId: progId,
          maoDeObraId: null,
          descricao: r.descricao,
          quantidade: parseFloat(r.quantidade) || 1,
          tipo: 'avulso' as const,
        })),
      ];

      // 3. Montar lista de Material selecionado
      const matItems = [
        ...matCorrigido.filter(r => r.selecionado).map(r => ({
          programacaoId: progId,
          materialId: r.item.materialId ?? null,
          descricao: r.item.descricaoMaterial || r.item.materialId || '',
          quantidade: r.item.quantidade ?? 1,
          unidade: r.item.unidadeMedida,
          tipo: 'reserva_corrigida' as const,
        })),
        ...matOriginal.filter(r => r.selecionado).map(r => ({
          programacaoId: progId,
          materialId: r.item.materialId ?? null,
          descricao: r.item.material?.descricaoMaterial || r.item.materialId || '',
          quantidade: r.item.quantidade ?? 1,
          unidade: r.item.material?.unidadeMedida,
          tipo: 'reserva_original' as const,
        })),
        ...matRetirado.filter(r => r.selecionado).map(r => ({
          programacaoId: progId,
          materialId: r.item.materialId ?? null,
          descricao: r.item.descricaoMaterial || r.item.materialId || '',
          quantidade: r.item.quantidade ?? 1,
          unidade: r.item.unidadeMedida,
          tipo: 'retirado' as const,
        })),
        ...matAvulsos.filter(r => r.selecionado).map(r => ({
          programacaoId: progId,
          materialId: null,
          descricao: r.descricao,
          quantidade: parseFloat(r.quantidade) || 1,
          unidade: r.unidade || undefined,
          tipo: 'avulso' as const,
        })),
      ];

      // 4. Persistir recursos em paralelo
      await Promise.all([
        ObraProgramacaoEquipeRecursosService.saveMaoDeObra(moItems),
        ObraProgramacaoEquipeRecursosService.saveMateriais(matItems),
      ]);

      // 5. Avançar status da obra para EXECUCAO
      if (obraSelecionada.status === StatusObra.PROGRAMACAO) {
        await ObrasManutencaoService.update({ id: obraSelecionada.id!, status: StatusObra.EXECUCAO });
      }

      // 6. Registrar log de programação
      ObraHistoricoService.addLog({
        obraId: obraSelecionada.id!,
        tipo: 'programacao',
        descricao: `Obra programada para ${date} — Etapa: ${etapa} — Equipe: ${equipe.prefixo || equipe.nome}`,
        usuarioId: user?.id ?? null,
        usuarioNome: user?.nome ?? null,
        metadata: {
          equipeId: equipe.id,
          equipe: equipe.prefixo || equipe.nome,
          data: date,
          etapa,
          programacaoId: progId,
        },
      }).catch(() => {}); // log não-bloqueante

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const obrasFiltradas = obras.filter(o => {
    const q = obraSearch.toLowerCase();
    return !q ||
      o.numeroProjeto?.toLowerCase().includes(q) ||
      o.enderecoObra?.toLowerCase().includes(q) ||
      o.municipio?.toLowerCase().includes(q) ||
      o.setor?.toLowerCase().includes(q);
  });

  const stepLabel: Record<Step, string> = {
    'obra': 'Selecionar Obra',
    'etapa': 'Definir Etapa',
    'mao-de-obra': 'Mão de Obra',
    'material': 'Materiais',
  };
  const steps: Step[] = ['obra', 'etapa', 'mao-de-obra', 'material'];
  const stepIndex = steps.indexOf(step);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">
            Programar Obra — {equipe.prefixo || equipe.nome}
          </DialogTitle>
          <DialogDescription className="text-xs">{date}</DialogDescription>
          {/* Stepper */}
          <div className="flex items-center gap-1 mt-3">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  i === stepIndex ? 'bg-blue-600 text-white' :
                  i < stepIndex ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  <span>{i < stepIndex ? '✓' : i + 1}</span>
                  <span>{stepLabel[s]}</span>
                </div>
                {i < steps.length - 1 && <div className="h-px flex-1 bg-gray-200" />}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* STEP 1 — OBRA */}
          {step === 'obra' && (
            <div className="space-y-3">
              <Input
                placeholder="Buscar por número, endereço, município ou setor..."
                value={obraSearch}
                onChange={e => setObraSearch(e.target.value)}
                autoFocus
              />
              {loadingObras ? (
                <div className="text-center py-8 text-gray-400 text-sm">Carregando obras...</div>
              ) : obrasFiltradas.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Nenhuma obra em programação encontrada</div>
              ) : (
                <div className="space-y-1.5">
                  {obrasFiltradas.map(obra => (
                    <button
                      key={obra.id}
                      onClick={() => handleSelecionarObra(obra)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-700">{obra.numeroProjeto}</span>
                        {obra.status === StatusObra.EXECUCAO
                          ? <Badge className="bg-emerald-100 text-emerald-700 text-xs border-0">Execução</Badge>
                          : <Badge className="bg-orange-100 text-orange-700 text-xs border-0">Programação</Badge>
                        }
                      </div>
                      {obra.enderecoObra && <p className="text-xs text-gray-700 mt-0.5 truncate">{obra.enderecoObra}</p>}
                      <p className="text-xs text-gray-400">{obra.municipio}{obra.setor ? ` · ${obra.setor}` : ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — ETAPA */}
          {step === 'etapa' && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <span className="font-semibold text-blue-800">{obraSelecionada?.numeroProjeto}</span>
                {obraSelecionada?.enderecoObra && <span className="text-blue-600"> · {obraSelecionada.enderecoObra}</span>}
              </div>

              {/* Info quando outra equipe já tem etapa neste dia (apenas informativo) */}
              {etapaForcada && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
                  <span className="text-base">ℹ️</span>
                  <span>Outra equipe já está com <strong>Etapa {etapaForcada}</strong> neste dia. Pré-selecionada como sugestão.</span>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Etapa:</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEtapa(e => { const n = Math.max(1, parseInt(e === 'FINAL' || e === 'UNICA' ? '1' : e) - 1); return String(n); })}
                    disabled={false}
                    className="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-base flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >−</button>
                  <span className={`w-12 text-center text-lg font-bold rounded px-2 py-1 ${
                    etapa !== 'FINAL' && etapa !== 'UNICA' ? 'bg-blue-50 text-blue-700 border border-blue-300' : 'text-gray-400'
                  }`}>
                    {etapa !== 'FINAL' && etapa !== 'UNICA' ? etapa : '—'}
                  </span>
                  <button
                    onClick={() => setEtapa(e => { const n = Math.min(20, parseInt(e === 'FINAL' || e === 'UNICA' ? '0' : e) + 1); return String(n); })}
                    disabled={false}
                    className="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-base flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >+</button>
                </div>
                <span className="text-gray-400 text-sm">ou</span>
                <button
                  onClick={() => setEtapa('FINAL')}
                  disabled={false}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                    etapa === 'FINAL'
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-green-400 hover:bg-green-50'
                  }`}
                >
                  Etapa Final
                </button>
                <button
                  onClick={() => setEtapa('UNICA')}
                  disabled={false}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                    etapa === 'UNICA'
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  Etapa Única
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — MÃO DE OBRA */}
          {step === 'mao-de-obra' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded">✓ Reserva corrigida</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded">⚠ Reserva original</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded">⚡ Sem fluxo</span>
              </div>
              {loadingMO ? (
                <div className="text-center py-8 text-gray-400 text-sm">Carregando mão de obra...</div>
              ) : (
                <>
                  {moCorrigida.length === 0 && moOriginal.length === 0 && moAvulsos.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-sm">Nenhuma mão de obra cadastrada para esta obra.</div>
                  )}
                  {moCorrigida.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reserva Corrigida ({moCorrigida.length})</p>
                      {moCorrigida.map((rec, i) => {
                        const esgotado = (rec.quantidadeDisponivel ?? rec.item.quantidade ?? 1) <= 0;
                        return (
                        <div
                          key={i}
                          onClick={() => !esgotado && setMoCorrigida(prev => prev.map((r, j) => j === i ? { ...r, selecionado: !r.selecionado } : r))}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                            esgotado ? 'bg-gray-100 border-gray-200 opacity-40 cursor-not-allowed' :
                            rec.selecionado ? 'bg-blue-50 border-blue-300 cursor-pointer' : 'bg-gray-50 border-gray-200 opacity-50 cursor-pointer'
                          }`}
                        >
                          <input type="checkbox" checked={rec.selecionado && !esgotado} readOnly disabled={esgotado} className="w-4 h-4 accent-blue-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{rec.item.descricao || rec.item.codigo || `MO ${i + 1}`}</p>
                            {rec.item.up && <p className="text-xs text-gray-400">UP: {rec.item.up}</p>}
                          </div>
                          {esgotado ? (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded flex-shrink-0">Esgotado</span>
                          ) : (
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={rec.item.quantidade}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setMoCorrigida(prev => prev.map((r, j) => j === i ? { ...r, item: { ...r.item, quantidade: parseFloat(e.target.value) || 0 } } : r))}
                              className="w-16 h-7 text-xs text-center border border-gray-300 rounded px-1 bg-white flex-shrink-0"
                            />
                          )}
                          {!rec.noOriginal && !esgotado && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded flex-shrink-0">Sem original</span>}
                        </div>
                        );
                      })}
                    </div>
                  )}
                  {moOriginal.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Reserva Original — sem corrigido ({moOriginal.length})</p>
                      {moOriginal.map((rec, i) => {
                        const esgotado = (rec.quantidadeDisponivel ?? rec.item.quantidade ?? 1) <= 0;
                        return (
                        <div
                          key={i}
                          onClick={() => !esgotado && setMoOriginal(prev => prev.map((r, j) => j === i ? { ...r, selecionado: !r.selecionado } : r))}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-colors ${
                            esgotado ? 'bg-gray-100 border-gray-200 opacity-40 cursor-not-allowed' :
                            rec.selecionado ? 'bg-red-50 border-red-300 cursor-pointer' : 'bg-gray-50 border-gray-200 opacity-50 cursor-pointer'
                          }`}
                        >
                          <input type="checkbox" checked={rec.selecionado && !esgotado} readOnly disabled={esgotado} className="w-4 h-4 accent-red-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{rec.item.maoDeObra?.descricao || rec.item.maoDeObra?.codigoNovo || rec.item.maoDeObraId}</p>
                          </div>
                          {esgotado ? (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded flex-shrink-0">Esgotado</span>
                          ) : (
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={rec.item.quantidade}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setMoOriginal(prev => prev.map((r, j) => j === i ? { ...r, item: { ...r.item, quantidade: parseFloat(e.target.value) || 0 } } : r))}
                              className="w-16 h-7 text-xs text-center border border-gray-300 rounded px-1 bg-white flex-shrink-0"
                            />
                          )}
                          {!esgotado && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded flex-shrink-0">Reserva original</span>}
                        </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Avulsos */}
                  {moAvulsos.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Avulsos — sem fluxo ({moAvulsos.length})</p>
                      {moAvulsos.map((av) => (
                        <div
                          key={av.id}
                          onClick={() => setMoAvulsos(prev => prev.map(r => r.id === av.id ? { ...r, selecionado: !r.selecionado } : r))}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                            av.selecionado ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200 opacity-50'
                          }`}
                        >
                          <input type="checkbox" checked={av.selecionado} readOnly className="w-4 h-4 accent-orange-500" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{av.descricao}</p>
                            {av.unidade && <p className="text-xs text-gray-400">{av.unidade}</p>}
                          </div>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={av.quantidade}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setMoAvulsos(prev => prev.map(r => r.id === av.id ? { ...r, quantidade: e.target.value } : r))}
                            className="w-16 h-7 text-xs text-center border border-gray-300 rounded px-1 bg-white flex-shrink-0"
                          />
                          <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded flex-shrink-0">Sem fluxo</span>
                          <button onClick={e => { e.stopPropagation(); setMoAvulsos(prev => prev.filter(r => r.id !== av.id)); }} className="text-gray-400 hover:text-red-500 flex-shrink-0 text-base leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Formulário avulso MO */}
                  {showFormMO ? (
                    <div className="border-2 border-dashed border-orange-300 rounded-lg p-3 space-y-2 bg-orange-50">
                      <p className="text-xs font-semibold text-orange-700">Adicionar mão de obra avulsa</p>
                      {/* Busca */}
                      <Input
                        placeholder="Buscar mão de obra..."
                        value={buscaMO}
                        onChange={e => { setBuscaMO(e.target.value); setMoSelecionadaAvulso(null); }}
                        className="h-8 text-xs"
                        autoFocus
                      />
                      {/* Dropdown de resultados */}
                      {buscaMO.trim() && !moSelecionadaAvulso && (
                        <div className="max-h-36 overflow-y-auto border border-orange-200 rounded bg-white">
                          {listaMO
                            .filter(m => m.descricao.toLowerCase().includes(buscaMO.toLowerCase()) || m.codigoNovo?.toLowerCase().includes(buscaMO.toLowerCase()))
                            .slice(0, 10)
                            .map(m => (
                              <button
                                key={m.id}
                                onClick={() => { setMoSelecionadaAvulso(m); setBuscaMO(m.descricao); }}
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-orange-50 border-b border-gray-100 last:border-0"
                              >
                                <span className="font-medium">{m.descricao}</span>
                                {m.codigoNovo && <span className="text-gray-400 ml-1">({m.codigoNovo})</span>}
                              </button>
                            ))}
                          {listaMO.filter(m => m.descricao.toLowerCase().includes(buscaMO.toLowerCase())).length === 0 && (
                            <p className="px-2 py-2 text-xs text-gray-400">Nenhum resultado</p>
                          )}
                        </div>
                      )}
                      {moSelecionadaAvulso && (
                        <div className="flex gap-2 items-center">
                          <Input placeholder="Qtd" value={novoMOQtd} onChange={e => setNovoMOQtd(e.target.value)} className="h-8 text-xs w-20" />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={handleAdicionarMOAvulso} disabled={!moSelecionadaAvulso}>Adicionar</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowFormMO(false); setBuscaMO(''); setMoSelecionadaAvulso(null); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowFormMO(true)}
                      className="w-full py-2 border-2 border-dashed border-orange-200 rounded-lg text-xs text-orange-500 hover:border-orange-400 hover:bg-orange-50 transition-colors font-medium"
                    >
                      + Adicionar mão de obra avulsa (sem fluxo)
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 4 — MATERIAIS */}
          {step === 'material' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded">✓ Reserva corrigida</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded">⚠ Reserva original</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded">⚡ Sem fluxo</span>
              </div>
              {loadingMat ? (
                <div className="text-center py-8 text-gray-400 text-sm">Carregando materiais...</div>
              ) : (
                <>
                  {matCorrigido.length === 0 && matOriginal.length === 0 && matAvulsos.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-sm">Nenhum material cadastrado para esta obra.</div>
                  )}
                  {matCorrigido.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reserva Corrigida ({matCorrigido.length})</p>
                      {matCorrigido.map((rec, i) => {
                        const esgotado = (rec.quantidadeDisponivel ?? rec.item.quantidade ?? 1) <= 0;
                        return (
                        <div
                          key={i}
                          onClick={() => !esgotado && setMatCorrigido(prev => prev.map((r, j) => j === i ? { ...r, selecionado: !r.selecionado } : r))}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                            esgotado ? 'bg-gray-100 border-gray-200 opacity-40 cursor-not-allowed' :
                            rec.selecionado ? 'bg-blue-50 border-blue-300 cursor-pointer' : 'bg-gray-50 border-gray-200 opacity-50 cursor-pointer'
                          }`}
                        >
                          <input type="checkbox" checked={rec.selecionado && !esgotado} readOnly disabled={esgotado} className="w-4 h-4 accent-blue-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{rec.item.descricaoMaterial || rec.item.numeroMaterial || `Mat. ${i + 1}`}</p>
                            {rec.item.unidadeMedida && <p className="text-xs text-gray-400">{rec.item.unidadeMedida}</p>}
                          </div>
                          {esgotado ? (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded flex-shrink-0">Esgotado</span>
                          ) : (
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={rec.item.quantidade}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setMatCorrigido(prev => prev.map((r, j) => j === i ? { ...r, item: { ...r.item, quantidade: parseFloat(e.target.value) || 0 } } : r))}
                              className="w-16 h-7 text-xs text-center border border-gray-300 rounded px-1 bg-white flex-shrink-0"
                            />
                          )}
                          {!rec.noOriginal && !esgotado && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded flex-shrink-0">Sem original</span>}
                        </div>
                        );
                      })}
                    </div>
                  )}
                  {matOriginal.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Reserva Original — sem corrigido ({matOriginal.length})</p>
                      {matOriginal.map((rec, i) => {
                        const esgotado = (rec.quantidadeDisponivel ?? rec.item.quantidade ?? 1) <= 0;
                        return (
                        <div
                          key={i}
                          onClick={() => !esgotado && setMatOriginal(prev => prev.map((r, j) => j === i ? { ...r, selecionado: !r.selecionado } : r))}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-colors ${
                            esgotado ? 'bg-gray-100 border-gray-200 opacity-40 cursor-not-allowed' :
                            rec.selecionado ? 'bg-red-50 border-red-300 cursor-pointer' : 'bg-gray-50 border-gray-200 opacity-50 cursor-pointer'
                          }`}
                        >
                          <input type="checkbox" checked={rec.selecionado && !esgotado} readOnly disabled={esgotado} className="w-4 h-4 accent-red-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{rec.item.material?.descricaoMaterial || rec.item.material?.numeroMaterial || rec.item.materialId}</p>
                            {rec.item.material?.unidadeMedida && <p className="text-xs text-gray-400">{rec.item.material.unidadeMedida}</p>}
                          </div>
                          {esgotado ? (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded flex-shrink-0">Esgotado</span>
                          ) : (
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={rec.item.quantidade}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setMatOriginal(prev => prev.map((r, j) => j === i ? { ...r, item: { ...r.item, quantidade: parseFloat(e.target.value) || 0 } } : r))}
                              className="w-16 h-7 text-xs text-center border border-gray-300 rounded px-1 bg-white flex-shrink-0"
                            />
                          )}
                          {!esgotado && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded flex-shrink-0">Reserva original</span>}
                        </div>
                        );
                      })}
                    </div>
                  )}
                  {matRetirado.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Material retirado ({matRetirado.length})</p>
                      {matRetirado.map((rec, i) => (
                        <div
                          key={i}
                          onClick={() => setMatRetirado(prev => prev.map((r, j) => j === i ? { ...r, selecionado: !r.selecionado } : r))}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            rec.selecionado ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200 opacity-50'
                          }`}
                        >
                          <input type="checkbox" checked={rec.selecionado} readOnly className="w-4 h-4 accent-purple-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{rec.item.descricaoMaterial || rec.item.numeroMaterial || `Retirado ${i + 1}`}</p>
                            {rec.item.destino && <p className="text-xs text-gray-400">{rec.item.destino}</p>}
                          </div>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={rec.item.quantidade}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setMatRetirado(prev => prev.map((r, j) => j === i ? { ...r, item: { ...r.item, quantidade: parseFloat(e.target.value) || 0 } } : r))}
                            className="w-16 h-7 text-xs text-center border border-gray-300 rounded px-1 bg-white flex-shrink-0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Avulsos de material */}
                  {matAvulsos.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Avulsos — sem fluxo ({matAvulsos.length})</p>
                      {matAvulsos.map((av) => (
                        <div
                          key={av.id}
                          onClick={() => setMatAvulsos(prev => prev.map(r => r.id === av.id ? { ...r, selecionado: !r.selecionado } : r))}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                            av.selecionado ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200 opacity-50'
                          }`}
                        >
                          <input type="checkbox" checked={av.selecionado} readOnly className="w-4 h-4 accent-orange-500" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{av.descricao}</p>
                            {av.unidade && <p className="text-xs text-gray-400">{av.unidade}</p>}
                          </div>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={av.quantidade}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setMatAvulsos(prev => prev.map(r => r.id === av.id ? { ...r, quantidade: e.target.value } : r))}
                            className="w-16 h-7 text-xs text-center border border-gray-300 rounded px-1 bg-white flex-shrink-0"
                          />
                          <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded flex-shrink-0">Sem fluxo</span>
                          <button onClick={e => { e.stopPropagation(); setMatAvulsos(prev => prev.filter(r => r.id !== av.id)); }} className="text-gray-400 hover:text-red-500 flex-shrink-0 text-base leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Formulário avulso Material */}
                  {showFormMat ? (
                    <div className="border-2 border-dashed border-orange-300 rounded-lg p-3 space-y-2 bg-orange-50">
                      <p className="text-xs font-semibold text-orange-700">Adicionar material avulso</p>
                      {/* Busca */}
                      <Input
                        placeholder="Buscar material..."
                        value={buscaMat}
                        onChange={e => { setBuscaMat(e.target.value); setMatSelecionadaAvulso(null); }}
                        className="h-8 text-xs"
                        autoFocus
                      />
                      {/* Dropdown de resultados */}
                      {buscaMat.trim() && !matSelecionadaAvulso && (
                        <div className="max-h-36 overflow-y-auto border border-orange-200 rounded bg-white">
                          {listaMat
                            .filter(m => m.descricaoMaterial.toLowerCase().includes(buscaMat.toLowerCase()) || m.numeroMaterial?.toLowerCase().includes(buscaMat.toLowerCase()))
                            .slice(0, 10)
                            .map(m => (
                              <button
                                key={m.id}
                                onClick={() => { setMatSelecionadaAvulso(m); setBuscaMat(m.descricaoMaterial); }}
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-orange-50 border-b border-gray-100 last:border-0"
                              >
                                <span className="font-medium">{m.descricaoMaterial}</span>
                                {m.numeroMaterial && <span className="text-gray-400 ml-1">({m.numeroMaterial})</span>}
                                {m.unidadeMedida && <span className="text-gray-400 ml-1">· {m.unidadeMedida}</span>}
                              </button>
                            ))}
                          {listaMat.filter(m => m.descricaoMaterial.toLowerCase().includes(buscaMat.toLowerCase())).length === 0 && (
                            <p className="px-2 py-2 text-xs text-gray-400">Nenhum resultado</p>
                          )}
                        </div>
                      )}
                      {matSelecionadaAvulso && (
                        <div className="flex gap-2 items-center">
                          <Input placeholder="Qtd" value={novoMatQtd} onChange={e => setNovoMatQtd(e.target.value)} className="h-8 text-xs w-20" />
                          <span className="text-xs text-gray-500">{matSelecionadaAvulso.unidadeMedida}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={handleAdicionarMatAvulso} disabled={!matSelecionadaAvulso}>Adicionar</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowFormMat(false); setBuscaMat(''); setMatSelecionadaAvulso(null); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowFormMat(true)}
                      className="w-full py-2 border-2 border-dashed border-orange-200 rounded-lg text-xs text-orange-500 hover:border-orange-400 hover:bg-orange-50 transition-colors font-medium"
                    >
                      + Adicionar material avulso (sem corrigido)
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (step === 'obra') onClose();
              else if (step === 'etapa') setStep('obra');
              else if (step === 'mao-de-obra') setStep('etapa');
              else if (step === 'material') setStep('mao-de-obra');
            }}
          >
            {step === 'obra' ? 'Cancelar' : '← Voltar'}
          </Button>

          {step === 'obra' && null}
          {step === 'etapa' && (
            <Button size="sm" onClick={handleConfirmarEtapa}>
              Próximo: Mão de Obra →
            </Button>
          )}
          {step === 'mao-de-obra' && (
            <Button size="sm" onClick={handleConfirmarMO}>
              Próximo: Materiais →
            </Button>
          )}
          {step === 'material' && (
            <Button size="sm" onClick={handleSalvar} disabled={saving}>
              {saving ? 'Salvando...' : 'Confirmar Programação'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
