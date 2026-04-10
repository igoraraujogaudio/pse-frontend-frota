'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface Funcionario {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  cargo?: string;
}

interface UserFromAPI {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  cargo?: string;
  status: string;
}

interface SelectFuncionarioProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectFuncionario({ 
  value, 
  onValueChange, 
  placeholder = "Digite para buscar funcionário...",
  disabled = false,
  className 
}: SelectFuncionarioProps) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(false);

  // Carregar funcionários não demitidos
  const carregarFuncionarios = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (response.ok) {
        // Filtrar apenas funcionários não demitidos e não suspensos
        const funcionariosAtivos = data.usuarios?.filter((user: UserFromAPI) => 
          user.status !== 'demitido' && user.status !== 'inativo' && user.status !== 'suspenso'
        ) || [];
        
        setFuncionarios(funcionariosAtivos);
      } else {
        console.error('Erro ao carregar funcionários:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFuncionarios();
  }, []);

  // Converter funcionários para o formato esperado pelo SearchableSelect
  // Remover duplicatas baseado no ID
  const funcionariosUnicos = funcionarios.filter((funcionario, index, self) => 
    index === self.findIndex(f => f.id === funcionario.id)
  );

  const items = funcionariosUnicos.map(funcionario => ({
    id: funcionario.id,
    nome: `${funcionario.nome} (${funcionario.matricula})`,
    codigo: funcionario.matricula,
    categoria: funcionario.cargo || 'Funcionário'
  }));

  return (
    <div className={className}>
      <Label className="mb-2 block">Funcionário</Label>
      <SearchableSelect
        items={items}
        value={value || ''}
        onValueChange={onValueChange}
        placeholder={loading ? 'Carregando funcionários...' : placeholder}
        disabled={disabled || loading}
      />
    </div>
  );
}
