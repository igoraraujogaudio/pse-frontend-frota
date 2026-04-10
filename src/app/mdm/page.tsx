'use client';

import { useState, useEffect } from 'react';
import { MapPin, Phone, Activity, Search, RefreshCw, Settings, List, Map, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import dynamic from 'next/dynamic';

// Importar Leaflet apenas no cliente
const LeafletMap = dynamic(() => import('@/components/mdm/LeafletMap'), { ssr: false });
const MiniMap = dynamic(() => import('@/components/mdm/MiniMap'), { ssr: false });

interface Device {
  id: number;
  alias: string;
  enabled: boolean;
  lastCommunication?: string;
  hardwareId?: string;
  deviceInformation?: {
    model?: string;
    manufacturer?: string;
    version?: string;
    imei?: string;
  };
}

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

interface Environment {
  name: string;
  totalEnabledDevices: number;
  maxAllowedDevices: number;
}


function MDMPageContent() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingLocationsProgress, setLoadingLocationsProgress] = useState({ current: 0, total: 0 });
  const [deviceDetails, setDeviceDetails] = useState<Device & {
    deviceInformation?: {
      model?: string;
      manufacturer?: string;
      version?: string;
      imei?: string;
    };
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [focusDeviceId, setFocusDeviceId] = useState<number | null>(null);

  const fetchWithAuth = async (path: string) => {
    // Fazer requisição através de API route para autenticação
    const response = await fetch(`/api/mdm?path=${encodeURIComponent(path)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  const loadDevices = async () => {
    try {
      setLoading(true);
      
      // Buscar todos os dispositivos com paginação
      let allDevices: Device[] = [];
      const pageSize = 100; // Tamanho da página padrão da API
      let page = 0;
      let paginationFormat: 'limit-offset' | 'page-size' | 'none' | null = null;
      let hasMore = true;
      
      while (hasMore) {
        const path = '/devices';
        let pageData: Device[] = [];
        let success = false;
        
        // Primeira página: buscar sem parâmetros
        if (page === 0) {
          try {
            const data = await fetchWithAuth(path);
            if (Array.isArray(data)) {
              pageData = data;
            } else {
              pageData = data.items || data.data || data.devices || [];
            }
            success = true;
          } catch (error) {
            console.error('Erro ao buscar dispositivos:', error);
            hasMore = false;
            break;
          }
        } else {
          // Páginas subsequentes: tentar diferentes formatos
          const formats = [
            { type: 'limit-offset' as const, path: `/devices?limit=${pageSize}&offset=${page * pageSize}` },
            { type: 'page-size' as const, path: `/devices?page=${page + 1}&size=${pageSize}` },
            { type: 'limit-offset' as const, path: `/devices?limit=${pageSize}&skip=${page * pageSize}` },
          ];
          
          let triedFormat = false;
          for (const format of formats) {
            // Se já determinamos um formato, usar apenas ele
            if (paginationFormat && paginationFormat !== format.type) {
              continue;
            }
            
            try {
              const data = await fetchWithAuth(format.path);
              if (Array.isArray(data)) {
                pageData = data;
              } else {
                pageData = data.items || data.data || data.devices || [];
              }
              
              if (pageData.length > 0) {
                paginationFormat = format.type;
                success = true;
                triedFormat = true;
                break;
              }
            } catch {
              // Continuar tentando outros formatos
              continue;
            }
          }
          
          if (!triedFormat) {
            // Se nenhum formato funcionou, não há mais páginas
            hasMore = false;
            break;
          }
        }
        
        if (success && pageData.length > 0) {
          allDevices = [...allDevices, ...pageData];
          
          // Se retornou menos que o tamanho da página, não há mais páginas
          if (pageData.length < pageSize) {
            hasMore = false;
          } else {
            // Se retornou exatamente o tamanho da página, pode haver mais
            page++;
            // Limite de segurança: não buscar mais de 500 dispositivos de uma vez
            if (page * pageSize >= 500) {
              console.warn('Limite de segurança atingido (500 dispositivos)');
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
        }
      }
      
      setDevices(allDevices);
      console.log(`✅ ${allDevices.length} dispositivos carregados`);
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEnvironment = async () => {
    try {
      const data = await fetchWithAuth('/environment');
      setEnvironment(data);
    } catch (error) {
      console.error('Erro ao carregar ambiente:', error);
    }
  };

  const loadLocations = async () => {
    if (devices.length === 0) return;
    
    try {
      setLoadingLocations(true);
      setLoadingLocationsProgress({ current: 0, total: devices.length });
      setLocations([]); // Limpar localizações anteriores
      
      // Dividir em batches para processar no servidor (muito mais rápido!)
      // Podemos processar até todos de uma vez (100+), já que as requisições são paralelas
      const BATCH_SIZE = 100;
      const deviceIds = devices.map(d => d.id);
      const batches: number[][] = [];
      
      for (let i = 0; i < deviceIds.length; i += BATCH_SIZE) {
        batches.push(deviceIds.slice(i, i + BATCH_SIZE));
      }
      
      // Processar batches em paralelo
      const batchPromises = batches.map(async (batch) => {
        try {
          const response = await fetch('/api/mdm/batch-locations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ deviceIds: batch })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const batchResults = await response.json();
          
          // Processar resultados do batch
          const locationsData: Location[] = [];
          batch.forEach(deviceId => {
            const device = devices.find(d => d.id === deviceId);
            const location = batchResults[deviceId.toString()];
            
            if (device && location && location.coordinate) {
              locationsData.push({
                deviceId: device.id,
                alias: device.alias,
                enabled: device.enabled,
                coordinate: location.coordinate,
                accuracy: location.accuracy,
                speed: location.speed,
                bearing: location.bearing,
                deviceDate: location.deviceDate,
                modelo: device.deviceInformation?.model,
                imei: device.deviceInformation?.imei
              });
              
              // Atualizar progresso
              setLoadingLocationsProgress(prev => ({
                ...prev,
                current: Math.min(prev.current + 1, prev.total)
              }));
            } else {
              // Dispositivo sem localização
              setLoadingLocationsProgress(prev => ({
                ...prev,
                current: Math.min(prev.current + 1, prev.total)
              }));
            }
          });
          
          // Adicionar todas as localizações do batch ao estado de uma vez
          setLocations(prev => {
            const newLocations = [...prev];
            locationsData.forEach(loc => {
              if (!newLocations.find(l => l.deviceId === loc.deviceId)) {
                newLocations.push(loc);
              }
            });
            return newLocations;
          });
          
          return locationsData;
        } catch (error) {
          console.error('Erro ao carregar batch de localizações:', error);
          // Marcar todos do batch como processados
          batch.forEach(() => {
            setLoadingLocationsProgress(prev => ({
              ...prev,
              current: Math.min(prev.current + 1, prev.total)
            }));
          });
          return [];
        }
      });
      
      // Aguardar todos os batches
      await Promise.allSettled(batchPromises);
      
      setLoadingLocationsProgress({ current: devices.length, total: devices.length });
    } catch (error) {
      console.error('Erro ao carregar localizações:', error);
    } finally {
      setLoadingLocations(false);
      setTimeout(() => {
        setLoadingLocationsProgress({ current: 0, total: 0 });
      }, 500);
    }
  };

  const reloadAll = async () => {
    await loadDevices();
    await loadEnvironment();
    if (devices.length > 0) {
      await loadLocations();
    }
  };

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (devices.length > 0 && locations.length === 0) {
      loadLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices.length]);

  const loadDeviceDetails = async (deviceId: number) => {
    try {
      setLoadingDetails(true);
      const data = await fetchWithAuth(`/devices/${deviceId}`);
      setDeviceDetails(data);
      setSelectedDevice(devices.find(d => d.id === deviceId) || null);
    } catch (error) {
      console.error('Erro ao carregar detalhes do dispositivo:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleFocusDevice = (deviceId: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setFocusDeviceId(deviceId);
    setActiveTab('map');
  };

  const handleTabChange = (tab: 'map' | 'list') => {
    setActiveTab(tab);
    // Limpar foco apenas quando mudar para listagem, mantém quando volta para mapa
    // Isso evita que o foco seja perdido ao clicar em "Ver no mapa"
    if (tab === 'list' && focusDeviceId) {
      // Pequeno delay para garantir que o foco não seja perdido acidentalmente
      setTimeout(() => {
        setFocusDeviceId(null);
      }, 100);
    }
  };

  const handleFocusComplete = () => {
    // Não limpar o foco automaticamente - deixar o usuário navegar no mapa
    // O foco só será limpo quando o usuário mudar de aba, buscar outro dispositivo, etc.
  };

  const filteredDevices = devices.filter(device => 
    device.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.hardwareId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.deviceInformation?.imei?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeDevices = devices.filter(d => d.enabled).length;
  const devicesWithLocation = locations.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">MDM - Gestão de Dispositivos</h1>
              <p className="text-gray-600 mt-1">Visualize e gerencie seus dispositivos móveis em tempo real</p>
            </div>
            <Button 
              onClick={reloadAll} 
              disabled={loading || loadingLocations}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${(loading || loadingLocations) ? 'animate-spin' : ''}`} />
              Recarregar
            </Button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Dispositivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-600" />
                <span className="text-3xl font-bold text-gray-900">
                  {loading ? '-' : devices.length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Dispositivos Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                <span className="text-3xl font-bold text-gray-900">
                  {loading ? '-' : activeDevices}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Com Localização</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-purple-600" />
                <span className="text-3xl font-bold text-gray-900">
                  {loadingLocations ? '-' : devicesWithLocation}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Ambiente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-600" />
                <span className="text-lg font-bold text-gray-900 truncate">
                  {loading ? '-' : environment?.name || 'N/A'}
                </span>
              </div>
              {environment && (
                <p className="text-xs text-gray-500 mt-1">
                  {environment.totalEnabledDevices} / {environment.maxAllowedDevices}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs e Conteúdo */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Visualização</CardTitle>
              <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => handleTabChange('map')}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === 'map'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Map className="h-4 w-4" />
                  Mapa
                </button>
                <button
                  onClick={() => handleTabChange('list')}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <List className="h-4 w-4" />
                  Listagem
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Busca */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Buscar dispositivos por nome, IMEI ou hardware ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Conteúdo das Tabs */}
            {activeTab === 'map' ? (
              <div className="h-[600px] relative">
                <div className="relative h-full">
                  {/* Mapa sempre visível */}
                  <LeafletMap 
                    locations={locations} 
                    focusDeviceId={focusDeviceId}
                    onFocusComplete={handleFocusComplete}
                  />
                  
                  {/* Overlay de loading apenas no início */}
                  {loadingLocations && locations.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50/90 z-[1000]">
                      <div className="text-center max-w-sm">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-gray-700 font-medium mb-2">Carregando localizações...</p>
                        {loadingLocationsProgress.total > 0 && (
                          <div className="space-y-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ 
                                  width: `${(loadingLocationsProgress.current / loadingLocationsProgress.total) * 100}%` 
                                }}
                              />
                            </div>
                            <p className="text-sm text-gray-500">
                              {loadingLocationsProgress.current} de {loadingLocationsProgress.total} dispositivos
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Indicador de progresso discreto quando já tem alguns marcadores */}
                  {loadingLocations && locations.length > 0 && (
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg z-[1000] border border-gray-200">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {loadingLocationsProgress.current} / {loadingLocationsProgress.total}
                          </p>
                          <div className="w-32 bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(loadingLocationsProgress.current / loadingLocationsProgress.total) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-gray-600">Carregando dispositivos...</p>
                    </div>
                  </div>
                ) : filteredDevices.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Nenhum dispositivo encontrado.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDevices.map((device) => {
                      const location = locations.find(l => l.deviceId === device.id);
                      return (
                        <Card
                          key={device.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedDevice?.id === device.id ? 'ring-2 ring-blue-500' : ''
                          }`}
                          onClick={() => loadDeviceDetails(device.id)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{device.alias}</CardTitle>
                              <Badge variant={device.enabled ? 'default' : 'secondary'} className="text-xs">
                                {device.enabled ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 pb-3">
                            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
                              <div>
                                <span className="font-medium text-gray-500">ID:</span>
                                <p className="text-gray-900 font-mono truncate">{device.id}</p>
                              </div>
                              {device.hardwareId && (
                                <div>
                                  <span className="font-medium text-gray-500">Hardware ID:</span>
                                  <p className="text-gray-900 font-mono truncate">{device.hardwareId}</p>
                                </div>
                              )}
                              {device.deviceInformation?.imei && (
                                <div>
                                  <span className="font-medium text-gray-500">IMEI:</span>
                                  <p className="text-gray-900 font-mono truncate">{device.deviceInformation.imei}</p>
                                </div>
                              )}
                              {device.deviceInformation?.manufacturer && device.deviceInformation?.model && (
                                <div>
                                  <span className="font-medium text-gray-500">Modelo:</span>
                                  <p className="text-gray-900 truncate">{device.deviceInformation.manufacturer} {device.deviceInformation.model}</p>
                                </div>
                              )}
                              {device.deviceInformation?.version && (
                                <div>
                                  <span className="font-medium text-gray-500">Android:</span>
                                  <p className="text-gray-900">{device.deviceInformation.version}</p>
                                </div>
                              )}
                              {location && (
                                <div className="col-span-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <span className="font-medium text-purple-600">📍 Localização</span>
                                      <p className="text-gray-900 text-xs truncate">
                                        {location.coordinate.latitude.toFixed(4)}, {location.coordinate.longitude.toFixed(4)}
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => handleFocusDevice(device.id, e)}
                                      className="ml-2 h-7 text-xs"
                                    >
                                      <Navigation className="h-3 w-3 mr-1" />
                                      Ver no mapa
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Detalhes do Dispositivo */}
        <Dialog open={selectedDevice !== null} onOpenChange={(open) => !open && setSelectedDevice(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurações do Dispositivo</DialogTitle>
              <DialogDescription>
                Detalhes completos e configurações do dispositivo {selectedDevice?.alias}
              </DialogDescription>
            </DialogHeader>
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-gray-600">Carregando detalhes...</p>
                </div>
              </div>
            ) : deviceDetails ? (
              <div className="space-y-3">
                {/* Informações Básicas */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Informações Básicas</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <span className="text-xs font-medium text-gray-500">ID do Dispositivo</span>
                        <p className="text-sm font-mono">{deviceDetails.id}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500">Nome/Alias</span>
                        <p className="text-sm font-semibold">{deviceDetails.alias}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500">Hardware ID</span>
                        <p className="text-sm font-mono">{deviceDetails.hardwareId || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500">Status</span>
                        <div className="mt-0.5">
                          <Badge variant={deviceDetails.enabled ? 'default' : 'secondary'} className="text-xs">
                            {deviceDetails.enabled ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                      {deviceDetails.lastCommunication && (
                        <div className="col-span-2">
                          <span className="text-xs font-medium text-gray-500">Última Comunicação</span>
                          <p className="text-sm">{deviceDetails.lastCommunication}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Informações do Hardware */}
                {deviceDetails.deviceInformation && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Informações do Hardware</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {deviceDetails.deviceInformation.manufacturer && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Fabricante</span>
                            <p className="text-sm">{deviceDetails.deviceInformation.manufacturer}</p>
                          </div>
                        )}
                        {deviceDetails.deviceInformation.model && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Modelo</span>
                            <p className="text-sm">{deviceDetails.deviceInformation.model}</p>
                          </div>
                        )}
                        {deviceDetails.deviceInformation.version && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Versão Android</span>
                            <p className="text-sm">{deviceDetails.deviceInformation.version}</p>
                          </div>
                        )}
                        {deviceDetails.deviceInformation.imei && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">IMEI</span>
                            <p className="text-sm font-mono">{deviceDetails.deviceInformation.imei}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Localização */}
                {locations.find(l => l.deviceId === selectedDevice?.id) && (() => {
                  const location = locations.find(l => l.deviceId === selectedDevice?.id)!;
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Localização Atual</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                          <div>
                            <span className="text-xs font-medium text-gray-500">Latitude</span>
                            <p className="text-sm font-mono">{location.coordinate.latitude.toFixed(6)}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Longitude</span>
                            <p className="text-sm font-mono">{location.coordinate.longitude.toFixed(6)}</p>
                          </div>
                          {location.accuracy !== undefined && (
                            <div>
                              <span className="text-xs font-medium text-gray-500">Precisão</span>
                              <p className="text-sm">{location.accuracy.toFixed(1)}m</p>
                            </div>
                          )}
                          {location.speed !== undefined && location.speed > 0 && (
                            <div>
                              <span className="text-xs font-medium text-gray-500">Velocidade</span>
                              <p className="text-sm">{location.speed} km/h</p>
                            </div>
                          )}
                          {location.bearing !== undefined && (
                            <div>
                              <span className="text-xs font-medium text-gray-500">Direção</span>
                              <p className="text-sm">{location.bearing}°</p>
                            </div>
                          )}
                          {location.deviceDate && (
                            <div className="col-span-2">
                              <span className="text-xs font-medium text-gray-500">Data/Hora</span>
                              <p className="text-sm">
                                {new Date(location.deviceDate.date).toLocaleString('pt-BR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short'
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                        {/* Mini Mapa */}
                        <div className="mt-3 pt-3 border-t">
                          <MiniMap
                            latitude={location.coordinate.latitude}
                            longitude={location.coordinate.longitude}
                            enabled={selectedDevice?.enabled || false}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum dado disponível.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function MDMPage() {
  return (
    <ProtectedRoute
      requiredPermissions={[
        PERMISSION_CODES.MDM.DASHBOARD_MDM,
        PERMISSION_CODES.MDM.VISUALIZAR_DISPOSITIVOS,
        PERMISSION_CODES.MDM.VISUALIZAR_MAPA
      ]}
    >
      <MDMPageContent />
    </ProtectedRoute>
  );
}

