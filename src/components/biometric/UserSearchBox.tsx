'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, User, Loader2, X } from 'lucide-react';
import { userService } from '@/services/userService';
import type { User as UserType } from '@/types';

interface UserSearchBoxProps {
  onSelectUser: (user: UserType | null) => void;
  selectedUser?: UserType | null;
  placeholder?: string;
  className?: string;
}

export function UserSearchBox({
  onSelectUser,
  selectedUser,
  placeholder = 'Buscar por nome ou matrícula...',
  className = '',
}: UserSearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserType[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carregar todos os usuários ativos uma vez
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const activeUsers = await userService.getUsuariosAtivos();
        setUsers(activeUsers);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  // Filtrar usuários baseado no termo de busca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers([]);
      setShowDropdown(false);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = users.filter((user) => {
      const nomeMatch = user.nome?.toLowerCase().includes(searchLower);
      const matriculaMatch = user.matricula?.toString().toLowerCase().includes(searchLower);
      const emailMatch = user.email?.toLowerCase().includes(searchLower);
      return nomeMatch || matriculaMatch || emailMatch;
    });

    setFilteredUsers(filtered.slice(0, 10)); // Limitar a 10 resultados
    setShowDropdown(filtered.length > 0);
    setHighlightedIndex(-1);
  }, [searchTerm, users]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atualizar campo de busca quando um usuário é selecionado
  useEffect(() => {
    if (selectedUser) {
      setSearchTerm(selectedUser.nome || '');
      setShowDropdown(false);
    }
  }, [selectedUser]);

  const handleSelectUser = (user: UserType) => {
    onSelectUser(user);
    setSearchTerm(user.nome || '');
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    setSearchTerm('');
    setFilteredUsers([]);
    setShowDropdown(false);
    onSelectUser(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filteredUsers.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredUsers.length) {
          handleSelectUser(filteredUsers[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            if (filteredUsers.length > 0) {
              setShowDropdown(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            type="button"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {showDropdown && filteredUsers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelectUser(user)}
              className={`w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none flex items-center gap-3 ${
                index === highlightedIndex ? 'bg-blue-50' : ''
              }`}
            >
              <User className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{user.nome}</p>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {user.matricula && (
                    <span className="truncate">Mat: {user.matricula}</span>
                  )}
                  {user.email && (
                    <span className="truncate">• {user.email}</span>
                  )}
                </div>
                {user.cargo && (
                  <p className="text-xs text-gray-500 truncate">{user.cargo}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
        </div>
      )}

      {/* Mensagem quando não há resultados */}
      {searchTerm && !loading && filteredUsers.length === 0 && showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          Nenhum funcionário encontrado
        </div>
      )}
    </div>
  );
}

