'use client';

import React from 'react';
import { NetworkMaintenanceActivity, ActivityStatus } from '@/types/maintenance-schedule';
import { DollarSign, MapPin, Users, FileText } from 'lucide-react';

interface MaintenanceActivityCardProps {
  activity: NetworkMaintenanceActivity;
  compact?: boolean;
}

const STATUS_COLORS = {
  [ActivityStatus.PANP]: 'bg-yellow-100 text-yellow-800',
  [ActivityStatus.CANC]: 'bg-red-100 text-red-800',
  [ActivityStatus.EXEC]: 'bg-green-100 text-green-800',
  [ActivityStatus.PROG]: 'bg-blue-100 text-blue-800',
  [ActivityStatus.PARP]: 'bg-orange-100 text-orange-800'
};

const STATUS_LABELS = {
  [ActivityStatus.PANP]: 'Parcial Não Planejada',
  [ActivityStatus.CANC]: 'Cancelada',
  [ActivityStatus.EXEC]: 'Executada',
  [ActivityStatus.PROG]: 'Programada',
  [ActivityStatus.PARP]: 'Parcial Planejada'
};

export function MaintenanceActivityCard({ activity, compact = false }: MaintenanceActivityCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (compact) {
    return (
      <div className="p-1 rounded text-xs bg-white border border-gray-200 mb-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">{activity.team}</span>
          <span className={`px-1 py-0.5 rounded text-xs ${STATUS_COLORS[activity.status]}`}>
            {activity.status}
          </span>
        </div>
        <div className="text-xs text-gray-600 truncate">{activity.location}</div>
        <div className="text-xs font-medium text-green-600">{formatCurrency(activity.value)}</div>
        {activity.statusNotes && (
          <div className="text-xs text-orange-600 truncate" title={activity.statusNotes}>
            Status: {activity.statusNotes}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-gray-900">{activity.team}</span>
        </div>
        
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[activity.status]}`}>
          {STATUS_LABELS[activity.status]}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center text-sm text-gray-600">
            <FileText className="h-4 w-4 mr-2 text-gray-400" />
            <span className="font-medium">OS:</span>
            <span className="ml-1 font-mono">{activity.osNumber}</span>
          </div>
          
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
            <span className="font-medium">Local:</span>
            <span className="ml-1">{activity.location}</span>
          </div>
          
          <div className="flex items-center text-sm">
            <DollarSign className="h-4 w-4 mr-2 text-green-600" />
            <span className="font-medium text-gray-600">Valor:</span>
            <span className="ml-1 font-semibold text-green-600">{formatCurrency(activity.value)}</span>
          </div>
        </div>

        {activity.statusNotes && (
          <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
            <span className="font-medium">Obs. Status:</span> {activity.statusNotes}
          </div>
        )}

        {activity.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
            <span className="font-medium">Observações:</span> {activity.notes}
          </div>
        )}
      </div>
    </div>
  );
}