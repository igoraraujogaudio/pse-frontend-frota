import React from 'react';
import { BuildingOfficeIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Location {
  id: string;
  nome: string;
  cidade?: string;
  estado?: string;
}

interface VehicleTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  selectedLocationId: string | null;
  onLocationSelect: (locationId: string) => void;
  onTransfer: () => void;
  loading: boolean;
  currentLocationName?: string;
}

export function VehicleTransferModal({
  isOpen,
  onClose,
  locations,
  selectedLocationId,
  onLocationSelect,
  onTransfer,
  loading,
  currentLocationName
}: VehicleTransferModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 relative border border-green-100 flex flex-col gap-4">
        <button 
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl" 
          onClick={onClose} 
          aria-label="Fechar modal"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <BuildingOfficeIcon className="h-6 w-6 text-green-600" />
          Transferir Contrato
        </h3>

        {currentLocationName && (
          <div className="bg-blue-50 p-3 rounded-lg mb-4">
            <p className="text-sm text-blue-800">
              <strong>Contrato atual:</strong> {currentLocationName}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Selecione o novo contrato:
          </label>
          
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
            {locations.map((location) => {
              const isCurrent = currentLocationName === location.nome;
              const isSelected = selectedLocationId === location.id;
              
              return (
                <label
                  key={location.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-green-50 transition border-b border-gray-100 last:border-b-0 ${
                    isSelected ? 'bg-green-100' : ''
                  } ${isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="location"
                    value={location.id}
                    checked={isSelected}
                    onChange={() => !isCurrent && onLocationSelect(location.id)}
                    disabled={isCurrent}
                    className="form-radio text-green-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {location.nome}
                      </span>
                      {isCurrent && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Atual
                        </span>
                      )}
                    </div>
                    {location.cidade && location.estado && (
                      <span className="text-xs text-gray-500">
                        {location.cidade} - {location.estado}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            disabled={!selectedLocationId || loading}
            onClick={onTransfer}
          >
            {loading ? 'Transferindo...' : 'Transferir Contrato'}
          </button>
        </div>
      </div>
    </div>
  );
}