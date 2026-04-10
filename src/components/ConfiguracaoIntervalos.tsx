'use client';

import { useState, useEffect } from 'react';
import { ChartBarIcon, Cog6ToothIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Vehicle } from '@/types';
import { quilometragemPreventivaService } from '@/services/quilometragemPreventivaService';
import { useNotification } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConfiguracaoIntervalosProps {
  vehicles: Vehicle[];
  onVehicleUpdate?: (vehicle: Vehicle) => void;
}

export default function ConfiguracaoIntervalos({ vehicles, onVehicleUpdate }: ConfiguracaoIntervalosProps) {
  const { notify } = useNotification();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [intervaloPreventiva, setIntervaloPreventiva] = useState<number>(10000);
  const [alertaKm, setAlertaKm] = useState<number>(1000);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedVehicle) {
      setIntervaloPreventiva(selectedVehicle.intervalo_preventiva || 10000);
      setAlertaKm(selectedVehicle.alerta_preventiva_km || 1000);
    }
  }, [selectedVehicle]);

  const handleSalvarConfiguracao = async () => {
    if (!selectedVehicle) return;

    setLoading(true);
    try {
      const sucesso = await quilometragemPreventivaService.configurarIntervaloPreventiva(
        selectedVehicle.id.toString(),
        intervaloPreventiva,
        alertaKm
      );

      if (sucesso) {
        notify(`Intervalos configurados para ${selectedVehicle.placa}`, 'success');

        // Atualizar veículo localmente
        const veiculoAtualizado = {
          ...selectedVehicle,
          intervalo_preventiva: intervaloPreventiva,
          alerta_preventiva_km: alertaKm,
          proxima_preventiva_km: quilometragemPreventivaService.calcularProximaPreventiva(
            selectedVehicle.quilometragem_atual,
            intervaloPreventiva
          )
        };

        setSelectedVehicle(veiculoAtualizado);
        onVehicleUpdate?.(veiculoAtualizado);
      } else {
        notify('Não foi possível salvar a configuração', 'error');
      }
    } catch {
      notify('Ocorreu um erro ao salvar a configuração', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAplicarTodos = async () => {
    if (!confirm('Deseja aplicar esta configuração para todos os veículos?')) return;

    setLoading(true);
    try {
      let sucessos = 0;
      let erros = 0;

      for (const vehicle of vehicles) {
        const sucesso = await quilometragemPreventivaService.configurarIntervaloPreventiva(
          vehicle.id.toString(),
          intervaloPreventiva,
          alertaKm
        );

        if (sucesso) {
          sucessos++;
        } else {
          erros++;
        }
      }

      notify(
        `${sucessos} veículos configurados com sucesso${erros > 0 ? `, ${erros} erros` : ''}`,
        sucessos > 0 ? 'success' : 'error'
      );
    } catch {
      notify('Ocorreu um erro ao aplicar a configuração', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Cog6ToothIcon className="h-6 w-6 text-blue-600" />
        Configuração de Intervalos Preventivos
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seleção de Veículo */}
        <div>
          <Label htmlFor="veiculo-select" className="text-sm font-medium text-gray-700">
            Selecionar Veículo
          </Label>
          <select
            id="veiculo-select"
            className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedVehicle?.id || ''}
            onChange={(e) => {
              const vehicle = vehicles.find(v => v.id.toString() === e.target.value);
              setSelectedVehicle(vehicle || null);
            }}
          >
            <option value="">Selecione um veículo</option>
            {vehicles.map(vehicle => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.placa} - {vehicle.modelo}
              </option>
            ))}
          </select>
        </div>

        {/* Informações do Veículo Selecionado */}
        {selectedVehicle && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Informações do Veículo</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div><strong>Placa:</strong> {selectedVehicle.placa}</div>
              <div><strong>Modelo:</strong> {selectedVehicle.modelo}</div>
              <div><strong>Quilometragem Atual:</strong> {selectedVehicle.quilometragem_atual?.toLocaleString()} km</div>
              <div><strong>Última Preventiva:</strong> {selectedVehicle.quilometragem_preventiva?.toLocaleString() || 'N/A'} km</div>
              <div><strong>Próxima Preventiva:</strong> {selectedVehicle.proxima_preventiva_km?.toLocaleString() || 'N/A'} km</div>
            </div>
          </div>
        )}
      </div>

      {/* Configurações */}
      {selectedVehicle && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="intervalo-preventiva" className="text-sm font-medium text-gray-700">
              Intervalo Preventiva (km)
            </Label>
            <Input
              id="intervalo-preventiva"
              type="number"
              value={intervaloPreventiva}
              onChange={(e) => setIntervaloPreventiva(parseInt(e.target.value) || 10000)}
              className="mt-1"
              min="1000"
              max="100000"
              step="1000"
            />
            <p className="text-xs text-gray-500 mt-1">
              Intervalo padrão: 10.000 km
            </p>
          </div>

          <div>
            <Label htmlFor="alerta-km" className="text-sm font-medium text-gray-700">
              Alerta Preventiva (km antes)
            </Label>
            <Input
              id="alerta-km"
              type="number"
              value={alertaKm}
              onChange={(e) => setAlertaKm(parseInt(e.target.value) || 1000)}
              className="mt-1"
              min="100"
              max="5000"
              step="100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Alerta padrão: 1.000 km antes
            </p>
          </div>
        </div>
      )}

      {/* Preview da Configuração */}
      {selectedVehicle && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            Preview da Configuração
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-blue-700 font-medium">Nova Próxima Preventiva</div>
              <div className="text-blue-900">
                {quilometragemPreventivaService.calcularProximaPreventiva(
                  selectedVehicle.quilometragem_atual,
                  intervaloPreventiva
                ).toLocaleString()} km
              </div>
            </div>
            <div>
              <div className="text-blue-700 font-medium">Alerta em</div>
              <div className="text-blue-900">
                {(quilometragemPreventivaService.calcularProximaPreventiva(
                  selectedVehicle.quilometragem_atual,
                  intervaloPreventiva
                ) - alertaKm).toLocaleString()} km
              </div>
            </div>
            <div>
              <div className="text-blue-700 font-medium">Status Atual</div>
              <div className={`font-medium ${
                quilometragemPreventivaService.verificarStatusPreventiva(
                  selectedVehicle.quilometragem_atual,
                  quilometragemPreventivaService.calcularProximaPreventiva(
                    selectedVehicle.quilometragem_atual,
                    intervaloPreventiva
                  ),
                  alertaKm
                ) === 'VENCIDA' ? 'text-red-600' :
                quilometragemPreventivaService.verificarStatusPreventiva(
                  selectedVehicle.quilometragem_atual,
                  quilometragemPreventivaService.calcularProximaPreventiva(
                    selectedVehicle.quilometragem_atual,
                    intervaloPreventiva
                  ),
                  alertaKm
                ) === 'PROXIMA' ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {quilometragemPreventivaService.verificarStatusPreventiva(
                  selectedVehicle.quilometragem_atual,
                  quilometragemPreventivaService.calcularProximaPreventiva(
                    selectedVehicle.quilometragem_atual,
                    intervaloPreventiva
                  ),
                  alertaKm
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botões de Ação */}
      {selectedVehicle && (
        <div className="mt-6 flex gap-3">
          <Button
            onClick={handleSalvarConfiguracao}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
          
          <Button
            onClick={handleAplicarTodos}
            disabled={loading}
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            {loading ? 'Aplicando...' : 'Aplicar a Todos'}
          </Button>
        </div>
      )}

      {/* Estatísticas Gerais */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />
          Estatísticas da Frota
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-600">Total de Veículos</div>
            <div className="text-lg font-semibold text-gray-900">{vehicles.length}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-600">Intervalo Médio</div>
            <div className="text-lg font-semibold text-gray-900">
              {Math.round(vehicles.reduce((acc, v) => acc + (v.intervalo_preventiva || 10000), 0) / vehicles.length).toLocaleString()} km
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-600">Alerta Médio</div>
            <div className="text-lg font-semibold text-gray-900">
              {Math.round(vehicles.reduce((acc, v) => acc + (v.alerta_preventiva_km || 1000), 0) / vehicles.length).toLocaleString()} km
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-600">Com Preventiva Configurada</div>
            <div className="text-lg font-semibold text-gray-900">
              {vehicles.filter(v => v.proxima_preventiva_km).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


