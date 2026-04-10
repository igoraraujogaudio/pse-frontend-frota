'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
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

interface MiniMapProps {
  latitude: number;
  longitude: number;
  enabled: boolean;
}

// Criar ícone customizado para dispositivos
const createDeviceIcon = (enabled: boolean) => {
  const color = enabled ? '#22c55e' : '#ef4444';
  
  return L.divIcon({
    html: `
      <div style="
        background: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
      ">
        📱
      </div>
    `,
    className: 'custom-device-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Componente para centralizar no dispositivo
function MapCenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], 15);
  }, [latitude, longitude, map]);

  return null;
}

export default function MiniMap({ latitude, longitude, enabled }: MiniMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-xs text-gray-500">Carregando mapa...</p>
      </div>
    );
  }

  const icon = createDeviceIcon(enabled);

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={15}
      style={{ height: '200px', width: '100%', borderRadius: '8px' }}
      scrollWheelZoom={false}
      zoomControl={true}
      dragging={true}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapCenter latitude={latitude} longitude={longitude} />
      <Marker
        position={[latitude, longitude]}
        icon={icon}
      >
      </Marker>
    </MapContainer>
  );
}

