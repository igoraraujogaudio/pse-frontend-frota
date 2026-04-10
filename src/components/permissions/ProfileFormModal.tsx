'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  perfilAcessoService,
  validatePerfilForm,
  isFormValid,
} from '@/services/perfilAcessoService';
import type { PerfilFormData, PerfilFormErrors } from '@/services/perfilAcessoService';
import type { PerfilAcesso } from '@/types/permissions';

interface ProfileFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfil?: PerfilAcesso | null;
  onSuccess: (perfil: PerfilAcesso) => void;
}

const emptyForm: PerfilFormData = {
  codigo: '',
  nome: '',
  descricao: '',
  nivel_hierarquia: '',
  cor: '',
};

export default function ProfileFormModal({
  open,
  onOpenChange,
  perfil,
  onSuccess,
}: ProfileFormModalProps) {
  const isEditing = !!perfil;
  const [formData, setFormData] = useState<PerfilFormData>(emptyForm);
  const [errors, setErrors] = useState<PerfilFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens or perfil changes
  useEffect(() => {
    if (open) {
      if (perfil) {
        setFormData({
          codigo: perfil.codigo,
          nome: perfil.nome,
          descricao: perfil.descricao || '',
          nivel_hierarquia: perfil.nivel_hierarquia,
          cor: perfil.cor || '',
        });
      } else {
        setFormData(emptyForm);
      }
      setErrors({});
      setSubmitting(false);
    }
  }, [open, perfil]);

  const handleChange = (field: keyof PerfilFormData, value: string) => {
    const updated = { ...formData };

    if (field === 'nivel_hierarquia') {
      if (value === '') {
        updated.nivel_hierarquia = '';
      } else {
        const num = Number(value);
        if (!isNaN(num)) {
          updated.nivel_hierarquia = num;
        }
      }
    } else {
      (updated as Record<string, string>)[field] = value;
    }

    setFormData(updated);

    // Validate in real time
    const newErrors = validatePerfilForm(updated);
    // Keep api error until next submit
    if (errors.api) {
      newErrors.api = errors.api;
    }
    setErrors(newErrors);
  };

  const handleSubmit = async () => {
    const validationErrors = validatePerfilForm(formData);
    if (!isFormValid(formData, validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors((prev) => ({ ...prev, api: undefined }));

    const input = {
      codigo: formData.codigo,
      nome: formData.nome,
      descricao: formData.descricao || undefined,
      nivel_hierarquia: formData.nivel_hierarquia as number,
      cor: formData.cor || undefined,
    };

    try {
      let result: PerfilAcesso;
      if (isEditing && perfil) {
        result = await perfilAcessoService.update(perfil.id, input);
      } else {
        result = await perfilAcessoService.create(input);
      }
      onSuccess(result);
      onOpenChange(false);
    } catch (err: unknown) {
      const error = err as Record<string, unknown>;
      // Detect duplicate key error
      if (
        typeof error?.details === 'string' &&
        error.details.includes('duplicate key')
      ) {
        setErrors((prev) => ({
          ...prev,
          codigo: 'Este código já está em uso',
        }));
      } else if (error?.error) {
        setErrors((prev) => ({
          ...prev,
          api: String(error.error),
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          api: 'Erro de conexão. Tente novamente.',
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const valid = isFormValid(formData, errors);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do perfil de acesso'
              : 'Preencha os dados para criar um novo perfil de acesso'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Código */}
          <div className="space-y-1">
            <Label htmlFor="perfil-codigo">
              Código <span className="text-red-500">*</span>
            </Label>
            <Input
              id="perfil-codigo"
              placeholder="ex: admin_geral"
              autoCapitalize="none"
              autoCorrect="off"
              value={formData.codigo}
              onChange={(e) => handleChange('codigo', e.target.value.toLowerCase())}
              className={errors.codigo ? 'border-red-500' : ''}
            />
            {errors.codigo && (
              <p className="text-xs text-red-500">{errors.codigo}</p>
            )}
          </div>

          {/* Nome */}
          <div className="space-y-1">
            <Label htmlFor="perfil-nome">
              Nome <span className="text-red-500">*</span>
            </Label>
            <Input
              id="perfil-nome"
              placeholder="Nome do perfil"
              value={formData.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              className={errors.nome ? 'border-red-500' : ''}
            />
            {errors.nome && (
              <p className="text-xs text-red-500">{errors.nome}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <Label htmlFor="perfil-descricao">Descrição</Label>
            <Input
              id="perfil-descricao"
              placeholder="Descrição (opcional)"
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
            />
          </div>

          {/* Nível Hierárquico */}
          <div className="space-y-1">
            <Label htmlFor="perfil-nivel">
              Nível Hierárquico <span className="text-red-500">*</span>
            </Label>
            <Input
              id="perfil-nivel"
              type="number"
              min={1}
              placeholder="Ex: 1"
              value={formData.nivel_hierarquia}
              onChange={(e) => handleChange('nivel_hierarquia', e.target.value)}
              className={errors.nivel_hierarquia ? 'border-red-500' : ''}
            />
            {errors.nivel_hierarquia && (
              <p className="text-xs text-red-500">{errors.nivel_hierarquia}</p>
            )}
          </div>

          {/* Cor */}
          <div className="space-y-1">
            <Label htmlFor="perfil-cor">Cor</Label>
            <Input
              id="perfil-cor"
              placeholder="Ex: #3B82F6"
              value={formData.cor}
              onChange={(e) => handleChange('cor', e.target.value)}
            />
          </div>

          {/* API error */}
          {errors.api && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
              {errors.api}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || submitting}>
            {submitting
              ? 'Salvando...'
              : isEditing
                ? 'Salvar'
                : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
