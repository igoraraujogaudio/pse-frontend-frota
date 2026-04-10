'use client';

import { CheckCircleIcon, CalendarIcon, WrenchScrewdriverIcon, CurrencyDollarIcon, TruckIcon, UserGroupIcon, UserIcon, BuildingOfficeIcon, ChevronDownIcon, ChevronUpIcon, DocumentArrowDownIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

// Mock de histórico de manutenções finalizadas
const maintenanceHistory = [
  {
    id: 1,
    vehicle: {
      plate: 'ABC1234',
      model: 'Fiat Strada',
      brand: 'Fiat',
      year: '2023',
    },
    date: '2024-03-28',
    workshop: 'Auto Center São Paulo',
    operation: 'Operação Norte',
    services: [
      { description: 'Troca de óleo', value: 350 },
      { description: 'Alinhamento', value: 120 },
    ],
    total: 470,
    team: 'Equipe Alpha',
    supervisor: 'João Silva',
    mileage: 45000,
    days: 3,
    osPdf: '/os/OS_20240328.pdf',
    notes: 'Troca preventiva de óleo e alinhamento após revisão.',
  },
  {
    id: 2,
    vehicle: {
      plate: 'XYZ5678',
      model: 'Volkswagen Amarok',
      brand: 'Volkswagen',
      year: '2022',
    },
    date: '2024-03-25',
    workshop: 'Mecânica Express',
    operation: 'Operação Sul',
    services: [
      { description: 'Revisão geral', value: 600 },
      { description: 'Troca de pastilhas', value: 200 },
    ],
    total: 800,
    team: 'Equipe Beta',
    supervisor: 'Maria Santos',
    mileage: 38000,
    days: 2,
    osPdf: '/os/OS_20240325.pdf',
    notes: '',
  },
];

// Mock para filtros
const workshops = [
  'Todas Oficinas',
  'Auto Center São Paulo',
  'Mecânica Express',
];
const vehicles = [
  'Todas Placas',
  'ABC1234 - Fiat Strada',
  'XYZ5678 - Volkswagen Amarok',
];
const operations = [
  'Todas Operações',
  ...Array.from(new Set(maintenanceHistory.map(m => m.operation)))
];

export default function MaintenanceHistoryPage() {
  const [selectedWorkshop, setSelectedWorkshop] = useState('Todas Oficinas');
  const [selectedVehicle, setSelectedVehicle] = useState('Todas Placas');
  const [selectedOperation, setSelectedOperation] = useState('Todas Operações');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  // Filtro
  const filteredHistory = maintenanceHistory.filter(item => {
    const byWorkshop = selectedWorkshop === 'Todas Oficinas' || item.workshop === selectedWorkshop;
    const byVehicle = selectedVehicle === 'Todas Placas' || `${item.vehicle.plate} - ${item.vehicle.model}` === selectedVehicle;
    const byOperation = selectedOperation === 'Todas Operações' || item.operation === selectedOperation;
    const byDate = (!startDate || new Date(item.date) >= new Date(startDate)) && (!endDate || new Date(item.date) <= new Date(endDate));
    return byWorkshop && byVehicle && byOperation && byDate;
  });

  // Cálculos para os cards de resumo
  const totalCost = filteredHistory.reduce((acc, m) => acc + m.total, 0);
  const totalCount = filteredHistory.length;
  // Encontrar o primeiro e último mês do período filtrado
  let months = 1;
  if (filteredHistory.length > 1) {
    const dates = filteredHistory.map(m => new Date(m.date)).sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0];
    const last = dates[dates.length - 1];
    months = (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1;
    months = Math.max(months, 1);
  }
  const monthlyCost = totalCost / months;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Histórico de Manutenções</h1>
        <p className="text-gray-600 mb-8">Veja todas as manutenções já finalizadas e seus detalhes.</p>

        {/* Cards de resumo */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex items-center gap-4 bg-blue-50 border rounded-xl p-5 border-blue-100">
            <CurrencyDollarIcon className="h-8 w-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-700">R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="text-sm text-blue-800 font-medium">Custo Total</div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-green-50 border rounded-xl p-5 border-green-100">
            <ChartBarIcon className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-700">R$ {monthlyCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="text-sm text-green-800 font-medium">Custo Médio Mensal</div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-yellow-50 border rounded-xl p-5 border-yellow-100">
            <WrenchScrewdriverIcon className="h-8 w-8 text-yellow-600" />
            <div>
              <div className="text-2xl font-bold text-yellow-700">{totalCount}</div>
              <div className="text-sm text-yellow-800 font-medium">Total de Manutenções</div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4 mb-8 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Oficina</label>
            <select
              className="rounded-lg border border-gray-200 py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedWorkshop}
              onChange={e => setSelectedWorkshop(e.target.value)}
            >
              {workshops.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placa</label>
            <select
              className="rounded-lg border border-gray-200 py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedVehicle}
              onChange={e => setSelectedVehicle(e.target.value)}
            >
              {vehicles.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Operação</label>
            <select
              className="rounded-lg border border-gray-200 py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedOperation}
              onChange={e => setSelectedOperation(e.target.value)}
            >
              {operations.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="rounded-lg border border-gray-200 py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span className="text-gray-500 self-center">a</span>
              <input
                type="date"
                className="rounded-lg border border-gray-200 py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {filteredHistory.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
              {/* Card resumido */}
              <button
                className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 hover:bg-gray-50 transition-colors text-left"
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              >
                <div className="flex items-center gap-4 min-w-[220px]">
                  <TruckIcon className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="font-semibold text-lg text-gray-900">{item.vehicle.plate} - {item.vehicle.model}</div>
                    <div className="text-sm text-gray-500">{item.vehicle.brand} • Ano: {item.vehicle.year}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <BuildingOfficeIcon className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-medium text-blue-900 bg-blue-50 rounded px-2 py-0.5">{item.operation}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 min-w-[180px]">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                    {new Date(item.date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <WrenchScrewdriverIcon className="h-5 w-5 text-gray-400" />
                    {item.workshop}
                  </div>
                </div>
                <div className="flex flex-col gap-1 min-w-[180px]">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                    <span className="font-semibold text-lg text-green-700">R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 min-w-[120px]">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  <span className="font-bold text-green-700">Finalizada</span>
                  {expanded === item.id ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>
              {/* Card expandido */}
              {expanded === item.id && (
                <div className="p-0 md:p-6 pt-0 border-t border-gray-100">
                  <div className="flex flex-col md:flex-row md:gap-8 gap-6 py-6 md:items-start">
                    {/* Serviços à esquerda */}
                    <div className="md:w-1/2 w-full">
                      <div className="flex items-center gap-2 mb-3">
                        <WrenchScrewdriverIcon className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-gray-900">Serviços Realizados</span>
                      </div>
                      <ul className="divide-y divide-gray-100 bg-white rounded-lg mb-4">
                        {item.services.map((s, idx) => (
                          <li key={idx} className="flex items-center justify-between py-2 px-2">
                            <span className="text-sm text-gray-700">{s.description}</span>
                            <span className="text-sm font-medium text-gray-900">R$ {s.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </li>
                        ))}
                      </ul>
                      {item.notes && (
                        <div className="flex items-start gap-2 text-sm text-blue-900 bg-blue-50 rounded px-3 py-2 mt-2">
                          <BuildingOfficeIcon className="h-5 w-5 text-blue-400 mt-0.5" />
                          <span><span className="font-medium">Observações:</span> {item.notes}</span>
                        </div>
                      )}
                    </div>
                    {/* Resumo à direita */}
                    <div className="md:w-1/2 w-full flex flex-col gap-3 md:border-l md:border-gray-100 md:pl-8">
                      <div className="flex items-center gap-2 mb-2">
                        <WrenchScrewdriverIcon className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-gray-900">Resumo da Manutenção</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <UserGroupIcon className="h-5 w-5 text-gray-400" />
                        <span><span className="font-medium">Equipe:</span> {item.team}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <UserIcon className="h-5 w-5 text-gray-400" />
                        <span><span className="font-medium">Supervisor:</span> {item.supervisor}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <ChartBarIcon className="h-5 w-5 text-gray-400" />
                        <span><span className="font-medium">Quilometragem:</span> {item.mileage?.toLocaleString()} km</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <CalendarIcon className="h-5 w-5 text-gray-400" />
                        <span><span className="font-medium">Dias na oficina:</span> {item.days}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                        <span><span className="font-medium">Custo total:</span> R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <BuildingOfficeIcon className="h-5 w-5 text-blue-400" />
                        <span><span className="font-medium">Operação:</span> {item.operation}</span>
                      </div>
                      {item.osPdf && (
                        <div className="pt-4">
                          <a
                            href={item.osPdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-2 text-base font-medium"
                            title="Baixar Ordem de Serviço em PDF"
                          >
                            <DocumentArrowDownIcon className="h-5 w-5" /> Baixar Ordem de Serviço (PDF)
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
} 