'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Upload, Download, Plus } from 'lucide-react';
import { NetworkMaintenanceService } from '@/services/networkMaintenanceService';
import { CalendarView, NetworkMaintenanceSchedule } from '@/types/maintenance-schedule';
import { MaintenanceActivityCard } from './MaintenanceActivityCard';
import { ImportExcelModal } from './ImportExcelModal';
import { AddActivityModal } from './AddActivityModal';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function MaintenanceCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarView | null>(null);
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  useEffect(() => {
    loadCalendarData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, currentMonth]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const data = await NetworkMaintenanceService.getSchedulesByMonth(currentYear, currentMonth);
      setCalendarData(data);
    } catch (error) {
      console.error('Erro ao carregar dados do calendário:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getDaysInMonth = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Dias vazios do mês anterior
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const getScheduleForDate = (day: number): NetworkMaintenanceSchedule | undefined => {
    if (!calendarData) return undefined;
    const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return calendarData.schedules.find(schedule => schedule.date === dateStr);
  };

  const handleExportExcel = async () => {
    try {
      const startDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-31`;
      
      const data = await NetworkMaintenanceService.exportToExcel(startDate, endDate);
      
      // Aqui você pode usar uma biblioteca como xlsx para gerar o arquivo
      console.log('Dados para exportação:', data);
      alert('Funcionalidade de exportação será implementada');
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  const handleAddActivity = (date: string) => {
    setSelectedDate(date);
    setShowAddModal(true);
  };

  const days = getDaysInMonth();

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Calendar className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            Programação de Manutenções - Rede Elétrica
          </h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar Excel
          </button>
          
          <button
            onClick={handleExportExcel}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateMonth('prev')}
          className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-5 w-5" />
          Anterior
        </button>
        
        <h2 className="text-xl font-semibold text-gray-900">
          {MONTHS[currentMonth - 1]} {currentYear}
        </h2>
        
        <button
          onClick={() => navigateMonth('next')}
          className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900"
        >
          Próximo
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {/* Days of week header */}
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="p-2 text-center font-semibold text-gray-700 bg-gray-100">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {days.map((day, index) => {
              if (day === null) {
                return <div key={index} className="p-2 h-32 bg-gray-50"></div>;
              }
              
              const schedule = getScheduleForDate(day);
              const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              
              return (
                <div key={day} className="p-1 h-32 border border-gray-200 bg-white relative">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium text-gray-900">{day}</span>
                    <button
                      onClick={() => handleAddActivity(dateStr)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Adicionar atividade"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  
                  <div className="space-y-1 overflow-y-auto max-h-20">
                    {schedule?.activities.map(activity => (
                      <MaintenanceActivityCard
                        key={activity.id}
                        activity={activity}
                        compact={true}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modals */}
      {showImportModal && (
        <ImportExcelModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={loadCalendarData}
        />
      )}
      
      {showAddModal && (
        <AddActivityModal
          date={selectedDate}
          onClose={() => setShowAddModal(false)}
          onActivityAdded={loadCalendarData}
        />
      )}
    </div>
  );
}