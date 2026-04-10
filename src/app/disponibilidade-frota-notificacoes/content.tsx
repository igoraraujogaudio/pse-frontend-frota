'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  EnvelopeIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions';
import { disponibilidadeFrotaService } from '@/services/disponibilidadeRotaService';

interface Contrato { id: string; nome: string; codigo?: string }

interface GroupedEmail {
  email: string;
  nome: string | null;
  descricao: string | null;
  contratoIds: string[];
}

interface GroupedWhatsapp {
  numero: string;
  nome: string | null;
  descricao: string | null;
  contratoIds: string[];
}

export function NotificacoesContent() {
  const { notify } = useNotification();
  const { user } = useAuth();
  const { hasPermission } = useModularPermissions();
  const canViewAll = hasPermission(PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR_TODOS_CONTRATOS);
  const canManage = hasPermission(PERMISSION_CODES.DISPONIBILIDADE_FROTA.GERENCIAR_NOTIFICACOES);

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);

  // Grouped data
  const [groupedEmails, setGroupedEmails] = useState<GroupedEmail[]>([]);
  const [groupedWhatsapps, setGroupedWhatsapps] = useState<GroupedWhatsapp[]>([]);

  // Add forms
  const [emailForm, setEmailForm] = useState({ email: '', nome: '', descricao: '' });
  const [emailFormContratos, setEmailFormContratos] = useState<string[]>([]);
  const [whatsappForm, setWhatsappForm] = useState({ numero: '', nome: '', descricao: '' });
  const [whatsappFormContratos, setWhatsappFormContratos] = useState<string[]>([]);

  // Editing
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editEmailData, setEditEmailData] = useState({ nome: '', descricao: '' });
  const [editEmailContratos, setEditEmailContratos] = useState<string[]>([]);
  const [editingWhatsapp, setEditingWhatsapp] = useState<string | null>(null);
  const [editWhatsappData, setEditWhatsappData] = useState({ nome: '', descricao: '' });
  const [editWhatsappContratos, setEditWhatsappContratos] = useState<string[]>([]);

  const [tab, setTab] = useState<'email' | 'whatsapp'>('email');

  const loadContratos = useCallback(async () => {
    try {
      const data = await disponibilidadeFrotaService.getContratos();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userContratoIds = (user as any)?.contratoIds || [];
      if (canViewAll) {
        setContratos(data);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setContratos(data.filter(c => userContratoIds.includes(c.id) || (user as any)?.contrato_origem_id === c.id));
      }
    } catch { /* silenciar */ }
  }, [canViewAll, user]);

  const loadNotificacoes = useCallback(async () => {
    if (contratos.length === 0) return;
    setLoading(true);
    try {
      const cIds = contratos.map(c => c.id);
      const [allEmails, allWhatsapps] = await Promise.all([
        disponibilidadeFrotaService.getAllEmails(cIds),
        disponibilidadeFrotaService.getAllWhatsapps(cIds),
      ]);

      // Group emails by address
      const emailMap = new Map<string, GroupedEmail>();
      for (const e of allEmails) {
        const key = e.email.toLowerCase();
        if (!emailMap.has(key)) {
          emailMap.set(key, { email: e.email, nome: e.nome, descricao: e.descricao, contratoIds: [] });
        }
        const g = emailMap.get(key)!;
        if (!g.contratoIds.includes(e.contrato_id)) g.contratoIds.push(e.contrato_id);
        if (e.nome && !g.nome) g.nome = e.nome;
        if (e.descricao && !g.descricao) g.descricao = e.descricao;
      }
      setGroupedEmails(Array.from(emailMap.values()).sort((a, b) => a.email.localeCompare(b.email)));

      // Group whatsapps by number
      const whatsappMap = new Map<string, GroupedWhatsapp>();
      for (const w of allWhatsapps) {
        const key = w.numero;
        if (!whatsappMap.has(key)) {
          whatsappMap.set(key, { numero: w.numero, nome: w.nome, descricao: w.descricao, contratoIds: [] });
        }
        const g = whatsappMap.get(key)!;
        if (!g.contratoIds.includes(w.contrato_id)) g.contratoIds.push(w.contrato_id);
        if (w.nome && !g.nome) g.nome = w.nome;
        if (w.descricao && !g.descricao) g.descricao = w.descricao;
      }
      setGroupedWhatsapps(Array.from(whatsappMap.values()).sort((a, b) => a.numero.localeCompare(b.numero)));
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao carregar', 'error');
    } finally {
      setLoading(false);
    }
  }, [contratos, notify]);

  useEffect(() => { loadContratos(); }, [loadContratos]);
  useEffect(() => { loadNotificacoes(); }, [loadNotificacoes]);

  const contratoNome = (id: string) => {
    const c = contratos.find(c => c.id === id);
    return c ? (c.codigo ? `${c.nome} (${c.codigo})` : c.nome) : id;
  };

  const toggleContratoList = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  // --- Email CRUD ---
  const handleAddEmail = async () => {
    if (!canManage) { notify('Sem permissão para gerenciar notificações', 'error'); return; }
    if (!emailForm.email.trim() || emailFormContratos.length === 0) {
      notify('Preencha o email e selecione pelo menos um contrato', 'warning');
      return;
    }
    try {
      await disponibilidadeFrotaService.syncEmailContratos(
        emailForm.email.trim(),
        emailForm.nome.trim() || null,
        emailForm.descricao.trim() || null,
        emailFormContratos,
        contratos.map(c => c.id),
      );
      setEmailForm({ email: '', nome: '', descricao: '' });
      setEmailFormContratos([]);
      notify('Email adicionado', 'success');
      loadNotificacoes();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao adicionar email', 'error');
    }
  };

  const handleSaveEmail = async (emailAddr: string) => {
    if (!canManage) { notify('Sem permissão para gerenciar notificações', 'error'); return; }
    if (editEmailContratos.length === 0) {
      notify('Selecione pelo menos um contrato', 'warning');
      return;
    }
    try {
      await disponibilidadeFrotaService.syncEmailContratos(
        emailAddr,
        editEmailData.nome.trim() || null,
        editEmailData.descricao.trim() || null,
        editEmailContratos,
        contratos.map(c => c.id),
      );
      setEditingEmail(null);
      notify('Email atualizado', 'success');
      loadNotificacoes();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao atualizar', 'error');
    }
  };

  const handleDeleteEmail = async (emailAddr: string) => {
    if (!canManage) { notify('Sem permissão para gerenciar notificações', 'error'); return; }
    if (!confirm(`Remover ${emailAddr} de todos os contratos?`)) return;
    try {
      await disponibilidadeFrotaService.deleteEmailByAddress(emailAddr, contratos.map(c => c.id));
      notify('Email removido', 'success');
      loadNotificacoes();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao remover', 'error');
    }
  };

  // --- WhatsApp CRUD ---
  const formatPhone = (num: string) => {
    const clean = num.replace(/\D/g, '');
    if (clean.startsWith('55') && clean.length === 13) {
      return `+55 (${clean.substring(2, 4)}) ${clean.substring(4, 9)}-${clean.substring(9)}`;
    }
    return clean;
  };

  const handleAddWhatsapp = async () => {
    if (!canManage) { notify('Sem permissão para gerenciar notificações', 'error'); return; }
    const numero = whatsappForm.numero.replace(/\D/g, '');
    if (!numero || whatsappFormContratos.length === 0) {
      notify('Preencha o número e selecione pelo menos um contrato', 'warning');
      return;
    }
    if (numero.length < 10) { notify('Número inválido', 'warning'); return; }
    try {
      await disponibilidadeFrotaService.syncWhatsappContratos(
        numero,
        whatsappForm.nome.trim() || null,
        whatsappForm.descricao.trim() || null,
        whatsappFormContratos,
        contratos.map(c => c.id),
      );
      setWhatsappForm({ numero: '', nome: '', descricao: '' });
      setWhatsappFormContratos([]);
      notify('Número adicionado', 'success');
      loadNotificacoes();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao adicionar número', 'error');
    }
  };

  const handleSaveWhatsapp = async (numero: string) => {
    if (!canManage) { notify('Sem permissão para gerenciar notificações', 'error'); return; }
    if (editWhatsappContratos.length === 0) {
      notify('Selecione pelo menos um contrato', 'warning');
      return;
    }
    try {
      await disponibilidadeFrotaService.syncWhatsappContratos(
        numero,
        editWhatsappData.nome.trim() || null,
        editWhatsappData.descricao.trim() || null,
        editWhatsappContratos,
        contratos.map(c => c.id),
      );
      setEditingWhatsapp(null);
      notify('Número atualizado', 'success');
      loadNotificacoes();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao atualizar', 'error');
    }
  };

  const handleDeleteWhatsapp = async (numero: string) => {
    if (!canManage) { notify('Sem permissão para gerenciar notificações', 'error'); return; }
    if (!confirm(`Remover ${formatPhone(numero)} de todos os contratos?`)) return;
    try {
      await disponibilidadeFrotaService.deleteWhatsappByNumero(numero, contratos.map(c => c.id));
      notify('Número removido', 'success');
      loadNotificacoes();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao remover', 'error');
    }
  };

  // Contrato checkbox component
  const ContratoCheckboxes = ({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {contratos.map(c => (
        <label key={c.id} className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer select-none transition-colors',
          selected.includes(c.id) ? 'bg-cyan-50 border-cyan-300 text-cyan-800' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
        )}>
          <input
            type="checkbox"
            checked={selected.includes(c.id)}
            onChange={() => onChange(toggleContratoList(selected, c.id))}
            className="w-3.5 h-3.5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
          />
          {c.nome}{c.codigo ? ` (${c.codigo})` : ''}
        </label>
      ))}
    </div>
  );

  // Contrato tags display
  const ContratoTags = ({ ids }: { ids: string[] }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {ids.map(id => (
        <span key={id} className="inline-block bg-cyan-50 text-cyan-700 text-[10px] px-1.5 py-0.5 rounded border border-cyan-200">
          {contratoNome(id)}
        </span>
      ))}
    </div>
  );

  return (
    <div className="bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <EnvelopeIcon className="w-7 h-7 text-cyan-600" />
          Notificações — Disponibilidade de Frota
        </h1>
        <p className="text-sm text-gray-500 mt-1">Configure emails e WhatsApp que receberão o resumo ao publicar a disponibilidade</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-2 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('email')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border',
              tab === 'email' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            )}
          >
            <EnvelopeIcon className="w-4 h-4" />
            Emails ({groupedEmails.length})
          </button>
          <button
            onClick={() => setTab('whatsapp')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border',
              tab === 'whatsapp' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            )}
          >
            <PhoneIcon className="w-4 h-4" />
            WhatsApp ({groupedWhatsapps.length})
          </button>
          <button onClick={loadNotificacoes} disabled={loading} className="ml-auto flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
            <ArrowPathIcon className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Tab Email */}
        {tab === 'email' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {canManage && (
            <>
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Adicionar destinatário de email</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="email"
                  value={emailForm.email}
                  onChange={e => setEmailForm({ ...emailForm, email: e.target.value })}
                  placeholder="Email *"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={emailForm.nome}
                  onChange={e => setEmailForm({ ...emailForm, nome: e.target.value })}
                  placeholder="Nome (opcional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={emailForm.descricao}
                  onChange={e => setEmailForm({ ...emailForm, descricao: e.target.value })}
                  placeholder="Descrição (opcional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Receberá notificações dos contratos:</label>
                <ContratoCheckboxes selected={emailFormContratos} onChange={setEmailFormContratos} />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddEmail}
                  disabled={!emailForm.email.trim() || emailFormContratos.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  <PlusIcon className="w-4 h-4" />
                  Adicionar
                </button>
              </div>
            </div>
            </>
            )}

            {/* Lista */}
            <div className="border-t border-gray-200">
              {groupedEmails.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  <EnvelopeIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  Nenhum email configurado
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {groupedEmails.map(item => (
                    <div key={item.email} className="px-4 py-3 hover:bg-gray-50">
                      {editingEmail === item.email ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <EnvelopeIcon className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-900">{item.email}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input value={editEmailData.nome} onChange={e => setEditEmailData({ ...editEmailData, nome: e.target.value })} placeholder="Nome" className="border border-gray-300 rounded px-2 py-1 text-sm" />
                            <input value={editEmailData.descricao} onChange={e => setEditEmailData({ ...editEmailData, descricao: e.target.value })} placeholder="Descrição" className="border border-gray-300 rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Contratos:</label>
                            <ContratoCheckboxes selected={editEmailContratos} onChange={setEditEmailContratos} />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => handleSaveEmail(item.email)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                              <CheckIcon className="w-4 h-4" /> Salvar
                            </button>
                            <button onClick={() => setEditingEmail(null)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">
                              <XMarkIcon className="w-4 h-4" /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <EnvelopeIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{item.email}</div>
                            {item.nome && <div className="text-xs text-gray-500">{item.nome}</div>}
                            {item.descricao && <div className="text-xs text-gray-400">{item.descricao}</div>}
                            <ContratoTags ids={item.contratoIds} />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {canManage && (
                            <>
                            <button onClick={() => {
                              setEditingEmail(item.email);
                              setEditEmailData({ nome: item.nome || '', descricao: item.descricao || '' });
                              setEditEmailContratos([...item.contratoIds]);
                            }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteEmail(item.email)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                            </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab WhatsApp */}
        {tab === 'whatsapp' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {canManage && (
            <>
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Adicionar número de WhatsApp</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={whatsappForm.numero}
                  onChange={e => setWhatsappForm({ ...whatsappForm, numero: e.target.value })}
                  placeholder="5511999999999 *"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={whatsappForm.nome}
                  onChange={e => setWhatsappForm({ ...whatsappForm, nome: e.target.value })}
                  placeholder="Nome (opcional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={whatsappForm.descricao}
                  onChange={e => setWhatsappForm({ ...whatsappForm, descricao: e.target.value })}
                  placeholder="Descrição (opcional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Receberá notificações dos contratos:</label>
                <ContratoCheckboxes selected={whatsappFormContratos} onChange={setWhatsappFormContratos} />
              </div>
              <p className="text-xs text-gray-500">Formato: código do país + DDD + número (ex: 5511999999999)</p>
              <div className="flex justify-end">
                <button
                  onClick={handleAddWhatsapp}
                  disabled={!whatsappForm.numero.trim() || whatsappFormContratos.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  <PlusIcon className="w-4 h-4" />
                  Adicionar
                </button>
              </div>
            </div>
            </>
            )}

            {/* Lista */}
            <div className="border-t border-gray-200">
              {groupedWhatsapps.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  <PhoneIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  Nenhum número configurado
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {groupedWhatsapps.map(item => (
                    <div key={item.numero} className="px-4 py-3 hover:bg-gray-50">
                      {editingWhatsapp === item.numero ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <PhoneIcon className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-900">{formatPhone(item.numero)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input value={editWhatsappData.nome} onChange={e => setEditWhatsappData({ ...editWhatsappData, nome: e.target.value })} placeholder="Nome" className="border border-gray-300 rounded px-2 py-1 text-sm" />
                            <input value={editWhatsappData.descricao} onChange={e => setEditWhatsappData({ ...editWhatsappData, descricao: e.target.value })} placeholder="Descrição" className="border border-gray-300 rounded px-2 py-1 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Contratos:</label>
                            <ContratoCheckboxes selected={editWhatsappContratos} onChange={setEditWhatsappContratos} />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => handleSaveWhatsapp(item.numero)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                              <CheckIcon className="w-4 h-4" /> Salvar
                            </button>
                            <button onClick={() => setEditingWhatsapp(null)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">
                              <XMarkIcon className="w-4 h-4" /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <PhoneIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{formatPhone(item.numero)}</div>
                            {item.nome && <div className="text-xs text-gray-500">{item.nome}</div>}
                            {item.descricao && <div className="text-xs text-gray-400">{item.descricao}</div>}
                            <ContratoTags ids={item.contratoIds} />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {canManage && (
                            <>
                            <button onClick={() => {
                              setEditingWhatsapp(item.numero);
                              setEditWhatsappData({ nome: item.nome || '', descricao: item.descricao || '' });
                              setEditWhatsappContratos([...item.contratoIds]);
                            }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteWhatsapp(item.numero)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                            </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Como funciona?</p>
          <p>• Adicione um email ou número de WhatsApp e selecione em quais contratos ele receberá notificações.</p>
          <p>• Ao clicar em &quot;Publicar Disponibilidade&quot;, o resumo é enviado automaticamente para todos os destinatários ativos do contrato.</p>
          <p>• O resumo inclui: veículos em manutenção (com oficina e dias), orçamento, reincidência, e uma planilha XLS anexa.</p>
          <p>• Edite um destinatário para alterar quais contratos ele recebe.</p>
        </div>
      </div>
    </div>
  );
}
