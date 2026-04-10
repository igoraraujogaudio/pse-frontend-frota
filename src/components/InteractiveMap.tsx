'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para os ícones do Leaflet no Next.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícones customizados para OS críticas e normais
const createCustomIcon = (isCritical: boolean, status: string) => {
  const color = getStatusColor(status);
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        ${isCritical ? `
          <svg width="14" height="14" viewBox="0 0 24 24" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
            <path d="M12 2L2 22h20L12 2z" fill="#fbbf24"/>
            <text x="12" y="18" text-anchor="middle" font-size="16" font-weight="900" fill="#000">!</text>
          </svg>
        ` : `
          <div style="
            font-size: 11px;
            color: white;
            font-weight: bold;
          ">${getStatusIcon(status)}</div>
        `}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};
const getStatusColor = (status: string) => {
  switch (status) {
    case 'PROG': return '#2563eb';  // Azul - Programada
    case 'EXEC': return '#16a34a';  // Verde - Executada
    case 'CANC': return '#dc2626';  // Vermelho - Cancelada
    case 'PARP': return '#eab308';  // Amarelo - Parcial Planejada
    case 'PANP': return '#ea580c';  // Laranja - Parcial Não Planejada
    default: return '#9333ea';      // Roxo - Outros
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'PROG': return '●';  // Programada
    case 'EXEC': return '✓';  // Executada
    case 'CANC': return '✗';  // Cancelada
    case 'PARP': return '◐';  // Parcial Planejada
    case 'PANP': return '◑';  // Parcial Não Planejada
    default: return '●';       // Outros
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PROG': return 'Programada';
    case 'EXEC': return 'Executada';
    case 'CANC': return 'Cancelada';
    case 'PARP': return 'Parcial Planejada';
    case 'PANP': return 'Parcial Não Planejada';
    default: return status;
  }
};

// Função para validar e limpar coordenadas
const parseCoordinates = (coordStr: string): [number, number] | null => {
  if (!coordStr) return null;
  
  try {
    // Limpar a string de coordenadas
    const cleaned = coordStr
      .replace(/[^\d.,-]/g, '') // Remove caracteres não numéricos exceto . , -
      .replace(/,+/g, ',') // Remove vírgulas duplicadas
      .trim();
    
    const parts = cleaned.split(',');
    if (parts.length !== 2) return null;
    
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    
    // Validar se são coordenadas válidas para a região do Rio de Janeiro
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -25 || lat > -20 || lng < -45 || lng > -40) return null;
    
    return [lat, lng];
  } catch (error) {
    console.warn('Erro ao fazer parse de coordenada:', coordStr, error);
    return null;
  }
};

interface OSActivity {
  id?: string;
  team: string;
  osNumber: string;
  value: number;
  status: string;
  location: string;
  date?: string;
  critico?: string;
  coordenada?: string;
  prioridade?: string;
  atividade?: string;
  notes?: string;
}

interface InteractiveMapProps {
  activities: OSActivity[];
  onActivityClick?: (activity: OSActivity) => void;
  // Filtros
  filterStatus?: string;
  filterCritico?: string;
  filterMonth?: number;
  filterYear?: number;
  filterDay?: string;
  onFilterStatusChange?: (value: string) => void;
  onFilterCriticoChange?: (value: string) => void;
  onFilterMonthChange?: (value: number) => void;
  onFilterYearChange?: (value: number) => void;
  onFilterDayChange?: (value: string) => void;
  onClearFilters?: () => void;
}

// Componente para inicializar o mapa
function MapInitializer({ onReady }: { onReady: () => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    try {
      // Aguardar o mapa estar totalmente pronto e o container disponível
      const container = map.getContainer();
      if (container && container.parentElement) {
        map.whenReady(() => {
          // Pequeno delay adicional para garantir que o DOM está pronto
          setTimeout(() => {
            onReady();
          }, 200);
        });
      } else {
        // Se o container não estiver pronto, tentar novamente
        setTimeout(() => {
          const cont = map.getContainer();
          if (cont && cont.parentElement) {
            map.whenReady(() => {
              setTimeout(() => {
                onReady();
              }, 200);
            });
          }
        }, 100);
      }
    } catch (error) {
      console.error('Erro ao inicializar mapa:', error);
    }
  }, [map, onReady]);
  
  return null;
}

