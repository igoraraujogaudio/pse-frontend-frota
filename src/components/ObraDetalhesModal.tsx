'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ObraManutencao, StatusObra, STATUS_LABELS, STATUS_COLORS } from '@/types/obras-manutencao';
import { Material, ObraMaterial } from '@/types/materiais';
import { MaoDeObra, ObraMaoDeObra } from '@/types/mao-de-obra';
import { MateriaisService } from '@/services/materiaisService';
import { MaoDeObraService } from '@/services/maoDeObraService';
import { ObrasManutencaoService } from '@/services/obrasManutencaoService';
import { ComparativoViabilidade } from '@/components/ComparativoViabilidade';
import { useAuth } from '@/contexts/AuthContext';
import { ViabilidadeRecursosService } from '@/services/viabilidadeRecursosService';
import { supabase } from '@/lib/supabase';
import { ViabilidadeMaterial, ViabilidadeMaoDeObra } from '@/types/viabilidade-recursos';
import { ObraMaterialRetiradoService } from '@/services/obraMaterialRetiradoService';
import { ObraMaterialRetirado, DestinoMaterialRetirado, DESTINO_LABELS, DESTINO_COLORS } from '@/types/obra-material-retirado';
import { ObraHistoricoService, ObraHistoricoEntry } from '@/services/obraHistoricoService';
import { ObraFluxoService, EntregaAlmoxarifado } from '@/services/obraFluxoService';
import { ObraProgramacaoEquipeService, ObraProgramacaoEquipe, STATUS_EXECUCAO_LABELS, STATUS_EXECUCAO_COLORS, StatusExecucao } from '@/services/obraProgramacaoEquipeService';
import { FluxoEtapaModal } from '@/components/FluxoEtapaModal';
import { RetornoExecucaoModal } from '@/components/ApontamentoExecucaoModal';
import { AprovacaoMedicaoModal } from '@/components/AprovacaoMedicaoModal';
import { 
  Plus, 
  Trash2, 
  Search, 
  Package, 
  FileText,
  MapPin,
  Calendar,
  Building2,
  HardHat,
  GitCompareArrows,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Workflow,
  CheckCheck,
  Eye
} from 'lucide-react';

const CONTRATO_GOIAS = '03413132-fba2-459e-911f-478b9af69d21';
const MAX_SELECT_ITEMS = 50;

const STATUS_ORDER: StatusObra[] = [
  StatusObra.CADASTRADA,
  StatusObra.VIABILIDADE,
  StatusObra.PROGRAMACAO,
  StatusObra.EXECUCAO,
  StatusObra.APROVACAO_MEDICAO,
  StatusObra.MEDICAO,
  StatusObra.ENCERRAMENTO,
  StatusObra.FATURAMENTO,
];
const statusIdx = (s: StatusObra) => STATUS_ORDER.indexOf(s);

interface ObraDetalhesModalProps {
  obra: ObraManutencao | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (obraId: string, newStatus: StatusObra) => void;
  basesMap?: Map<string, string>;
}

