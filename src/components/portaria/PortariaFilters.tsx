'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchIcon, FilterIcon } from 'lucide-react';
import { memo } from 'react';

interface PortariaFiltersProps {
  search: string;
  setSearch: (value: string) => void;
  periodo: string;
  setPeriodo: (value: string) => void;
  dataInicio: string;
  setDataInicio: (value: string) => void;
  dataFim: string;
  setDataFim: (value: string) => void;
  contratoId: string;
  setContratoId: (value: string) => void;
  baseId: string;
  setBaseId: (value: string) => void;
  contratos: Array<{ id: string; nome: string; codigo: string }>;
  bases: Array<{ id: string; nome: string; codigo: string }>;
  onClear: () => void;
  isLoading?: boolean;
}

export const PortariaFilters = memo(({
  search,
  setSearch,
  periodo,
  setPeriodo,
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim,
  contratoId,
  setContratoId,
  baseId,
  setBaseId,
  contratos,
  bases,
  onClear,
  isLoading
}: PortariaFiltersProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <FilterIcon className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Filtros</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Buscar</label>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Placa, motorista, matrícula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Período</label>
          <Select value={periodo} onValueChange={(value) => {
            setPeriodo(value);
            if (value !== 'personalizado') {
              setDataInicio('');
              setDataFim('');
            }
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os dados</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="ontem">Ontem</SelectItem>
              <SelectItem value="7dias">Últimos 7 dias</SelectItem>
              <SelectItem value="15dias">Últimos 15 dias</SelectItem>
              <SelectItem value="1mes">Último mês</SelectItem>
              <SelectItem value="personalizado">Período personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Contrato</label>
          <Select value={contratoId} onValueChange={setContratoId}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os contratos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os contratos</SelectItem>
              {contratos.map((contrato) => (
                <SelectItem key={contrato.id} value={contrato.id}>
                  {contrato.nome} ({contrato.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Base</label>
          <Select value={baseId} onValueChange={setBaseId}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as bases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as bases</SelectItem>
              {bases.map((base) => (
                <SelectItem key={base.id} value={base.id}>
                  {base.nome} ({base.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {periodo === 'personalizado' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fim</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={onClear}
          className="px-6"
        >
          Limpar Filtros
        </Button>
      </div>
    </div>
  );
});

PortariaFilters.displayName = 'PortariaFilters';
