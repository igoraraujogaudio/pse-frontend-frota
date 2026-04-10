import React, { useState, useEffect, useCallback } from 'react';
import { UserGroupIcon, XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { teamService } from '@/services/teamService';
// import { useAuth } from '@/contexts/AuthContext'; // TODO: Use when needed
import type { Team } from '@/types';

interface VehicleTeamReallocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  vehiclePlaca: string;
  currentTeamId?: string | null;
  onReallocate: (targetTeamId: string | null) => void;
  loading?: boolean;
}

export function VehicleTeamReallocateModal({
  isOpen,
  onClose,
  vehicleId, // eslint-disable-line @typescript-eslint/no-unused-vars
  vehiclePlaca,
  currentTeamId,
  onReallocate,
  loading = false
}: VehicleTeamReallocateModalProps) {
  // const { userContratoIds } = useAuth(); // TODO: Use when needed
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  const loadTeams = useCallback(async () => {
    try {
      setIsLoadingTeams(true);
      const availableTeams = await teamService.getAll();
      setTeams(availableTeams || []);
    } catch (error) {
      console.error('Erro ao carregar equipes:', error);
    } finally {
      setIsLoadingTeams(false);
    }
  }, []);

  // Carregar equipes disponíveis quando o modal abre
  useEffect(() => {
    if (isOpen) {
      loadTeams();
    }
  }, [isOpen, loadTeams]);

  const handleReallocate = () => {
    onReallocate(selectedTeamId);
  };

  // const handleRemoveFromTeam = () => {
  //   onReallocate(null); // null = remover da equipe atual
  // }; // TODO: Use when needed

  if (!isOpen) return null;

  const currentTeam = teams.find(t => t.id === currentTeamId);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-7 relative border border-blue-100 flex flex-col gap-4">
        <button 
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl" 
          onClick={onClose} 
          aria-label="Fechar modal"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <UserGroupIcon className="h-6 w-6 text-blue-600" />
          Realocar Equipe do Veículo
        </h3>

        <div className="bg-blue-50 p-3 rounded-lg mb-4">
          <p className="text-sm text-blue-800">
            <strong>Veículo:</strong> {vehiclePlaca}
            {currentTeam && (
              <>
                <br />
                <strong>Equipe atual:</strong> {currentTeam.nome}
              </>
            )}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Escolha uma ação:
            </label>
            
            {/* Opção 1: Remover da equipe atual */}
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value="remove"
                    checked={selectedTeamId === null}
                    onChange={() => setSelectedTeamId(null)}
                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      Remover da equipe atual
                    </div>
                    <div className="text-sm text-gray-500">
                      O veículo ficará sem equipe alocada
                    </div>
                  </div>
                </label>
              </div>

              {/* Opção 2: Transferir para outra equipe */}
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value="transfer"
                    checked={selectedTeamId !== null}
                    onChange={() => setSelectedTeamId('')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      Transferir para outra equipe
                    </div>
                    <div className="text-sm text-gray-500">
                      Escolha uma nova equipe para o veículo
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Seleção de equipe */}
          {selectedTeamId !== null && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selecione a nova equipe:
              </label>
              
              {isLoadingTeams ? (
                <div className="text-center py-4">
                  <div className="text-gray-500">Carregando equipes...</div>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {teams.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Nenhuma equipe disponível
                    </div>
                  ) : (
                    teams.map((team) => {
                      const isCurrentTeam = team.id === currentTeamId;
                      const isSelected = selectedTeamId === team.id;
                      
                      return (
                        <label key={team.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                          <input
                            type="radio"
                            name="team"
                            value={team.id}
                            checked={isSelected}
                            onChange={() => setSelectedTeamId(team.id)}
                            disabled={isCurrentTeam}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {team.nome}
                              </span>
                              {isCurrentTeam && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  Atual
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {team.operacao ? `Operação: ${team.operacao}` : ''}
                            </div>
                          </div>
                          <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={loading || (selectedTeamId !== null && !selectedTeamId)}
            onClick={handleReallocate}
          >
            {loading ? 'Processando...' : 'Confirmar Realocação'}
          </button>
        </div>
      </div>
    </div>
  );
}