export function ObraDetalhesModal({ obra, isOpen, onClose, onStatusChange, basesMap }: ObraDetalhesModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('detalhes');
  const [currentStatus, setCurrentStatus] = useState<StatusObra>(obra?.status ?? StatusObra.CADASTRADA);

  // ===== Material Retirado =====
  const [materiaisRetirados, setMateriaisRetirados] = useState<ObraMaterialRetirado[]>([]);
  const [, setRetLoaded] = useState(false);
  const [retSearchCatalogo, setRetSearchCatalogo] = useState('');
  const [retMatId, setRetMatId] = useState('');
  const [retMatNome, setRetMatNome] = useState('');
  const [retDescricao, setRetDescricao] = useState('');
  const [retNumero, setRetNumero] = useState('');
  const [retUnidade, setRetUnidade] = useState('UN');
  const [retQtd, setRetQtd] = useState('');
  const [retDestino, setRetDestino] = useState<DestinoMaterialRetirado>('sucata');
  const [retObs, setRetObs] = useState('');
  const [retSaving, setRetSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [historico, setHistorico] = useState<ObraHistoricoEntry[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [programacoes, setProgramacoes] = useState<ObraProgramacaoEquipe[]>([]);
  const [loadingProg, setLoadingProg] = useState(false);
  const [fluxoAberto, setFluxoAberto] = useState<ObraProgramacaoEquipe | null>(null);
  const [apontamentoAberto, setApontamentoAberto] = useState<ObraProgramacaoEquipe | null>(null);
  const [aprovacaoMedicaoAberta, setAprovacaoMedicaoAberta] = useState(false);
  const [entregasObra, setEntregasObra] = useState<EntregaAlmoxarifado[]>([]);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showAddMO, setShowAddMO] = useState(false);
  const [showAddRetirado, setShowAddRetirado] = useState(false);

  // ===== Viabilidade state =====
  const [viabMateriais, setViabMateriais] = useState<ViabilidadeMaterial[]>([]);
  const [viabMO, setViabMO] = useState<ViabilidadeMaoDeObra[]>([]);
  const viabLoaded = useRef(false);

  // ===== Viabilidade Checklist state =====
  const [viabChecklist, setViabChecklist] = useState<Record<string, any> | null>(null);
  const viabChecklistLoaded = useRef(false);

  // ===== Materiais state =====
  const [obraMateriais, setObraMateriais] = useState<ObraMaterial[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [selectedMaterialName, setSelectedMaterialName] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('');
  const [valorUnitario, setValorUnitario] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const materiaisLoaded = useRef(false);
  const historicoLoaded = useRef(false);
  const progLoadedRef = useRef(false);

  // ===== Mão de Obra state =====
  const [obraMaoDeObra, setObraMaoDeObra] = useState<ObraMaoDeObra[]>([]);
  const [maoDeObraList, setMaoDeObraList] = useState<MaoDeObra[]>([]);
  const [loadingMO, setLoadingMO] = useState(false);
  const [searchTermMO, setSearchTermMO] = useState('');
  const [selectedMO, setSelectedMO] = useState<string>('');
  const [selectedMOName, setSelectedMOName] = useState<string>('');
  const [quantidadeMO, setQuantidadeMO] = useState<string>('');
  const [valorUnitarioMO, setValorUnitarioMO] = useState<string>('');
  const [editingIdMO, setEditingIdMO] = useState<string | null>(null);
  const moLoaded = useRef(false);
  const retLoadedRef = useRef(false);

  // ===== Load Materiais =====
  const loadObraMateriais = useCallback(async () => {
    if (!obra?.id) return;
    try {
      setLoading(true);
      const data = await MateriaisService.getObraMateriais(obra.id);
      setObraMateriais(data);
    } catch (error) {
      console.error('Erro ao carregar materiais da obra:', error);
    } finally {
      setLoading(false);
    }
  }, [obra?.id]);

  const loadMateriais = useCallback(async () => {
    try {
      const data = await MateriaisService.getAll(CONTRATO_GOIAS);
      setMateriais(data);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
    }
  }, []);

  // ===== Load Mão de Obra =====
  const loadObraMaoDeObra = useCallback(async () => {
    if (!obra?.id) return;
    try {
      setLoadingMO(true);
      const data = await MaoDeObraService.getObraMaoDeObra(obra.id);
      setObraMaoDeObra(data);
    } catch (error) {
      console.error('Erro ao carregar mão de obra da obra:', error);
    } finally {
      setLoadingMO(false);
    }
  }, [obra?.id]);

  const loadMaoDeObra = useCallback(async () => {
    try {
      const data = await MaoDeObraService.getAll(CONTRATO_GOIAS);
      setMaoDeObraList(data);
    } catch (error) {
      console.error('Erro ao carregar mão de obra:', error);
    }
  }, []);

  const loadHistorico = useCallback(async () => {
    if (!obra?.id) return;
    setLoadingHistorico(true);
    try {
      const data = await ObraHistoricoService.getByObra(obra.id);
      setHistorico(data);
    } catch { /* silencioso se tabela ainda não existir */ }
    finally { setLoadingHistorico(false); }
  }, [obra?.id]);

  // ===== Load Viabilidade =====
  const loadViabilidade = useCallback(async () => {
    if (!obra?.id) return;
    try {
      const [mat, mo] = await Promise.all([
        ViabilidadeRecursosService.getMateriaisByObra(obra.id),
        ViabilidadeRecursosService.getMaoDeObraByObra(obra.id),
      ]);
      setViabMateriais(mat);
      setViabMO(mo);
    } catch (e) { console.error('Erro ao carregar viabilidade:', e); }
  }, [obra?.id]);

  const loadViabChecklist = useCallback(async () => {
    if (!obra?.id) return;
    try {
      const { data, error } = await supabase
        .from('viabilidade_checklist')
        .select('*')
        .eq('obra_id', obra.id)
        .maybeSingle();
      if (error) throw error;
      setViabChecklist(data);
    } catch (e) { console.error('Erro ao carregar checklist viabilidade:', e); }
  }, [obra?.id]);

  // ===== Effects =====
  useEffect(() => {
    if (isOpen && obra?.status) {
      setCurrentStatus(obra.status);
    }
    if (!isOpen) {
      materiaisLoaded.current = false;
      moLoaded.current = false;
      retLoadedRef.current = false;
      historicoLoaded.current = false;
      progLoadedRef.current = false;
      viabLoaded.current = false;
      viabChecklistLoaded.current = false;
      setRetLoaded(false);
      setMateriaisRetirados([]);
      setHistorico([]);
      setProgramacoes([]);
      setViabChecklist(null);
    }
  }, [isOpen, obra?.status]);

  const loadProgramacoes = useCallback(async () => {
    if (!obra?.id) return;
    setLoadingProg(true);
    try {
      const today = new Date();
      const start = new Date(today);
      start.setFullYear(start.getFullYear() - 1);
      const end = new Date(today);
      end.setFullYear(end.getFullYear() + 1);
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const [progs, entregas] = await Promise.all([
        ObraProgramacaoEquipeService.getByObraId(obra.id, fmt(start), fmt(end)),
        ObraFluxoService.getEntregasByObra(obra.id),
      ]);
      setProgramacoes(progs);
      setEntregasObra(entregas);
    } catch (e) { console.error('Erro ao carregar programações:', e); }
    finally { setLoadingProg(false); }
  }, [obra?.id]);

  // Carrega contagens + histórico ao abrir o modal
  useEffect(() => {
    if (obra?.id && isOpen) {
      if (!materiaisLoaded.current) {
        materiaisLoaded.current = true;
        loadObraMateriais();
      }
      if (!moLoaded.current) {
        moLoaded.current = true;
        loadObraMaoDeObra();
      }
      if (!historicoLoaded.current) {
        historicoLoaded.current = true;
        loadHistorico();
      }
      if (!progLoadedRef.current) {
        progLoadedRef.current = true;
        loadProgramacoes();
      }
      if (!viabLoaded.current && obra.status === StatusObra.VIABILIDADE) {
        viabLoaded.current = true;
        loadViabilidade();
      }
    }
  }, [obra?.id, isOpen, loadObraMateriais, loadObraMaoDeObra, loadHistorico, loadProgramacoes, loadViabilidade, obra?.status]);

  // Carrega catálogo ao entrar na aba materiais
  useEffect(() => {
    if (obra?.id && isOpen && activeTab === 'materiais') {
      loadMateriais();
    }
  }, [obra?.id, isOpen, activeTab, loadMateriais]);

  // Carrega checklist viabilidade ao entrar na aba
  useEffect(() => {
    if (obra?.id && isOpen && activeTab === 'viabilidade-checklist' && !viabChecklistLoaded.current) {
      viabChecklistLoaded.current = true;
      loadViabChecklist();
    }
  }, [obra?.id, isOpen, activeTab, loadViabChecklist]);

  // Carrega catálogo ao entrar na aba mão de obra
  useEffect(() => {
    if (obra?.id && isOpen && activeTab === 'mao-de-obra') {
      loadMaoDeObra();
    }
  }, [obra?.id, isOpen, activeTab, loadObraMaoDeObra, loadMaoDeObra]);

  // ===== Materiais handlers =====
  const handleSelectMaterial = (mat: Material) => {
    setSelectedMaterial(mat.id!);
    setSelectedMaterialName(`${mat.numeroMaterial} - ${mat.descricaoMaterial}`);
    setSearchTerm('');
  };

  const handleAddMaterial = async () => {
    if (!obra?.id || !selectedMaterial || !quantidade) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    try {
      const qtd = parseFloat(quantidade);
      const valor = valorUnitario ? parseFloat(valorUnitario.replace(/\./g, '').replace(',', '.')) : undefined;
      if (isViabilidade) {
        await ViabilidadeRecursosService.upsertMaterial({
          obraId: obra.id,
          materialId: selectedMaterial,
          quantidade: qtd,
          valorUnitario: valor,
        });
        resetForm();
        loadViabilidade();
      } else {
        if (editingId) {
          await MateriaisService.updateObraMaterial(editingId, qtd, valor);
        } else {
          await MateriaisService.addMaterialToObra({
            obraId: obra.id,
            materialId: selectedMaterial,
            quantidade: qtd,
            valorUnitario: valor
          });
        }
        resetForm();
        loadObraMateriais();
      }
    } catch (error) {
      console.error('Erro ao adicionar material:', error);
      alert('Erro ao adicionar material. Verifique se o material já não foi adicionado.');
    }
  };

  const handleEditMaterial = (obraMaterial: ObraMaterial) => {
    setEditingId(obraMaterial.id || null);
    setSelectedMaterial(obraMaterial.materialId);
    setSelectedMaterialName(
      obraMaterial.material 
        ? `${obraMaterial.material.numeroMaterial} - ${obraMaterial.material.descricaoMaterial}`
        : obraMaterial.materialId
    );
    setQuantidade(obraMaterial.quantidade.toString());
    setValorUnitario(
      obraMaterial.valorUnitario 
        ? obraMaterial.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''
    );
    setShowAddMaterial(true);
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este material?')) return;
    try {
      await MateriaisService.removeObraMaterial(id);
      loadObraMateriais();
    } catch (error) {
      console.error('Erro ao remover material:', error);
      alert('Erro ao remover material.');
    }
  };

  const resetForm = () => {
    setSelectedMaterial('');
    setSelectedMaterialName('');
    setQuantidade('');
    setValorUnitario('');
    setEditingId(null);
    setSearchTerm('');
  };

  // ===== Mão de Obra handlers =====
  const handleSelectMO = (mo: MaoDeObra) => {
    setSelectedMO(mo.id!);
    setSelectedMOName(`${mo.codigoNovo} - ${mo.descricao}`);
    setSearchTermMO('');
    if (mo.valorUnitario) {
      setValorUnitarioMO(mo.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  const handleAddMO = async () => {
    if (!obra?.id || !selectedMO || !quantidadeMO) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    try {
      const qtd = parseFloat(quantidadeMO);
      const valor = valorUnitarioMO ? parseFloat(valorUnitarioMO.replace(/\./g, '').replace(',', '.')) : undefined;
      if (isViabilidade) {
        await ViabilidadeRecursosService.upsertMaoDeObra({
          obraId: obra.id,
          maoDeObraId: selectedMO,
          quantidade: qtd,
          valorUnitario: valor,
        });
        resetFormMO();
        loadViabilidade();
      } else {
        if (editingIdMO) {
          await MaoDeObraService.updateObraMaoDeObra(editingIdMO, qtd, valor);
        } else {
          await MaoDeObraService.addMaoDeObraToObra({
            obraId: obra.id,
            maoDeObraId: selectedMO,
            quantidade: qtd,
            valorUnitario: valor
          });
        }
        resetFormMO();
        loadObraMaoDeObra();
      }
    } catch (error) {
      console.error('Erro ao adicionar mão de obra:', error);
      alert('Erro ao adicionar mão de obra. Verifique se já não foi adicionado.');
    }
  };

  const handleEditMO = (obraMO: ObraMaoDeObra) => {
    setEditingIdMO(obraMO.id || null);
    setSelectedMO(obraMO.maoDeObraId);
    setSelectedMOName(
      obraMO.maoDeObra 
        ? `${obraMO.maoDeObra.codigoNovo} - ${obraMO.maoDeObra.descricao}`
        : obraMO.maoDeObraId
    );
    setQuantidadeMO(obraMO.quantidade.toString());
    setValorUnitarioMO(
      obraMO.valorUnitario 
        ? obraMO.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''
    );
    setShowAddMO(true);
  };

  const handleDeleteMO = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta mão de obra?')) return;
    try {
      await MaoDeObraService.removeObraMaoDeObra(id);
      loadObraMaoDeObra();
    } catch (error) {
      console.error('Erro ao remover mão de obra:', error);
      alert('Erro ao remover mão de obra.');
    }
  };

  const resetFormMO = () => {
    setSelectedMO('');
    setSelectedMOName('');
    setQuantidadeMO('');
    setValorUnitarioMO('');
    setEditingIdMO(null);
    setSearchTermMO('');
  };

  // ===== Status Change handlers =====
  const loadMateriaisRetirados = useCallback(async () => {
    if (!obra?.id || retLoadedRef.current) return;
    retLoadedRef.current = true;
    try {
      const data = await ObraMaterialRetiradoService.getByObra(obra.id);
      setMateriaisRetirados(data);
      setRetLoaded(true);
    } catch (e: unknown) {
      const err = e as Record<string, string>;
      console.error('Erro ao carregar materiais retirados:', err?.message || err?.code || e);
      retLoadedRef.current = false;
    }
  }, [obra?.id]);

  useEffect(() => {
    if (obra?.id && isOpen && activeTab === 'material-retirado') {
      loadMateriaisRetirados();
    }
  }, [obra?.id, isOpen, activeTab, loadMateriaisRetirados]);

  const handleAddRetirado = async () => {
    if (!obra?.id) return;
    if (!retQtd || parseFloat(retQtd) <= 0) { alert('Informe a quantidade.'); return; }
    if (!retMatId && !retDescricao) { alert('Selecione ou descreva o material.'); return; }
    setRetSaving(true);
    try {
      const novo = await ObraMaterialRetiradoService.create({
        obraId: obra.id,
        materialId: retMatId || undefined,
        descricaoMaterial: retMatId ? retMatNome : retDescricao,
        numeroMaterial: retMatId ? undefined : retNumero,
        unidadeMedida: retUnidade,
        quantidade: parseFloat(retQtd),
        destino: retDestino,
        observacoes: retObs || undefined,
      });
      setMateriaisRetirados(prev => [novo, ...prev]);
      setRetMatId(''); setRetMatNome(''); setRetDescricao(''); setRetNumero('');
      setRetUnidade('UN'); setRetQtd(''); setRetObs(''); setRetSearchCatalogo('');
    } catch (e) {
      alert('Erro ao registrar material retirado.');
      console.error(e);
    } finally { setRetSaving(false); }
  };

  const handleDeleteRetirado = async (id: string) => {
    if (!confirm('Remover este registro?')) return;
    await ObraMaterialRetiradoService.delete(id);
    setMateriaisRetirados(prev => prev.filter(r => r.id !== id));
  };

  const handleChangeStatus = async (newStatus: StatusObra) => {
    if (!obra?.id || newStatus === currentStatus) return;
    setChangingStatus(true);
    try {
      await ObrasManutencaoService.update({ id: obra.id, status: newStatus });
      setCurrentStatus(newStatus);
      onStatusChange?.(obra.id, newStatus);
      // Log com usuário — o trigger do banco também registra, mas sem usuario_id
      ObraHistoricoService.addLog({
        obraId: obra.id,
        tipo: 'status',
        descricao: `Status alterado de ${STATUS_LABELS[currentStatus]} para ${STATUS_LABELS[newStatus]}`,
        statusAnterior: currentStatus,
        statusNovo: newStatus,
        usuarioId: user?.id ?? null,
        usuarioNome: user?.nome ?? null,
      }).catch(() => {});
    } catch (error) {
      console.error('Erro ao mudar status:', error);
      alert('Erro ao mudar status da obra.');
    } finally {
      setChangingStatus(false);
    }
  };

  // ===== Filtered lists =====
  const filteredMateriais = materiais.filter(m => 
    m.descricaoMaterial.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.numeroMaterial.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, MAX_SELECT_ITEMS);

  const filteredMO = maoDeObraList.filter(m =>
    m.descricao.toLowerCase().includes(searchTermMO.toLowerCase()) ||
    m.codigoNovo.toLowerCase().includes(searchTermMO.toLowerCase()) ||
    m.up.toLowerCase().includes(searchTermMO.toLowerCase()) ||
    m.descricaoUp.toLowerCase().includes(searchTermMO.toLowerCase())
  ).slice(0, MAX_SELECT_ITEMS);

  const valorTotalMateriais = obraMateriais.reduce((acc, om) => acc + (om.valorTotal || 0), 0);
  const valorTotalMO = obraMaoDeObra.reduce((acc, om) => acc + (om.valorTotal || 0), 0);
  const valorTotalViabMat = viabMateriais.reduce((acc, v) => acc + (v.valorTotal || 0), 0);
  const valorTotalViabMO = viabMO.reduce((acc, v) => acc + (v.valorTotal || 0), 0);

  // Listas mescladas: todos os originais + viabilizados que não existem no original
  const mergedMat = (() => {
    const viabMap = new Map(viabMateriais.map(v => [v.materialId, v]));
    const items: Array<{ materialId: string; material?: Material; qtdOriginal?: number; qtdViab?: number; valorUnitViab?: number; valorTotalViab?: number; viabId?: string }> = [];
    for (const om of obraMateriais) {
      const v = viabMap.get(om.materialId);
      items.push({ materialId: om.materialId, material: om.material, qtdOriginal: om.quantidade, qtdViab: v?.quantidade, valorUnitViab: v?.valorUnitario, valorTotalViab: v?.valorTotal, viabId: v?.id });
      viabMap.delete(om.materialId);
    }
    for (const [, v] of viabMap) {
      items.push({ materialId: v.materialId, material: v.material as Material | undefined, qtdViab: v.quantidade, valorUnitViab: v.valorUnitario, valorTotalViab: v.valorTotal, viabId: v.id });
    }
    return items;
  })();

  const mergedMO = (() => {
    const viabMap = new Map(viabMO.map(v => [v.maoDeObraId, v]));
    const items: Array<{ maoDeObraId: string; maoDeObra?: MaoDeObra; qtdOriginal?: number; qtdViab?: number; valorUnitViab?: number; valorTotalViab?: number; viabId?: string }> = [];
    for (const om of obraMaoDeObra) {
      const v = viabMap.get(om.maoDeObraId);
      items.push({ maoDeObraId: om.maoDeObraId, maoDeObra: om.maoDeObra, qtdOriginal: om.quantidade, qtdViab: v?.quantidade, valorUnitViab: v?.valorUnitario, valorTotalViab: v?.valorTotal, viabId: v?.id });
      viabMap.delete(om.maoDeObraId);
    }
    for (const [, v] of viabMap) {
      items.push({ maoDeObraId: v.maoDeObraId, maoDeObra: v.maoDeObra as MaoDeObra | undefined, qtdViab: v.quantidade, valorUnitViab: v.valorUnitario, valorTotalViab: v.valorTotal, viabId: v.id });
    }
    return items;
  })();

  const isViabilidade = currentStatus === StatusObra.VIABILIDADE;
  const isProgramacao = statusIdx(currentStatus) >= statusIdx(StatusObra.PROGRAMACAO);
  const showViabChecklistTab = statusIdx(currentStatus) >= statusIdx(StatusObra.VIABILIDADE);
  const tabCount = isProgramacao
    ? (isViabilidade ? 6 : 4)
    : isViabilidade ? 6 : 4;

  if (!obra) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Building2 className="h-6 w-6 text-blue-600" />
                {obra.numeroProjeto}
              </DialogTitle>
              <DialogDescription>
                Detalhes, materiais e mão de obra da obra
              </DialogDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Badge de status bem visível */}
              <Badge className={`text-sm px-3 py-1 font-semibold ${STATUS_COLORS[currentStatus]}`}>
                {STATUS_LABELS[currentStatus]}
              </Badge>
              {/* Select estilizado */}
              <div className="relative">
                {changingStatus && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600 z-10" />
                )}
                <select
                  value={currentStatus}
                  onChange={e => handleChangeStatus(e.target.value as StatusObra)}
                  disabled={changingStatus}
                  className="appearance-none text-xs font-medium border border-gray-300 rounded-lg px-3 py-1.5 pr-7 bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {STATUS_ORDER.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                  <option value={StatusObra.CANCELADA}>{STATUS_LABELS[StatusObra.CANCELADA]}</option>
                  <option value={StatusObra.PAUSADA}>{STATUS_LABELS[StatusObra.PAUSADA]}</option>
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className={`grid w-full grid-cols-${tabCount}`}>
            <TabsTrigger value="detalhes" className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Detalhes
            </TabsTrigger>
            {!isProgramacao && (
              <TabsTrigger value="materiais" className="flex items-center gap-1.5 text-xs">
                <Package className="h-3.5 w-3.5" />
                {isViabilidade ? 'Material Viabilizado' : 'Materiais'} ({obraMateriais.length})
              </TabsTrigger>
            )}
            {!isProgramacao && (
              <TabsTrigger value="mao-de-obra" className="flex items-center gap-1.5 text-xs">
                <HardHat className="h-3.5 w-3.5" />
                {isViabilidade ? 'MO Viabilizada' : 'Mão de Obra'} ({obraMaoDeObra.length})
              </TabsTrigger>
            )}
            {isViabilidade && (
              <TabsTrigger value="material-retirado" className="flex items-center gap-1.5 text-xs">
                <Trash2 className="h-3.5 w-3.5" />
                Mat. Retirado ({materiaisRetirados.length})
              </TabsTrigger>
            )}
            {(isViabilidade || isProgramacao) && (
              <TabsTrigger value="comparativo" className="flex items-center gap-1.5 text-xs">
                <GitCompareArrows className="h-3.5 w-3.5" />
                Comparativo
              </TabsTrigger>
            )}
            {isProgramacao && (
              <TabsTrigger value="programacao" className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                Programação
              </TabsTrigger>
            )}
            {showViabChecklistTab && (
              <TabsTrigger value="viabilidade-checklist" className="flex items-center gap-1.5 text-xs">
                <Eye className="h-3.5 w-3.5" />
                Viabilidade
              </TabsTrigger>
            )}
            <TabsTrigger value="historico" className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB DETALHES ===== */}
          <TabsContent value="detalhes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Gerais</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Setor</Label>
                  <p className="font-medium">{obra.setor}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Base</Label>
                  <p className="font-medium">{basesMap?.get(obra.base) || obra.base}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Valor Projetado</Label>
                  <p className="font-medium text-green-700">
                    R$ {obra.valorProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Período</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="font-medium">
                      {new Date(obra.dataInicio).toLocaleDateString('pt-BR')} - {new Date(obra.dataFim).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Localização</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium">{obra.enderecoObra}</p>
                    {obra.bairro && <p className="text-sm text-gray-600">{obra.bairro}</p>}
                    {obra.municipio && <p className="text-sm text-gray-600">{obra.municipio}</p>}
                  </div>
                </div>
                {(obra.latitude && obra.longitude) && (
                  <div className="text-sm text-gray-500">
                    Coordenadas: {obra.latitude}, {obra.longitude}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quantitativos</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Postes</Label>
                  <p className="font-medium text-lg">{obra.quantidadePoste}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Metros de Condutor</Label>
                  <p className="font-medium text-lg">{obra.metrosCondutor}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Transformadores</Label>
                  <p className="font-medium text-lg">{obra.quantidadeTrafo}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Classificação</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Badge variant={obra.regulatorio ? "default" : "secondary"}>
                  {obra.regulatorio ? '✓' : '✗'} Regulatório
                </Badge>
                <Badge variant={obra.projetoRevisado ? "default" : "secondary"}>
                  {obra.projetoRevisado ? '✓' : '✗'} Projeto Revisado
                </Badge>
              </CardContent>
            </Card>

            {obra.observacoes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Observações</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">{obra.observacoes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== TAB MATERIAIS ===== */}
          <TabsContent value="materiais" className="space-y-4 mt-4">

            {/* Modal adicionar material */}
            <Dialog open={showAddMaterial} onOpenChange={open => { setShowAddMaterial(open); if (!open) resetForm(); }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Editar Material' : 'Adicionar Material'}</DialogTitle>
                  <DialogDescription>Busque pelo catálogo e informe quantidade e valor.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Material *</Label>
                    {selectedMaterial ? (
                      <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-md">
                        <span className="text-sm font-medium">{selectedMaterialName}</span>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedMaterial(''); setSelectedMaterialName(''); }}>Trocar</Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                          <Input placeholder="Buscar por código ou descrição..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
                        </div>
                        {searchTerm.length > 0 && (
                          <div className="border rounded-md max-h-48 overflow-y-auto bg-white shadow-sm">
                            {filteredMateriais.length === 0 ? (
                              <p className="text-sm text-gray-400 p-3 text-center">Nenhum material encontrado</p>
                            ) : filteredMateriais.map(mat => (
                              <button key={mat.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0" onClick={() => handleSelectMaterial(mat)}>
                                <span className="font-medium">{mat.numeroMaterial}</span> — {mat.descricaoMaterial}
                              </button>
                            ))}
                            {filteredMateriais.length >= MAX_SELECT_ITEMS && <p className="text-xs text-gray-400 p-2 text-center border-t">Refine a busca para ver mais...</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Quantidade *</Label>
                      <Input type="number" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label>Valor Unitário (R$)</Label>
                      <Input type="text" value={valorUnitario} onChange={e => { const v = e.target.value.replace(/\D/g,''); if (!v) { setValorUnitario(''); return; } setValorUnitario((parseFloat(v)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})); }} placeholder="0,00" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => { setShowAddMaterial(false); resetForm(); }}>Cancelar</Button>
                    <Button onClick={async () => { await handleAddMaterial(); setShowAddMaterial(false); }} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-1" />{editingId ? 'Atualizar' : 'Adicionar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">{isViabilidade ? 'Material Viabilizado' : 'Materiais da Obra'}</CardTitle>
                    <CardDescription>
                      {isViabilidade
                        ? `${mergedMat.length} material(is) — ${viabMateriais.length} viabilizado(s)`
                        : `${obraMateriais.length} material(is) cadastrado(s)`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Valor Total</p>
                      <p className="text-lg font-bold text-green-700">R$ {(isViabilidade ? valorTotalViabMat : valorTotalMateriais).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <Button size="sm" onClick={() => { setShowAddMaterial(true); loadMateriais(); }} className="bg-blue-600 hover:bg-blue-700 gap-1">
                      <Plus className="h-4 w-4" /> Adicionar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : (isViabilidade ? mergedMat.length === 0 : obraMateriais.length === 0) ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">{isViabilidade ? 'Nenhum material original ou viabilizado' : 'Nenhum material adicionado'}</p>
                  </div>
                ) : isViabilidade ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead className="text-right bg-blue-50 text-blue-700 font-bold">Qtd Original</TableHead>
                          <TableHead className="text-right bg-amber-50 text-amber-700 font-bold">Qtd Viabilizada</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mergedMat.map((item, idx) => (
                          <TableRow key={item.materialId + idx} className={!item.qtdViab && item.qtdOriginal != null ? 'bg-blue-50/40 border-l-2 border-l-blue-400' : item.qtdOriginal == null ? 'bg-green-50/30 border-l-2 border-l-green-400' : ''}>
                            <TableCell className="font-medium">{item.material?.numeroMaterial || '-'}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {item.material?.descricaoMaterial || '-'}
                              {item.qtdOriginal == null && <span className="ml-1 text-[9px] bg-green-100 text-green-600 rounded px-1">novo</span>}
                              {item.qtdViab == null && <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 rounded px-1">só original</span>}
                            </TableCell>
                            <TableCell>{item.material?.unidadeMedida || '-'}</TableCell>
                            <TableCell className="text-right bg-blue-50/60 font-semibold text-blue-800">
                              {item.qtdOriginal != null ? item.qtdOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                            </TableCell>
                            <TableCell className="text-right bg-amber-50/60 font-semibold text-amber-800">
                              {item.qtdViab != null ? item.qtdViab.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.valorUnitViab ? `R$ ${item.valorUnitViab.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-700">
                              {item.valorTotalViab ? `R$ ${item.valorTotalViab.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.viabId && (
                                <Button variant="outline" size="sm" onClick={() => ViabilidadeRecursosService.deleteMaterial(item.viabId!).then(loadViabilidade)} className="text-red-600 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {obraMateriais.map((om) => (
                          <TableRow key={om.id}>
                            <TableCell className="font-medium">
                              {om.material?.numeroMaterial || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {om.material?.descricaoMaterial || '-'}
                            </TableCell>
                            <TableCell>
                              {om.material?.unidadeMedida || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {om.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {om.valorUnitario 
                                ? `R$ ${om.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-700">
                              {om.valorTotal 
                                ? `R$ ${om.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditMaterial(om)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteMaterial(om.id!)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB MÃO DE OBRA ===== */}
          <TabsContent value="mao-de-obra" className="space-y-4 mt-4">

            {/* Modal adicionar MO */}
            <Dialog open={showAddMO} onOpenChange={open => { setShowAddMO(open); if (!open) resetFormMO(); }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingIdMO ? 'Editar Mão de Obra' : 'Adicionar Mão de Obra'}</DialogTitle>
                  <DialogDescription>Busque pelo catálogo e informe quantidade e valor.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Serviço *</Label>
                    {selectedMO ? (
                      <div className="flex items-center justify-between p-2 bg-orange-50 border border-orange-200 rounded-md">
                        <span className="text-sm font-medium">{selectedMOName}</span>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedMO(''); setSelectedMOName(''); setValorUnitarioMO(''); }}>Trocar</Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                          <Input placeholder="Buscar por código, descrição ou UP..." value={searchTermMO} onChange={e => setSearchTermMO(e.target.value)} className="pl-8" />
                        </div>
                        {searchTermMO.length > 0 && (
                          <div className="border rounded-md max-h-48 overflow-y-auto bg-white shadow-sm">
                            {filteredMO.length === 0 ? (
                              <p className="text-sm text-gray-400 p-3 text-center">Nenhum serviço encontrado</p>
                            ) : filteredMO.map(mo => (
                              <button key={mo.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b last:border-b-0" onClick={() => handleSelectMO(mo)}>
                                <span className="font-medium">{mo.codigoNovo}</span> — {mo.descricao}
                                {mo.valorUnitario ? <span className="text-gray-400 ml-2">(R$ {mo.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span> : ''}
                              </button>
                            ))}
                            {filteredMO.length >= MAX_SELECT_ITEMS && <p className="text-xs text-gray-400 p-2 text-center border-t">Refine a busca para ver mais...</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Quantidade *</Label>
                      <Input type="number" step="0.01" value={quantidadeMO} onChange={e => setQuantidadeMO(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label>Valor Unitário (R$)</Label>
                      <Input type="text" value={valorUnitarioMO} onChange={e => { const v = e.target.value.replace(/\D/g,''); if (!v) { setValorUnitarioMO(''); return; } setValorUnitarioMO((parseFloat(v)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})); }} placeholder="0,00" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => { setShowAddMO(false); resetFormMO(); }}>Cancelar</Button>
                    <Button onClick={async () => { await handleAddMO(); setShowAddMO(false); }} className="bg-orange-600 hover:bg-orange-700">
                      <Plus className="h-4 w-4 mr-1" />{editingIdMO ? 'Atualizar' : 'Adicionar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">{isViabilidade ? 'MO Viabilizada' : 'Mão de Obra da Obra'}</CardTitle>
                    <CardDescription>
                      {isViabilidade
                        ? `${mergedMO.length} serviço(s) — ${viabMO.length} viabilizado(s)`
                        : `${obraMaoDeObra.length} serviço(s) cadastrado(s)`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Valor Total</p>
                      <p className="text-lg font-bold text-orange-700">R$ {(isViabilidade ? valorTotalViabMO : valorTotalMO).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <Button size="sm" onClick={() => { setShowAddMO(true); loadMaoDeObra(); }} className="bg-orange-600 hover:bg-orange-700 gap-1">
                      <Plus className="h-4 w-4" /> Adicionar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingMO ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                  </div>
                ) : (isViabilidade ? mergedMO.length === 0 : obraMaoDeObra.length === 0) ? (
                  <div className="text-center py-8">
                    <HardHat className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">{isViabilidade ? 'Nenhuma MO original ou viabilizada' : 'Nenhuma mão de obra adicionada'}</p>
                  </div>
                ) : isViabilidade ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>UP</TableHead>
                          <TableHead className="text-right bg-blue-50 text-blue-700 font-bold">Qtd Original</TableHead>
                          <TableHead className="text-right bg-amber-50 text-amber-700 font-bold">Qtd Viabilizada</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mergedMO.map((item, idx) => (
                          <TableRow key={item.maoDeObraId + idx} className={!item.qtdViab && item.qtdOriginal != null ? 'bg-blue-50/40 border-l-2 border-l-blue-400' : item.qtdOriginal == null ? 'bg-green-50/30 border-l-2 border-l-green-400' : ''}>
                            <TableCell className="font-medium">{item.maoDeObra?.codigoNovo || '-'}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {item.maoDeObra?.descricao || '-'}
                              {item.qtdOriginal == null && <span className="ml-1 text-[9px] bg-green-100 text-green-600 rounded px-1">novo</span>}
                              {item.qtdViab == null && <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 rounded px-1">só original</span>}
                            </TableCell>
                            <TableCell>{item.maoDeObra?.up || '-'}</TableCell>
                            <TableCell className="text-right bg-blue-50/60 font-semibold text-blue-800">
                              {item.qtdOriginal != null ? item.qtdOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                            </TableCell>
                            <TableCell className="text-right bg-amber-50/60 font-semibold text-amber-800">
                              {item.qtdViab != null ? item.qtdViab.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.valorUnitViab ? `R$ ${item.valorUnitViab.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-orange-700">
                              {item.valorTotalViab ? `R$ ${item.valorTotalViab.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.viabId && (
                                <Button variant="outline" size="sm" onClick={() => ViabilidadeRecursosService.deleteMaoDeObra(item.viabId!).then(loadViabilidade)} className="text-red-600 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>UP</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {obraMaoDeObra.map((om) => (
                          <TableRow key={om.id}>
                            <TableCell className="font-medium">
                              {om.maoDeObra?.codigoNovo || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {om.maoDeObra?.descricao || '-'}
                            </TableCell>
                            <TableCell>
                              {om.maoDeObra?.up || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {om.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {om.valorUnitario 
                                ? `R$ ${om.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-right font-medium text-orange-700">
                              {om.valorTotal 
                                ? `R$ ${om.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditMO(om)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteMO(om.id!)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* ===== TAB MATERIAL RETIRADO ===== */}
          <TabsContent value="material-retirado" className="space-y-4 mt-4">

            {/* Modal registrar material retirado */}
            <Dialog open={showAddRetirado} onOpenChange={open => {
              setShowAddRetirado(open);
              if (!open) { setRetMatId(''); setRetMatNome(''); setRetDescricao(''); setRetNumero(''); setRetUnidade('UN'); setRetQtd(''); setRetObs(''); setRetSearchCatalogo(''); }
            }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Registrar Material Retirado</DialogTitle>
                  <DialogDescription>Informe o material retirado em campo (sucata, reaproveitável ou descarte)</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Material (catálogo)</Label>
                    {retMatId ? (
                      <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <span className="font-medium">{retMatNome}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setRetMatId(''); setRetMatNome(''); }}>Trocar</Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
                          <Input placeholder="Buscar no catálogo..." value={retSearchCatalogo} onChange={e => setRetSearchCatalogo(e.target.value)} className="pl-7 h-8 text-sm" />
                        </div>
                        {retSearchCatalogo.length > 1 && (
                          <div className="border rounded max-h-36 overflow-y-auto bg-white shadow-sm">
                            {materiais.filter(m =>
                              m.descricaoMaterial.toLowerCase().includes(retSearchCatalogo.toLowerCase()) ||
                              m.numeroMaterial.toLowerCase().includes(retSearchCatalogo.toLowerCase())
                            ).slice(0, 50).map(m => (
                              <button key={m.id} type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b last:border-b-0"
                                onClick={() => { setRetMatId(m.id!); setRetMatNome(`${m.numeroMaterial} - ${m.descricaoMaterial}`); setRetUnidade(m.unidadeMedida); setRetSearchCatalogo(''); }}>
                                <span className="font-medium">{m.numeroMaterial}</span> — {m.descricaoMaterial}
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400">Ou descreva manualmente abaixo se não estiver no catálogo</p>
                      </div>
                    )}
                  </div>
                  {!retMatId && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label className="text-xs">Descrição manual</Label><Input value={retDescricao} onChange={e => setRetDescricao(e.target.value)} placeholder="Ex: Cabo 16mm²" className="h-8 text-sm" /></div>
                      <div className="space-y-1"><Label className="text-xs">Número / Código</Label><Input value={retNumero} onChange={e => setRetNumero(e.target.value)} placeholder="Opcional" className="h-8 text-sm" /></div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1"><Label className="text-xs">Unidade</Label><Input value={retUnidade} onChange={e => setRetUnidade(e.target.value)} placeholder="UN" className="h-8 text-sm" /></div>
                    <div className="space-y-1"><Label className="text-xs">Quantidade *</Label><Input type="number" step="0.01" value={retQtd} onChange={e => setRetQtd(e.target.value)} placeholder="0" className="h-8 text-sm" /></div>
                    <div className="space-y-1">
                      <Label className="text-xs">Destino *</Label>
                      <select value={retDestino} onChange={e => setRetDestino(e.target.value as DestinoMaterialRetirado)} className="w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white">
                        <option value="sucata">Sucata</option>
                        <option value="reaproveitavel">Reaproveitável</option>
                        <option value="descarte">Descarte</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Observações</Label><Input value={retObs} onChange={e => setRetObs(e.target.value)} placeholder="Opcional" className="h-8 text-sm" /></div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setShowAddRetirado(false)}>Cancelar</Button>
                    <Button size="sm" onClick={async () => { await handleAddRetirado(); setShowAddRetirado(false); }} disabled={retSaving} className="bg-red-600 hover:bg-red-700">
                      <Plus className="h-4 w-4 mr-1" /> Registrar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Lista */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">Materiais Retirados ({materiaisRetirados.length})</CardTitle>
                  <Button size="sm" onClick={() => { setShowAddRetirado(true); loadMateriais(); }} className="bg-red-600 hover:bg-red-700 gap-1">
                    <Plus className="h-4 w-4" /> Registrar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {materiaisRetirados.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhum material retirado registrado</p>
                ) : (
                  <div className="divide-y">
                    {materiaisRetirados.map(r => (
                      <div key={r.id} className="flex items-center gap-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {r.material?.numeroMaterial ? `${r.material.numeroMaterial} — ` : r.numeroMaterial ? `${r.numeroMaterial} — ` : ''}
                            {r.material?.descricaoMaterial || r.descricaoMaterial || '-'}
                          </p>
                          {r.observacoes && <p className="text-xs text-gray-400 truncate">{r.observacoes}</p>}
                        </div>
                        <span className="text-sm font-medium shrink-0">{r.quantidade} {r.unidadeMedida}</span>
                        <Badge className={`text-xs shrink-0 ${DESTINO_COLORS[r.destino]}`}>
                          {DESTINO_LABELS[r.destino]}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRetirado(r.id!)} className="text-red-500 hover:text-red-700 h-7 w-7 p-0 shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB COMPARATIVO ===== */}
          <TabsContent value="comparativo" className="mt-4">
            <ComparativoViabilidade obra={obra} basesMap={basesMap} />
          </TabsContent>

          {/* ===== TAB PROGRAMAÇÃO ===== */}
          {isProgramacao && (
            <TabsContent value="programacao" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        Programações e Fluxo
                      </CardTitle>
                      <CardDescription>Etapas programadas, fluxo de material e saldo por entrega do almoxarifado</CardDescription>
                    </div>
                    {(currentStatus === StatusObra.APROVACAO_MEDICAO || currentStatus === StatusObra.MEDICAO) && (
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => setAprovacaoMedicaoAberta(true)}
                      >
                        <CheckCheck className="h-3.5 w-3.5 mr-1" />
                        Aprovação de Medição
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProg ? (
                    <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2" />
                      Carregando...
                    </div>
                  ) : programacoes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                      <Calendar className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma programação encontrada para esta obra.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {programacoes
                        .sort((a, b) => a.data.localeCompare(b.data))
                        .map(prog => (
                          <div key={prog.id} className={`border rounded-lg p-3 ${
                            prog.fluxoDefinido ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                          }`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-gray-800">
                                  {prog.data} — Etapa {prog.etapa}
                                </span>
                                <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0">
                                  {prog.equipe?.nome || prog.equipeId}
                                </span>
                                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0" title={prog.id}>
                                  {prog.data.slice(5).replace('-', '/')} · {prog.etapa} · {(prog.equipe?.nome ?? prog.equipeId).split(' ').slice(0, 2).join(' ')}
                                </span>
                                {prog.fluxoDefinido ? (
                                  <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">
                                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Fluxo OK
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> SF
                                  </Badge>
                                )}
                                <Badge className={`${STATUS_EXECUCAO_COLORS[(prog.statusExecucao ?? 'PROG') as StatusExecucao]} text-[10px] px-1.5 py-0 border-0`}>
                                  {STATUS_EXECUCAO_LABELS[(prog.statusExecucao ?? 'PROG') as StatusExecucao]}
                                </Badge>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant={prog.fluxoDefinido ? 'outline' : 'default'}
                                  className={prog.fluxoDefinido ? 'h-7 text-xs' : 'h-7 text-xs bg-red-600 hover:bg-red-700 text-white'}
                                  onClick={() => setFluxoAberto(prog)}
                                >
                                  <Workflow className="h-3 w-3 mr-1" />
                                  {prog.fluxoDefinido ? 'Ver/Editar Fluxo' : 'Definir Fluxo'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                  onClick={() => setApontamentoAberto(prog)}
                                >
                                  Retorno Exec.
                                </Button>
                              </div>
                            </div>
                            {prog.observacoes && (
                              <p className="text-xs text-gray-500 mt-1">{prog.observacoes}</p>
                            )}
                            {/* Resumo de entregas desta programação */}
                            {(() => {
                              const entDesta = entregasObra.filter(e => e.programacaoId === prog.id);
                              if (!entDesta.length) return null;
                              return (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <p className="text-xs font-medium text-gray-600 mb-1">Entregas do almoxarifado:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {entDesta.map(e => (
                                      <Badge key={e.id} variant="outline" className="text-[10px]">
                                        {e.descricao} — {e.quantidade} {e.unidade}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Modal de Fluxo inline */}
              {fluxoAberto && (
                <FluxoEtapaModal
                  programacao={fluxoAberto}
                  isOpen={!!fluxoAberto}
                  onClose={() => setFluxoAberto(null)}
                  onSaved={() => { setFluxoAberto(null); progLoadedRef.current = false; loadProgramacoes(); }}
                />
              )}
            </TabsContent>
          )}

          {/* ===== TAB VIABILIDADE CHECKLIST ===== */}
          {showViabChecklistTab && (
            <TabsContent value="viabilidade-checklist" className="mt-4">
              {!viabChecklist ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Eye className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum checklist de viabilidade registrado.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Resultado da Viabilidade */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Resultado da Viabilidade</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">Tensão da Rede</Label>
                        <p className="font-semibold">{viabChecklist.tensao_rede} kV</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Viabilidade</Label>
                        <Badge className={viabChecklist.viabilidade === 'APTO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {viabChecklist.viabilidade === 'APTO' ? '✓ Apto' : '✗ Não Apto'}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Condição do Traçado</Label>
                        <p className="font-medium text-sm">{viabChecklist.condicao_tracado === 'CONFORME' ? 'Conforme' : 'Alteração necessária'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Autorização de Passagem</Label>
                        <Badge variant="outline" className="text-xs">
                          {viabChecklist.autorizacao_passagem === 'SIM' ? 'Sim' : viabChecklist.autorizacao_passagem === 'NAO' ? 'Não' : 'Em andamento'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contato */}
                  {(viabChecklist.nome_contato || viabChecklist.telefone_contato) && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Contato no Local</CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center gap-4">
                        {viabChecklist.nome_contato && (
                          <div>
                            <Label className="text-xs text-gray-500">Nome</Label>
                            <p className="font-medium text-sm">{viabChecklist.nome_contato}</p>
                          </div>
                        )}
                        {viabChecklist.telefone_contato && (
                          <div className="flex items-center gap-2">
                            <div>
                              <Label className="text-xs text-gray-500">Telefone</Label>
                              <p className="font-medium text-sm">{viabChecklist.telefone_contato}</p>
                            </div>
                            {viabChecklist.contato_whatsapp && (
                              <Badge className="bg-green-100 text-green-700 text-[10px]">WhatsApp</Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Condições booleanas */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Condições do Local</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { label: 'Necessário LV', value: viabChecklist.necessario_lv },
                          { label: 'Sinal de telefone', value: viabChecklist.sinal_telefone },
                          { label: 'Desligamento necessário', value: viabChecklist.desligamento_necessario },
                          { label: 'Poda de árvores', value: viabChecklist.poda_arvores },
                          { label: 'Interferências', value: viabChecklist.interferencias_identificadas },
                        ].map(item => (
                          <div key={item.label} className="flex items-center gap-2">
                            {item.value ? (
                              <CheckCircle2 className="h-4 w-4 text-amber-500" />
                            ) : (
                              <span className="h-4 w-4 rounded-full border-2 border-gray-300 inline-block" />
                            )}
                            <span className={`text-sm ${item.value ? 'font-medium text-gray-800' : 'text-gray-400'}`}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                      {viabChecklist.desligamento_necessario && viabChecklist.numero_chave_equipamento && (
                        <p className="text-xs text-gray-500 mt-2">Nº chave/equipamento: <span className="font-medium">{viabChecklist.numero_chave_equipamento}</span></p>
                      )}
                      {viabChecklist.interferencias_identificadas && viabChecklist.interferencias_descricao && (
                        <p className="text-xs text-gray-500 mt-1">Interferências: <span className="font-medium">{viabChecklist.interferencias_descricao}</span></p>
                      )}
                    </CardContent>
                  </Card>

                  {/* NAO_APTO info */}
                  {viabChecklist.viabilidade === 'NAO_APTO' && (viabChecklist.obs_nao_apto || viabChecklist.data_revisao) && (
                    <Card className="border-red-200 bg-red-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Não Apto — Observações
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {viabChecklist.obs_nao_apto && (
                          <p className="text-sm text-gray-700">{viabChecklist.obs_nao_apto}</p>
                        )}
                        {viabChecklist.data_revisao && (
                          <p className="text-xs text-gray-500">Data para revisão: <span className="font-medium">{viabChecklist.data_revisao}</span></p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Alerta de segurança */}
                  {viabChecklist.alerta_seguranca && (
                    <Card className="border-amber-200 bg-amber-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Alerta de Segurança
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {viabChecklist.alerta_seguranca_obs && (
                          <p className="text-sm text-gray-700">{viabChecklist.alerta_seguranca_obs}</p>
                        )}
                        {viabChecklist.fotos_alerta_seguranca && viabChecklist.fotos_alerta_seguranca.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {viabChecklist.fotos_alerta_seguranca.map((url: string, i: number) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt={`Alerta ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-amber-200 hover:opacity-80 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Resumo técnico */}
                  {viabChecklist.resumo_tecnico && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Resumo Técnico</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{viabChecklist.resumo_tecnico}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Fotos dos postes */}
                  {viabChecklist.fotos_postes && viabChecklist.fotos_postes.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Fotos dos Postes ({viabChecklist.fotos_postes.length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                          {viabChecklist.fotos_postes.map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative">
                              <img src={url} alt={`Poste ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border border-gray-200 group-hover:opacity-80 transition-opacity" />
                              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{i + 1}</span>
                            </a>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
          )}

          {/* ===== TAB HISTÓRICO ===== */}
          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-500" />
                  Histórico da Obra
                </CardTitle>
                <CardDescription>Registro de todas as alterações, programações e apontamentos.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistorico ? (
                  <div className="flex items-center justify-center py-10 text-gray-400 text-sm">Carregando histórico...</div>
                ) : historico.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Clock className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum evento registrado ainda.</p>
                    <p className="text-xs mt-1 text-gray-300">Execute a migration create_obra_historico.sql para ativar o histórico.</p>
                  </div>
                ) : (
                  <ol className="relative border-l border-gray-200 space-y-6 pl-6">
                    {historico.map(entry => (
                      <li key={entry.id} className="relative">
                        {/* Dot */}
                        <span className={`absolute -left-[1.6rem] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white ${
                          entry.tipo === 'criacao' ? 'bg-blue-500' :
                          entry.tipo === 'status' ? 'bg-purple-500' :
                          entry.tipo === 'programacao' ? 'bg-emerald-500' :
                          entry.tipo === 'apontamento' ? 'bg-orange-500' :
                          'bg-gray-400'
                        }`}>
                          {entry.tipo === 'criacao' && <Plus className="h-3 w-3 text-white" />}
                          {entry.tipo === 'status' && <span className="text-white text-[8px] font-bold">S</span>}
                          {entry.tipo === 'programacao' && <Calendar className="h-3 w-3 text-white" />}
                          {entry.tipo === 'apontamento' && <HardHat className="h-3 w-3 text-white" />}
                          {(entry.tipo === 'edicao' || entry.tipo === 'observacao') && <FileText className="h-3 w-3 text-white" />}
                        </span>
                        <div className="ml-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-800">{entry.descricao}</p>
                            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                              {new Date(entry.createdAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                            </span>
                          </div>
                          {entry.tipo === 'status' && entry.statusAnterior && entry.statusNovo && (
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`text-xs ${STATUS_COLORS[entry.statusAnterior as StatusObra] ?? 'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABELS[entry.statusAnterior as StatusObra] ?? entry.statusAnterior}
                              </Badge>
                              <span className="text-gray-400 text-xs">→</span>
                              <Badge className={`text-xs ${STATUS_COLORS[entry.statusNovo as StatusObra] ?? 'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABELS[entry.statusNovo as StatusObra] ?? entry.statusNovo}
                              </Badge>
                            </div>
                          )}
                          {entry.usuarioNome && (
                            <p className="text-xs text-gray-400 mt-0.5">por {entry.usuarioNome}</p>
                          )}
                          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(entry.metadata)
                                .filter(([k]) => !k.endsWith('Id') && k !== 'programacaoId' && k !== 'equipeId')
                                .map(([k, v]) => (
                                <span key={k} className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{k}: {String(v)}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </DialogContent>

      <RetornoExecucaoModal
        programacao={apontamentoAberto}
        isOpen={!!apontamentoAberto}
        onClose={() => setApontamentoAberto(null)}
        onSaved={() => { progLoadedRef.current = false; loadProgramacoes(); }}
      />

      {obra?.id && (
        <AprovacaoMedicaoModal
          obraId={obra.id}
          numeroProjeto={obra.numeroProjeto}
          isOpen={aprovacaoMedicaoAberta}
          onClose={() => setAprovacaoMedicaoAberta(false)}
          onAprovado={() => { loadHistorico(); }}
        />
      )}
    </Dialog>
  );
}
