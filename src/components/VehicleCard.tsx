import type { Vehicle } from '@/types';
import Link from 'next/link'

interface VehicleCardProps {
  vehicle: Vehicle
}

export default function VehicleCard({ vehicle }: VehicleCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{vehicle.placa}</h3>
          <p className="text-gray-600">{vehicle.modelo}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          vehicle.status === 'operacao' ? 'bg-green-100 text-green-800' :
          ['manutenção', 'manutencao'].includes(vehicle.status?.toLowerCase() || '') ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {vehicle.status === 'operacao' ? 'Em Operação' :
           ['manutenção', 'manutencao'].includes(vehicle.status?.toLowerCase() || '') ? 'Em Manutenção' :
           vehicle.status}
        </span>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Equipe:</span>
          <span>{'Não atribuída'}</span> {/* TODO: Implement team relationship */}
        </div>
        <div className="flex justify-between">
          <span>Local:</span>
          <span>{vehicle.contrato?.nome || 'Não definido'}</span>
        </div>
        <div className="flex justify-between">
          <span>Quilometragem:</span>
          <span>{vehicle.quilometragem_atual?.toLocaleString() || 'N/A'} km</span>
        </div>
        <div className="flex justify-between">
          <span>Próxima Manutenção:</span>
          <span>{vehicle.proxima_manutencao ? new Date(vehicle.proxima_manutencao).toLocaleDateString('pt-BR') : 'N/A'}</span>
        </div>
        {vehicle.proxima_preventiva_km && (
          <div className="flex justify-between">
            <span>Próxima Preventiva:</span>
            <span className={`font-medium ${
              vehicle.quilometragem_atual >= vehicle.proxima_preventiva_km 
                ? 'text-red-600' 
                : vehicle.quilometragem_atual >= (vehicle.proxima_preventiva_km - (vehicle.alerta_preventiva_km || 1000))
                  ? 'text-yellow-600'
                  : 'text-green-600'
            }`}>
              {vehicle.proxima_preventiva_km.toLocaleString()} km
            </span>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <Link 
          href={`/vehicles/${vehicle.id}`}
          className="block w-full text-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Ver Detalhes
        </Link>
      </div>
    </div>
  )
} 