'use client';

import { useState, useEffect } from 'react';
import { ChartBarIcon, ExclamationTriangleIcon, CheckCircleIcon, ClockIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { Vehicle } from '@/types';

interface QuilometragemAlert {
  id: string;
  placa: string;
  modelo: string;
  quilometragem_atual: number;
  proxima_preventiva_km: number;
  km_restantes: number;
  status_alerta: 'PREVENTIVA_VENCIDA' | 'PREVENTIVA_PROXIMA' | null;
  contrato_nome?: string;
  base_nome?: string;
}

interface QuilometragemDashboardProps {
  vehicles: Vehicle[];
}

export default function QuilometragemDashboard({ vehicles }: QuilometragemDashboardProps) {
  const [alerts, setAlerts] = useState<QuilometragemAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular busca de alertas (em produção viria da API)
    const processAlerts = () => {
      const alertList: QuilometragemAlert[] = [];
      
      vehicles.forEach(vehicle => {
        if (vehicle.quilometragem_atual && vehicle.proxima_preventiva_km) {
          const kmRestantes = Math.max(0, vehicle.proxima_preventiva_km - vehicle.quilometragem_atual);
          const alertaKm = vehicle.alerta_preventiva_km || 1000;
          
          let status: 'PREVENTIVA_VENCIDA' | 'PREVENTIVA_PROXIMA' | null = null;
          
          if (vehicle.quilometragem_atual >= vehicle.proxima_preventiva_km) {
            status = 'PREVENTIVA_VENCIDA';
          } else if (vehicle.quilometragem_atual >= (vehicle.proxima_preventiva_km - alertaKm)) {
            status = 'PREVENTIVA_PROXIMA';
          }
          
          if (status) {
            alertList.push({
              id: vehicle.id.toString(),
              placa: vehicle.placa,
              modelo: vehicle.modelo,
              quilometragem_atual: vehicle.quilometragem_atual,
              proxima_preventiva_km: vehicle.proxima_preventiva_km,
              km_restantes: kmRestantes,
              status_alerta: status,
              contrato_nome: vehicle.contrato?.nome,
              base_nome: vehicle.base?.nome
            });
          }
        }
      });
      
      setAlerts(alertList);
      setLoading(false);
    };

    processAlerts();
  }, [vehicles]);

  const vencidas = alerts.filter(a => a.status_alerta === 'PREVENTIVA_VENCIDA');
  const proximas = alerts.filter(a => a.status_alerta === 'PREVENTIVA_PROXIMA');
  
  // Contar veículos sem dados (sem última preventiva registrada)
  const semDados = vehicles.filter(v => !v.quilometragem_preventiva || !v.proxima_preventiva_km).length;
  
  // Veículos OK são os que têm dados e não estão nos alertas
  const veiculosComDados = vehicles.filter(v => v.quilometragem_atual && v.proxima_preventiva_km).length;
  const veiculosOK = veiculosComDados - alerts.length;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <ChartBarIcon className="h-6 w-6 text-blue-600" />
        Alertas de Quilometragem Preventiva
      </h3>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
          <div>
            <div className="text-2xl font-bold text-red-700">{vencidas.length}</div>
            <div className="text-sm text-red-800 font-medium">Preventivas Vencidas</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <ClockIcon className="h-8 w-8 text-yellow-600" />
          <div>
            <div className="text-2xl font-bold text-yellow-700">{proximas.length}</div>
            <div className="text-sm text-yellow-800 font-medium">Preventivas Próximas</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircleIcon className="h-8 w-8 text-green-600" />
          <div>
            <div className="text-2xl font-bold text-green-700">{veiculosOK}</div>
            <div className="text-sm text-green-800 font-medium">Veículos OK</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-300 rounded-lg p-4">
          <QuestionMarkCircleIcon className="h-8 w-8 text-gray-600" />
          <div>
            <div className="text-2xl font-bold text-gray-700">{semDados}</div>
            <div className="text-sm text-gray-800 font-medium">Sem Dados</div>
          </div>
        </div>
      </div>

      {/* Lista de Alertas */}
      {alerts.length > 0 ? (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-800">Veículos com Alertas</h4>
          {alerts.map(alert => (
            <div 
              key={alert.id}
              className={`p-4 rounded-lg border-l-4 ${
                alert.status_alerta === 'PREVENTIVA_VENCIDA' 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-yellow-500 bg-yellow-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">
                    {alert.placa} - {alert.modelo}
                  </div>
                  <div className="text-sm text-gray-600">
                    {alert.contrato_nome && `${alert.contrato_nome}`}
                    {alert.base_nome && ` - ${alert.base_nome}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    Atual: {alert.quilometragem_atual.toLocaleString()} km
                  </div>
                  <div className="text-sm text-gray-600">
                    Preventiva: {alert.proxima_preventiva_km.toLocaleString()} km
                  </div>
                  <div className={`text-sm font-medium ${
                    alert.status_alerta === 'PREVENTIVA_VENCIDA' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {alert.status_alerta === 'PREVENTIVA_VENCIDA' 
                      ? 'Vencida!' 
                      : `Faltam ${alert.km_restantes.toLocaleString()} km`
                    }
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-lg font-medium">Nenhum alerta de quilometragem</p>
          <p className="text-sm">Todos os veículos estão dentro do prazo para manutenção preventiva</p>
        </div>
      )}
    </div>
  );
}



