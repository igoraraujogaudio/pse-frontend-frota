'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreateViabilidadeChecklistDTO, ViabilidadeChecklist } from '@/types/viabilidade-checklist';
import { ClipboardCheck, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface ViabilidadeChecklistFormProps {
  obraId: string;
  numeroProjeto: string;
  municipio: string;
  quantidadePoste: number;
  existingChecklist?: ViabilidadeChecklist | null;
  onSubmit: (data: CreateViabilidadeChecklistDTO) => Promise<void>;
  onCancel: () => void;
}

export function ViabilidadeChecklistForm({
  obraId,
  numeroProjeto,
  municipio,
  quantidadePoste,
  existingChecklist,
  onSubmit,
  onCancel,
}: ViabilidadeChecklistFormProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateViabilidadeChecklistDTO>({
    obraId,
    projeto: existingChecklist?.projeto || numeroProjeto,
    data: existingChecklist?.data || new Date().toISOString().split('T')[0],
    cidade: existingChecklist?.cidade || municipio,
    quantidadePostes: existingChecklist?.quantidadePostes || quantidadePoste,
    tensaoRede: existingChecklist?.tensaoRede || '13.8',
    necessarioLV: existingChecklist?.necessarioLV || false,
    sinalTelefone: existingChecklist?.sinalTelefone || true,
    desligamentoNecessario: existingChecklist?.desligamentoNecessario || false,
    numeroChaveEquipamento: existingChecklist?.numeroChaveEquipamento || '',
    viabilidade: existingChecklist?.viabilidade || 'APTO',
    condicaoTracado: existingChecklist?.condicaoTracado || 'CONFORME',
    autorizacaoPassagem: existingChecklist?.autorizacaoPassagem || 'SIM',
    podaArvores: existingChecklist?.podaArvores || false,
    interferenciasIdentificadas: existingChecklist?.interferenciasIdentificadas || false,
    interferenciasDescricao: existingChecklist?.interferenciasDescricao || '',
    resumoTecnico: existingChecklist?.resumoTecnico || '',
    alertaSeguranca: existingChecklist?.alertaSeguranca || false,
    alertaSegurancaObs: existingChecklist?.alertaSegurancaObs || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      console.error('Erro ao salvar checklist:', err);
      alert('Erro ao salvar checklist de viabilidade.');
    } finally {
      setSaving(false);
    }
  };

  const RadioOption = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
    <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50 transition-colors">
      <input type="radio" checked={checked} onChange={onChange} className="w-4 h-4 text-blue-600" />
      <span className="text-sm">{label}</span>
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardCheck className="h-5 w-5 text-yellow-600" />
        <h3 className="text-lg font-bold text-gray-900">Informe de Viabilidade Técnica</h3>
      </div>

      {/* Dados do projeto */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Dados do Projeto</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Projeto</Label>
              <Input
                value={form.projeto}
                onChange={(e) => setForm({ ...form, projeto: e.target.value })}
                required
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                required
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                required
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <Label className="text-xs">Quantidade de Postes</Label>
            <Input
              type="number"
              value={form.quantidadePostes}
              onChange={(e) => setForm({ ...form, quantidadePostes: parseInt(e.target.value) || 0 })}
              className="h-8 text-sm w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Avaliações técnicas */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Avaliação Técnica</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          {/* Tensão da rede */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Tensão da rede:</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="13,8 kV" checked={form.tensaoRede === '13.8'} onChange={() => setForm({ ...form, tensaoRede: '13.8' })} />
              <RadioOption label="34,5 kV" checked={form.tensaoRede === '34.5'} onChange={() => setForm({ ...form, tensaoRede: '34.5' })} />
            </div>
          </div>

          {/* Necessário LV */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Necessário LV (Linha Viva):</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="Sim" checked={form.necessarioLV === true} onChange={() => setForm({ ...form, necessarioLV: true })} />
              <RadioOption label="Não" checked={form.necessarioLV === false} onChange={() => setForm({ ...form, necessarioLV: false })} />
            </div>
          </div>

          {/* Sinal de telefone */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Sinal de telefone no local:</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="Sim" checked={form.sinalTelefone === true} onChange={() => setForm({ ...form, sinalTelefone: true })} />
              <RadioOption label="Não" checked={form.sinalTelefone === false} onChange={() => setForm({ ...form, sinalTelefone: false })} />
            </div>
          </div>

          {/* Desligamento */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Desligamento necessário:</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="Sim" checked={form.desligamentoNecessario === true} onChange={() => setForm({ ...form, desligamentoNecessario: true })} />
              <RadioOption label="Não" checked={form.desligamentoNecessario === false} onChange={() => setForm({ ...form, desligamentoNecessario: false })} />
            </div>
            {form.desligamentoNecessario && (
              <div className="mt-2 ml-6">
                <Label className="text-xs">Número da chave/equipamento:</Label>
                <Input
                  value={form.numeroChaveEquipamento || ''}
                  onChange={(e) => setForm({ ...form, numeroChaveEquipamento: e.target.value })}
                  placeholder="Ex: IX11000009"
                  className="h-8 text-sm mt-1 w-64"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Viabilidade e Condições */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Viabilidade e Condições</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          {/* Viabilidade */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Viabilidade:</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="Apto à execução" checked={form.viabilidade === 'APTO'} onChange={() => setForm({ ...form, viabilidade: 'APTO' })} />
              <RadioOption label="Não apto" checked={form.viabilidade === 'NAO_APTO'} onChange={() => setForm({ ...form, viabilidade: 'NAO_APTO' })} />
            </div>
          </div>

          {/* Condição do traçado */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Condição do traçado:</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="Conforme projeto" checked={form.condicaoTracado === 'CONFORME'} onChange={() => setForm({ ...form, condicaoTracado: 'CONFORME' })} />
              <RadioOption label="Alteração necessária" checked={form.condicaoTracado === 'ALTERACAO_NECESSARIA'} onChange={() => setForm({ ...form, condicaoTracado: 'ALTERACAO_NECESSARIA' })} />
            </div>
          </div>

          {/* Autorização de passagem */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Autorização de passagem:</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="Sim" checked={form.autorizacaoPassagem === 'SIM'} onChange={() => setForm({ ...form, autorizacaoPassagem: 'SIM' })} />
              <RadioOption label="Não" checked={form.autorizacaoPassagem === 'NAO'} onChange={() => setForm({ ...form, autorizacaoPassagem: 'NAO' })} />
              <RadioOption label="Em andamento" checked={form.autorizacaoPassagem === 'EM_ANDAMENTO'} onChange={() => setForm({ ...form, autorizacaoPassagem: 'EM_ANDAMENTO' })} />
            </div>
          </div>

          {/* Poda de árvores */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Poda de árvores:</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="Necessária" checked={form.podaArvores === true} onChange={() => setForm({ ...form, podaArvores: true })} />
              <RadioOption label="Não necessária" checked={form.podaArvores === false} onChange={() => setForm({ ...form, podaArvores: false })} />
            </div>
          </div>

          {/* Interferências */}
          <div>
            <Label className="text-xs font-semibold text-gray-600">Interferências:</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="Não identificadas" checked={form.interferenciasIdentificadas === false} onChange={() => setForm({ ...form, interferenciasIdentificadas: false, interferenciasDescricao: '' })} />
              <RadioOption label="Identificadas" checked={form.interferenciasIdentificadas === true} onChange={() => setForm({ ...form, interferenciasIdentificadas: true })} />
            </div>
            {form.interferenciasIdentificadas && (
              <div className="mt-2 ml-6">
                <Input
                  value={form.interferenciasDescricao || ''}
                  onChange={(e) => setForm({ ...form, interferenciasDescricao: e.target.value })}
                  placeholder="Descreva as interferências..."
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo e Alertas */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Resumo e Segurança</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          <div>
            <Label className="text-xs font-semibold text-gray-600">Resumo técnico para execução:</Label>
            <Textarea
              value={form.resumoTecnico || ''}
              onChange={(e) => setForm({ ...form, resumoTecnico: e.target.value })}
              placeholder="Descreva observações técnicas relevantes..."
              rows={3}
              className="mt-1 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600">Existe alerta de segurança para esta obra?</Label>
            <div className="flex gap-4 mt-1">
              <RadioOption label="Sim" checked={form.alertaSeguranca === true} onChange={() => setForm({ ...form, alertaSeguranca: true })} />
              <RadioOption label="Não" checked={form.alertaSeguranca === false} onChange={() => setForm({ ...form, alertaSeguranca: false })} />
            </div>
            {form.alertaSeguranca && (
              <div className="mt-2">
                <Textarea
                  value={form.alertaSegurancaObs || ''}
                  onChange={(e) => setForm({ ...form, alertaSegurancaObs: e.target.value })}
                  placeholder="Descreva o alerta de segurança..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status visual */}
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50">
        {form.viabilidade === 'APTO' ? (
          <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Apto à execução
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> Não apto
          </Badge>
        )}
        {form.alertaSeguranca && (
          <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Alerta de segurança
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700" disabled={saving}>
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : (
            <ClipboardCheck className="h-4 w-4 mr-2" />
          )}
          {existingChecklist ? 'Atualizar Checklist' : 'Salvar e Avançar para Viabilidade'}
        </Button>
      </div>
    </form>
  );
}
