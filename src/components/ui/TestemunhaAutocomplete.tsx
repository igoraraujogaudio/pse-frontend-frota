import React, { useState, useEffect, useRef } from 'react';
import { User } from '@/types';
import { validarCPF } from '@/utils/cpfUtils';

interface TestemunhaAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  cpfValue: string;
  onCpfChange: (cpf: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

interface UserWithCPF extends User {
  cpf?: string;
}

export function TestemunhaAutocomplete({
  value,
  onChange,
  cpfValue,
  onCpfChange,
  placeholder = "Digite para buscar testemunha...",
  label = "Testemunha",
  required = false,
  className = ""
}: TestemunhaAutocompleteProps) {
  const [users, setUsers] = useState<UserWithCPF[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [cpfError, setCpfError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Carregar usuários do sistema
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (response.ok) {
        // Filtrar apenas usuários ativos (não demitidos, não suspensos) e remover duplicatas
        const usuariosAtivos = data.usuarios?.filter((user: UserWithCPF) => 
          user.status !== 'demitido' && user.status !== 'inativo' && user.status !== 'suspenso'
        ) || [];
        
        // Remover duplicatas baseado no ID
        const usuariosUnicos = usuariosAtivos.filter((user: UserWithCPF, index: number, self: UserWithCPF[]) => 
          index === self.findIndex((u: UserWithCPF) => u.id === user.id)
        );
        
        setUsers(usuariosUnicos);
      } else {
        console.error('Erro ao carregar usuários:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Filtrar usuários baseado na busca e remover duplicatas
  const filteredUsers = users
    .filter(user => {
      if (!value.trim()) return false;
      
      const searchLower = value.toLowerCase().trim();
      const nomeMatch = user.nome?.toLowerCase().includes(searchLower);
      const matriculaMatch = user.matricula?.toString().toLowerCase().includes(searchLower);
      
      return nomeMatch || matriculaMatch;
    })
    .filter((user, index, self) => 
      // Remover duplicatas baseado no ID
      index === self.findIndex(u => u.id === user.id)
    )
    .slice(0, 10); // Limitar a 10 resultados

  // Função para formatar CPF
  const formatarCPF = (cpf: string) => {
    cpf = cpf.replace(/\D/g, '');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return cpf;
  };

  // Função para selecionar usuário
  const handleSelectUser = (user: UserWithCPF) => {
    // Armazenar apenas o nome (sem matrícula) para compatibilidade com DB text
    onChange(user.nome || '');
    setShowAutocomplete(false);
    
    // Preencher CPF automaticamente se disponível
    if (user.cpf) {
      const formattedCpf = formatarCPF(user.cpf);
      onCpfChange(formattedCpf);
      setCpfError('');
    } else {
      // Limpar CPF se não disponível
      onCpfChange('');
    }
  };

  // Função para lidar com mudanças no input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    onChange(inputValue);
    
    if (inputValue.trim()) {
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
      onCpfChange('');
    }
  };

  // Função para lidar com mudanças no CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCpf = formatarCPF(e.target.value);
    onCpfChange(formattedCpf);
    
    // Validar CPF quando completo
    if (formattedCpf.replace(/\D/g, '').length === 11) {
      if (!validarCPF(formattedCpf)) {
        setCpfError('CPF inválido');
      } else {
        setCpfError('');
      }
    } else {
      setCpfError('');
    }
  };

  // Função para lidar com clique fora do componente
  const handleClickOutside = (event: MouseEvent) => {
    if (
      autocompleteRef.current &&
      !autocompleteRef.current.contains(event.target as Node) &&
      inputRef.current &&
      !inputRef.current.contains(event.target as Node)
    ) {
      setShowAutocomplete(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Campo de nome */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          ref={inputRef}
          type="text"
          className="rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
        />
        
        {/* Autocomplete dropdown */}
        {showAutocomplete && filteredUsers.length > 0 && (
          <div
            ref={autocompleteRef}
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                onClick={() => handleSelectUser(user)}
              >
                <div className="font-medium text-gray-900">
                  {user.nome}
                </div>
                <div className="text-xs text-gray-500">
                  {user.matricula && `Matrícula: ${user.matricula}`}
                  {user.cargo && ` • ${user.cargo}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campo de CPF */}
      <div className="flex flex-col gap-2 mt-2">
        <label className="text-xs font-semibold text-gray-700">
          CPF
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          className={`rounded-md border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${cpfError ? 'border-red-500' : ''}`}
          value={cpfValue}
          onChange={handleCpfChange}
          placeholder="000.000.000-00"
          maxLength={14}
          required={required}
        />
        {cpfError && (
          <span className="text-xs text-red-500">{cpfError}</span>
        )}
      </div>
    </div>
  );
}

