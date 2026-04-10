"use client";

import { useState, useMemo } from 'react';
import { Search, Filter, Building, MapPin, Phone, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Workshop } from '@/types';

interface WorkshopSelectorProps {
  workshops: Workshop[];
  selectedWorkshopId: string;
  onSelectWorkshop: (workshopId: string) => void;
  onClose: () => void;
}

export default function WorkshopSelector({
  workshops,
  selectedWorkshopId,
  onSelectWorkshop,
  onClose
}: WorkshopSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContrato, setSelectedContrato] = useState<string>('');
  const [selectedBase, setSelectedBase] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Extrair contratos e bases únicos para filtros
  const contratos = useMemo(() => {
    const uniqueContratos = new Set<string>();
    workshops.forEach(workshop => {
      if (workshop.contrato?.nome) {
        uniqueContratos.add(workshop.contrato.nome);
      }
    });
    return Array.from(uniqueContratos).sort();
  }, [workshops]);

  const bases = useMemo(() => {
    const uniqueBases = new Set<string>();
    workshops.forEach(workshop => {
      if (workshop.base?.nome) {
        uniqueBases.add(workshop.base.nome);
      }
    });
    return Array.from(uniqueBases).sort();
  }, [workshops]);

  // Filtrar oficinas
  const filteredWorkshops = useMemo(() => {
    return workshops.filter(workshop => {
      const matchesSearch = 
        workshop.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workshop.cidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workshop.estado?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workshop.contrato?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workshop.base?.nome.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesContrato = !selectedContrato || workshop.contrato?.nome === selectedContrato;
      const matchesBase = !selectedBase || workshop.base?.nome === selectedBase;

      return matchesSearch && matchesContrato && matchesBase;
    });
  }, [workshops, searchTerm, selectedContrato, selectedBase]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedContrato('');
    setSelectedBase('');
  };

  const hasActiveFilters = searchTerm || selectedContrato || selectedBase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Selecionar Oficina</h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredWorkshops.length} oficina{filteredWorkshops.length !== 1 ? 's' : ''} encontrada{filteredWorkshops.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por nome, cidade, estado, contrato ou base..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1">
                  {[searchTerm, selectedContrato, selectedBase].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contrato</label>
                <select
                  value={selectedContrato}
                  onChange={(e) => setSelectedContrato(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todos os contratos</option>
                  {contratos.map(contrato => (
                    <option key={contrato} value={contrato}>{contrato}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Base</label>
                <select
                  value={selectedBase}
                  onChange={(e) => setSelectedBase(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todas as bases</option>
                  {bases.map(base => (
                    <option key={base} value={base}>{base}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="w-full"
                  disabled={!hasActiveFilters}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Workshops List */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {filteredWorkshops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Building className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-lg font-medium">Nenhuma oficina encontrada</p>
              <p className="text-sm">Tente ajustar os filtros ou termo de busca</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid gap-4">
                {filteredWorkshops.map((workshop) => (
                  <div
                    key={workshop.id}
                    onClick={() => onSelectWorkshop(workshop.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedWorkshopId === workshop.id
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{workshop.nome}</h3>
                          {selectedWorkshopId === workshop.id && (
                            <Badge variant="default" className="bg-blue-600">
                              <Check className="h-3 w-3 mr-1" />
                              Selecionada
                            </Badge>
                          )}
                          {!workshop.ativo && (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                              Inativa
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span>{workshop.endereco}</span>
                          </div>
                          
                          {workshop.telefone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span>{workshop.telefone}</span>
                            </div>
                          )}
                          
                          {workshop.cidade && workshop.estado && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span>{workshop.cidade}, {workshop.estado}</span>
                            </div>
                          )}
                        </div>

                        {/* Contrato e Base */}
                        {(workshop.contrato || workshop.base) && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex flex-wrap gap-4 text-xs">
                              {workshop.contrato && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-gray-700">Contrato:</span>
                                  <span className="text-gray-600">{workshop.contrato.nome} ({workshop.contrato.codigo})</span>
                                </div>
                              )}
                              {workshop.base && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-gray-700">Base:</span>
                                  <span className="text-gray-600">{workshop.base.nome} ({workshop.base.codigo})</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Especialidades */}
                        {workshop.especialidades && workshop.especialidades.length > 0 && (
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-1">
                              {workshop.especialidades.slice(0, 3).map((especialidade, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {especialidade}
                                </Badge>
                              ))}
                              {workshop.especialidades.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{workshop.especialidades.length - 3} mais
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedWorkshopId && (
              <span>
                Oficina selecionada: <strong>{workshops.find(w => w.id === selectedWorkshopId)?.nome}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (selectedWorkshopId) {
                  onSelectWorkshop(selectedWorkshopId);
                  onClose();
                }
              }}
              disabled={!selectedWorkshopId}
            >
              Confirmar Seleção
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