// Componente para ajustar o zoom do mapa baseado nos marcadores
function MapBounds({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [coordinates, map]);
  
  return null;
}

// Componente customizado de Zoom
function CustomZoomControl() {
  const map = useMap();
  
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
      <button
        onClick={() => map.zoomIn()}
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/90 backdrop-blur-sm border-2 border-gray-300 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 text-gray-700 hover:bg-gray-50 font-bold text-lg"
        title="Aumentar zoom"
      >
        +
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/90 backdrop-blur-sm border-2 border-gray-300 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 text-gray-700 hover:bg-gray-50 font-bold text-lg"
        title="Diminuir zoom"
      >
        −
      </button>
    </div>
  );
}

// Componente para habilitar Ctrl+Scroll zoom (desktop) mantendo pinch (mobile)
function ScrollZoomHandler() {
  const map = useMap();
  
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Se Ctrl estiver pressionado, permite zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        map.scrollWheelZoom.enable();
      } else {
        map.scrollWheelZoom.disable();
      }
    };

    const mapContainer = map.getContainer();
    mapContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      mapContainer.removeEventListener('wheel', handleWheel);
    };
  }, [map]);

  return null;
}

// Componente para aumentar z-index do Leaflet APENAS quando popup estiver aberto
function PopupEscaper() {
  const map = useMap();
  
  useEffect(() => {
    const container = map.getContainer();
    
    // Quando popup ABRIR: aumentar z-index do container TODO
    const handlePopupOpen = () => {
      container.style.zIndex = '9999';
    };
    
    // Quando popup FECHAR: reduzir z-index do container
    const handlePopupClose = () => {
      container.style.zIndex = '1';
    };
    
    map.on('popupopen', handlePopupOpen);
    map.on('popupclose', handlePopupClose);
    
    return () => {
      map.off('popupopen', handlePopupOpen);
      map.off('popupclose', handlePopupClose);
      container.style.zIndex = '1';
    };
  }, [map]);
  
  return null;
}

// Interface para grupo de atividades por data
interface DateGroup {
  date: string;
  activities: Array<OSActivity & { coordinates: [number, number] }>;
}

// Interface para grupo de atividades
interface GroupedActivity {
  osNumber: string;
  coordinates: [number, number];
  location: string;
  dateGroups: DateGroup[]; // Agrupado por data
  isCritical: boolean;
  primaryStatus: string;
}

