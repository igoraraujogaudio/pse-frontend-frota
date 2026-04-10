'use client';

import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { NetworkMaintenanceService } from '@/services/networkMaintenanceService';
import { ActivityStatus } from '@/types/maintenance-schedule';

interface AddActivityModalProps {
  date: string;
  onClose: () => void;
  onActivityAdded: () => void;
}

export function AddActivityModal({ date, onClose, onActivityAdded }: AddActivityModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    team: '',
    osNumber: '',
    value: '',
    status: ActivityStatus.PROG,
    statusNotes: '',
    location: '',
    notes: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verificar se já existe programação para esta data
      const dateObj = new Date(date);
      let scheduleId: string;

      // Buscar ou criar programação
      const schedules = await NetworkMaintenanceService.getSchedulesByDateRange(date, date);
      
      if (schedules.length > 0) {
        scheduleId = schedules[0].id;
      } else {
        const newSchedule = await NetworkMaintenanceService.createSchedule({
          date,
          dayOfWeek: dateObj.getDay()
        });
        scheduleId = newSchedule.id;
      }

      // Adicionar atividade
      await NetworkMaintenanceService.addActivity({
        scheduleId,
        team: formData.team,
        osNumber: formData.osNumber,
        value: parseFloat(formData.value),
        status: formData.status,
        statusNotes: formData.statusNotes || undefined,
        location: formData.location,
        notes: formData.notes || undefined
      });

      onActivityAdded();
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar atividade:', error);
      alert('Erro ao adicionar atividade. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Adicionar Atividade de Manutenção</h2>
            <p className="text-gray-600">{formatDate(date)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Equipe *
              </label>
              <input
                type="text"
                name="team"
                value={formData.team}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: MK 01, LV 01, CESTO 01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(ActivityStatus).map(status => (
                  <option key={status} value={status}>
                    {status === 'PANP' && 'Parcial Não Planejada'}
                    {status === 'CANC' && 'Cancelada'}
                    {status === 'EXEC' && 'Executada'}
                    {status === 'PROG' && 'Programada'}
                    {status === 'PARP' && 'Parcial Planejada'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número da OS *
            </label>
            <input
              type="text"
              name="osNumber"
              value={formData.osNumber}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: A045420293"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                name="value"
                value={formData.value}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Localização *
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: NITEROI"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações do Status
            </label>
            <textarea
              name="statusNotes"
              value={formData.statusNotes}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Observações específicas sobre o status da OS..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações Gerais
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Observações gerais adicionais..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Atividade
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}