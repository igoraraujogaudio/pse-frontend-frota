'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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

interface Location {
  deviceId: number;
  alias: string;
  enabled: boolean;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  accuracy?: number;
  speed?: number;
  bearing?: number;
  deviceDate?: {
    date: string;
  };
  modelo?: string;
  imei?: string;
}

interface LeafletMapProps {
  locations: Location[];
  focusDeviceId?: number | null;
  onFocusComplete?: () => void;
}

// Criar ícone customizado para dispositivos
const createDeviceIcon = (enabled: boolean) => {
  const color = enabled ? '#22c55e' : '#ef4444';
  
  return L.divIcon({
    html: `
      <div style="
        background: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
      ">
        📱
      </div>
    `,
    className: 'custom-device-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// Componente para centralizar o mapa quando as localizações mudarem
function MapBounds({ locations, focusDeviceId, onFocusComplete }: { locations: Location[]; focusDeviceId?: number | null; onFocusComplete?: () => void }) {
  const map = useMap();
  const lastFocusedRef = useRef<number | null>(null);
  const hasInitializedRef = useRef(false);
  const isFocusingRef = useRef(false);
  const fitBoundsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Limpar timeout anterior se existir
    if (fitBoundsTimeoutRef.current) {
      clearTimeout(fitBoundsTimeoutRef.current);
      fitBoundsTimeoutRef.current = null;
    }

    // Se há um dispositivo para focar, fazer isso com prioridade
    if (focusDeviceId && focusDeviceId !== lastFocusedRef.current) {
      const location = locations.find(l => l.deviceId === focusDeviceId);
      if (location) {
        lastFocusedRef.current = focusDeviceId;
        isFocusingRef.current = true;
        
        // Cancelar qualquer fitBounds pendente
        if (fitBoundsTimeoutRef.current) {
          clearTimeout(fitBoundsTimeoutRef.current);
          fitBoundsTimeoutRef.current = null;
        }
        
        map.setView([location.coordinate.latitude, location.coordinate.longitude], 16, {
          animate: true
        });
        
        // Abrir popup do marcador após animação
        setTimeout(() => {
          map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
              const marker = layer as L.Marker;
              const pos = marker.getLatLng();
              if (
                Math.abs(pos.lat - location.coordinate.latitude) < 0.0001 &&
                Math.abs(pos.lng - location.coordinate.longitude) < 0.0001
              ) {
                marker.openPopup();
              }
            }
          });
          
          isFocusingRef.current = false;
          onFocusComplete?.();
        }, 600);
        return;
      }
    }
    
    // Se o foco foi removido (focusDeviceId === null mas havia um foco antes)
    if (focusDeviceId === null && lastFocusedRef.current !== null && !isFocusingRef.current) {
      lastFocusedRef.current = null;
      // Não fazer fitBounds automaticamente - deixar o usuário controlar a visualização
      return;
    }
    
    // FitBounds inicial apenas uma vez quando não há foco
    if (locations.length > 0 && !focusDeviceId && !hasInitializedRef.current && !isFocusingRef.current) {
      fitBoundsTimeoutRef.current = setTimeout(() => {
        if (!focusDeviceId && !isFocusingRef.current && locations.length > 0) {
          const bounds = L.latLngBounds(
            locations.map(loc => [loc.coordinate.latitude, loc.coordinate.longitude])
          );
          map.fitBounds(bounds, { padding: [50, 50] });
          hasInitializedRef.current = true;
        }
      }, 500);
    }
    
    // Cleanup
    return () => {
      if (fitBoundsTimeoutRef.current) {
        clearTimeout(fitBoundsTimeoutRef.current);
      }
    };
  }, [locations, map, focusDeviceId, onFocusComplete]);

  return null;
}

export default function LeafletMap({ locations, focusDeviceId, onFocusComplete }: LeafletMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // Garantir que o componente está montado no cliente
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  // Centro padrão: São Paulo
  const defaultCenter: [number, number] = [-23.5505, -46.6333];

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🗺️</div>
          <p className="text-gray-600">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={defaultCenter}
      zoom={10}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      doubleClickZoom={true}
      touchZoom={true}
      dragging={true}
      zoomControl={true}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={mapRef as any}
      whenReady={handleMapReady}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {mapReady && <MapBounds locations={locations} focusDeviceId={focusDeviceId} onFocusComplete={onFocusComplete} />}

      {locations.map((location) => {
        const icon = createDeviceIcon(location.enabled);
        
        const dateStr = location.deviceDate?.date
          ? new Date(location.deviceDate.date).toLocaleString('pt-BR')
          : 'N/A';

        return (
          <Marker
            key={location.deviceId}
            position={[location.coordinate.latitude, location.coordinate.longitude]}
            icon={icon}
          >
            <Popup>
              <div className="p-2 min-w-[250px]">
                <h3 className="font-bold text-lg mb-2">{location.alias}</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">ID:</span> {location.deviceId}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    <span className={location.enabled ? 'text-green-600' : 'text-red-600'}>
                      {location.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {location.modelo && (
                    <div>
                      <span className="font-medium">Modelo:</span> {location.modelo}
                    </div>
                  )}
                  {location.imei && (
                    <div>
                      <span className="font-medium">IMEI:</span> {location.imei}
                    </div>
                  )}
                  {location.accuracy !== undefined && (
                    <div>
                      <span className="font-medium">Precisão:</span> {location.accuracy.toFixed(1)}m
                    </div>
                  )}
                  {location.speed !== undefined && (
                    <div>
                      <span className="font-medium">Velocidade:</span> {location.speed || 0} km/h
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Lat:</span> {location.coordinate.latitude.toFixed(6)}
                      </div>
                      <div>
                        <span className="font-medium">Lng:</span> {location.coordinate.longitude.toFixed(6)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                    <span className="font-medium">Data:</span> {dateStr}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