export default function InteractiveMap({ 
  activities, 
  onActivityClick
}: InteractiveMapProps) {
  const [groupedActivities, setGroupedActivities] = useState<GroupedActivity[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-22.9, -43.1]); // Niterói como centro padrão
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showFilters, setShowFilters] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [canRenderMap, setCanRenderMap] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // Função para fechar todos os popups do mapa
  const closeAllPopups = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.closePopup();
    }
  }, []);

  // Garantir que o componente está montado no cliente
  useEffect(() => {
    setIsMounted(true);
    // Dar um pequeno delay para garantir que o DOM está completamente pronto
    const timer = setTimeout(() => {
      setCanRenderMap(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Callback estável para quando o mapa estiver pronto
  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  useEffect(() => {
    // Parsear coordenadas
    const activitiesWithCoords = activities
      .map(activity => {
        const coords = parseCoordinates(activity.coordenada || '');
        return coords ? { ...activity, coordinates: coords } : null;
      })
      .filter((activity): activity is OSActivity & { coordinates: [number, number] } => activity !== null);

    // Agrupar por osNumber + coordenadas
    const grouped = new Map<string, GroupedActivity>();
    
    activitiesWithCoords.forEach(activity => {
      // Chave única: osNumber + coordenadas arredondadas
      const coordKey = `${activity.coordinates[0].toFixed(5)},${activity.coordinates[1].toFixed(5)}`;
      const key = `${activity.osNumber}-${coordKey}`;
      
      if (grouped.has(key)) {
        const group = grouped.get(key)!;
        
        // Procurar se já existe um grupo para essa data
        const dateGroup = group.dateGroups.find(dg => dg.date === activity.date);
        
        if (dateGroup) {
          // Adicionar à data existente
          dateGroup.activities.push(activity);
        } else {
          // Criar novo grupo de data
          group.dateGroups.push({
            date: activity.date || '',
            activities: [activity]
          });
        }
        
        // Atualizar criticidade se alguma for crítica
        if (activity.critico?.toUpperCase() === 'SIM') {
          group.isCritical = true;
        }
        
        // Atualizar status primário (priorizar EXEC, depois CANC, depois outros)
        if (activity.status === 'EXEC' || 
            (group.primaryStatus !== 'EXEC' && activity.status === 'CANC')) {
          group.primaryStatus = activity.status;
        }
      } else {
        // Criar novo grupo
        grouped.set(key, {
          osNumber: activity.osNumber,
          coordinates: activity.coordinates,
          location: activity.location,
          dateGroups: [{
            date: activity.date || '',
            activities: [activity]
          }],
          isCritical: activity.critico?.toUpperCase() === 'SIM',
          primaryStatus: activity.status
        });
      }
    });

    setGroupedActivities(Array.from(grouped.values()));

    // Calcular centro do mapa
    if (activitiesWithCoords.length > 0) {
      const avgLat = activitiesWithCoords.reduce((sum, act) => sum + act.coordinates[0], 0) / activitiesWithCoords.length;
      const avgLng = activitiesWithCoords.reduce((sum, act) => sum + act.coordinates[1], 0) / activitiesWithCoords.length;
      setMapCenter([avgLat, avgLng]);
    }
  }, [activities]);

  return (
    <div className="relative h-full w-full">
      {/* CSS customizado para posicionar o zoom control e FORÇAR popup acima de tudo */}
      <style jsx global>{`
        /* Garantir que o container do mapa não sobreponha os filtros */
        .leaflet-container {
          z-index: 1 !important;
        }
        .leaflet-pane {
          z-index: 1 !important;
        }
        .leaflet-map-pane {
          z-index: 1 !important;
        }
        .leaflet-tile-pane {
          z-index: 1 !important;
        }
        .leaflet-overlay-pane {
          z-index: 2 !important;
        }
        .leaflet-shadow-pane {
          z-index: 3 !important;
        }
        .leaflet-marker-pane {
          z-index: 4 !important;
        }
        .leaflet-tooltip-pane {
          z-index: 5 !important;
        }
        .leaflet-top.leaflet-right {
          top: 50% !important;
          transform: translateY(-50%) !important;
          right: 10px !important;
          z-index: 1001 !important;
        }
        .leaflet-control-zoom {
          margin: 0 !important;
          z-index: 1001 !important;
        }
        
        /* FORÇAR popup do Leaflet a ficar acima de TUDO */
        .leaflet-popup-pane {
          z-index: 99999 !important;
        }
        .leaflet-popup {
          z-index: 99999 !important;
        }
        
        /* Ajustar posicionamento do botão X de fechar */
        .leaflet-popup-close-button {
          position: absolute !important;
          top: 6px !important;
          right: 6px !important;
          width: 26px !important;
          height: 26px !important;
          font-size: 22px !important;
          font-weight: bold !important;
          color: white !important;
          background: rgba(220, 38, 38, 0.9) !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          line-height: 1 !important;
          z-index: 10000 !important;
          text-decoration: none !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        }
        .leaflet-popup-close-button:hover {
          background: rgba(220, 38, 38, 1) !important;
          color: white !important;
          transform: scale(1.1) !important;
        }
        
        /* Garantir que o content-wrapper tenha overflow visible */
        .leaflet-popup-content-wrapper {
          overflow: visible !important;
        }
        
        /* Melhorar contraste do popup */
        .leaflet-popup-content {
          margin: 0 !important;
        }
      `}</style>

      {/* Legenda Interativa (Filtro de Status) */}



      {/* Dica de zoom */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow-md text-[10px] text-gray-600 border border-gray-200">
        💡 Ctrl+Scroll ou Pinch para zoom
      </div>
      
      {!isMounted ? (
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <div className="text-4xl mb-4">🗺️</div>
            <p className="text-gray-600">Carregando mapa...</p>
          </div>
        </div>
      ) : (
        <MapContainer
          key="leaflet-map"
          center={mapCenter}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
          
          scrollWheelZoom={false}
          doubleClickZoom={true}
          touchZoom={true}
          dragging={true}
          zoomControl={false}
          trackResize={true}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={mapRef as any}
          whenReady={() => {
            // MapContainer está pronto
            console.log('MapContainer ready');
          }}
        >
        <MapInitializer onReady={handleMapReady} />
        <PopupEscaper />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <CustomZoomControl />
        <ScrollZoomHandler />
        {mapReady && <MapBounds coordinates={groupedActivities.map(group => group.coordinates)} />}
        
        {groupedActivities.map((group, index) => {
          const uniqueKey = `${group.osNumber}-${group.coordinates[0]}-${group.coordinates[1]}-${index}`;
          const totalActivities = group.dateGroups.reduce((sum, dg) => sum + dg.activities.length, 0);
          const hasMultipleDates = group.dateGroups.length > 1;
          
          return (
            <Marker
              key={uniqueKey}
              position={group.coordinates}
              icon={createCustomIcon(group.isCritical, group.primaryStatus)}
            >
              <Popup maxWidth={280} maxHeight={350} className="leaflet-popup-custom">
                <div style={{ width: '260px', maxHeight: '320px', overflow: 'visible', padding: '0 2px' }}>
                  {/* Header Moderno - COMPACTO com ALTO CONTRASTE */}
                  <div className="relative bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 rounded-t-md -mx-4 -mt-3 px-3 py-2 mb-1.5 shadow-xl border-b-2 border-blue-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">📋</span>
                        <h3 className="font-extrabold text-base text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{group.osNumber}</h3>
                      </div>
                      {group.isCritical && (
                        <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-400 px-2 py-0.5 rounded-md shadow-lg border-2 border-yellow-500">
                          <span className="text-sm">⚠️</span>
                          <span className="text-[10px] font-black text-gray-900">CRÍTICO</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Card de Localização - COMPACTO */}
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-200 rounded-md px-1.5 py-1 mb-1.5 shadow-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-xs flex-shrink-0">📍</span>
                      <p className="text-[9px] font-medium text-gray-700 leading-tight">
                        {group.location.substring(0, 45)}{group.location.length > 45 ? '...' : ''}
                      </p>
                    </div>
                    
                    {/* Badges Informativos - COMPACTO */}
                    {(hasMultipleDates || totalActivities > 1) && (
                      <div className="flex gap-1 mt-1 pt-1 border-t border-blue-200">
                        {hasMultipleDates && (
                          <div className="flex items-center gap-0.5 bg-white px-1 py-0.5 rounded shadow-sm border border-purple-200">
                            <span className="text-[10px]">📅</span>
                            <span className="text-[9px] font-bold text-purple-700">{group.dateGroups.length}</span>
                          </div>
                        )}
                        {totalActivities > 1 && (
                          <div className="flex items-center gap-0.5 bg-white px-1 py-0.5 rounded shadow-sm border border-blue-200">
                            <span className="text-[10px]">👥</span>
                            <span className="text-[9px] font-bold text-blue-700">{totalActivities}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Blocos por Data - COM SCROLL - COMPACTO */}
                  <div style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'hidden' }} className="space-y-1 pr-0.5">
                    {group.dateGroups.map((dateGroup, dgIndex) => {
                      const isSameDay = dateGroup.activities.length > 1;
                      const totalValue = dateGroup.activities.reduce((sum, act) => sum + act.value, 0);
                      
                      return (
                        <div key={dgIndex} className="bg-white border border-gray-200 rounded-md p-1.5 shadow-sm hover:shadow-md transition-shadow">
                          {/* Data Header Moderno - COMPACTO */}
                          {dateGroup.date && (
                            <div className="flex items-center justify-between mb-1 pb-0.5 border-b border-gray-100">
                              <div className="flex items-center gap-0.5">
                                <span className="text-xs">📅</span>
                                <span className="font-bold text-[10px] text-gray-800">
                                  {new Date(dateGroup.date).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              {isSameDay && (
                                <div className="flex items-center gap-0.5 bg-blue-50 px-1 py-0.5 rounded-full">
                                  <span className="text-[9px]">👥</span>
                                  <span className="text-[9px] font-bold text-blue-700">{dateGroup.activities.length}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Se for mesmo dia, mostrar resumo e um botão único - COMPACTO */}
                          {isSameDay ? (
                            <div className="space-y-1">
                              {/* Cards de Informação - COMPACTO */}
                              <div className="grid grid-cols-1 gap-1">
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded p-1 border border-blue-200">
                                  <div className="flex items-center gap-0.5 mb-0.5">
                                    <span className="text-[10px]">👷</span>
                                    <span className="text-[9px] font-semibold text-gray-700">Equipes</span>
                                  </div>
                                  <p className="text-[9px] text-gray-900 font-medium leading-tight">
                                    {dateGroup.activities.map(a => a.team).join(', ')}
                                  </p>
                                </div>
                                
                                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded p-1 border border-emerald-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-[10px]">💰</span>
                                      <span className="text-[9px] font-semibold text-gray-700">Valor</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-700">
                                      R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Botão Moderno - COMPACTO */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closeAllPopups();
                                  setTimeout(() => {
                                    onActivityClick?.(dateGroup.activities[0]);
                                  }, 100);
                                }}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-2 py-1 rounded text-[9px] font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-1 group"
                              >
                                <span className="text-[10px] group-hover:scale-110 transition-transform">📋</span>
                                <span>Ver Detalhes</span>
                              </button>
                            </div>
                          ) : (
                            // Se for apenas 1 equipe, mostrar individual - COMPACTO
                            dateGroup.activities.map((activity, actIndex) => (
                              <div key={actIndex} className={actIndex > 0 ? 'mt-1.5 pt-1.5 border-t border-gray-100' : ''}>
                                {/* Header da Equipe Individual - COMPACTO */}
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-[10px]">👷</span>
                                    <span className="font-bold text-[10px] text-blue-700">{activity.team}</span>
                                  </div>
                                  <span className={`px-1 py-0.5 rounded text-[9px] font-bold shadow-sm ${
                                    activity.status === 'EXEC' ? 'bg-gradient-to-br from-green-100 to-emerald-100 text-green-800 border border-green-300' :
                                    activity.status === 'CANC' ? 'bg-gradient-to-br from-red-100 to-rose-100 text-red-800 border border-red-300' :
                                    activity.status === 'PARP' ? 'bg-gradient-to-br from-yellow-100 to-amber-100 text-yellow-800 border border-yellow-300' :
                                    activity.status === 'PANP' ? 'bg-gradient-to-br from-orange-100 to-orange-100 text-orange-800 border border-orange-300' :
                                    'bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-800 border border-blue-300'
                                  }`}>
                                    {getStatusLabel(activity.status)}
                                  </span>
                                </div>
                                
                                {/* Valor com Card - COMPACTO */}
                                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded p-1 mb-1 border border-emerald-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-[10px]">💰</span>
                                      <span className="text-[9px] font-semibold text-gray-700">Valor</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-700">
                                      R$ {activity.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Botão Individual Moderno - COMPACTO */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeAllPopups();
                                    setTimeout(() => {
                                      onActivityClick?.(activity);
                                    }, 100);
                                  }}
                                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-2 py-1 rounded text-[9px] font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-1 group"
                                >
                                  <span className="text-[10px] group-hover:scale-110 transition-transform">📋</span>
                                  <span>Ver Detalhes</span>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      )}
    </div>
  );
}
