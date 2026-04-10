'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, Package, AlertCircle, CheckCircle, XCircle, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface SaidaMaterial {
  id: string;
  created_at: string;
  status: 'entregue' | 'conferida_portaria' | 'bloqueada_portaria' | 'cancelada';
  observacoes?: string;
  observacoes_portaria?: string;
  veiculo_placa?: string;
  base_origem?: string;
  base?: {
    nome: string;
    codigo: string;
  };
  conferido_portaria_em?: string;
  equipe: {
    nome: string;
  };
  responsavel: {
    nome: string;
  };
  entregador: {
    nome: string;
  };
  conferente?: {
    nome: string;
  };
  itens: SaidaMaterialItem[];
}

interface SaidaMaterialItem {
  id: string;
  quantidade: number;
  unidade_medida: string;
  conferido_portaria?: boolean;
  observacoes_conferencia?: string;
  tipo_divergencia?: 'a_menos' | 'a_mais';
  quantidade_divergencia?: number;
  material: {
    numero_material: string;
    descricao_material: string;
  };
}

export default function SaidasMateriaisPage() {
  const router = useRouter();
  const { hasPermission } = useModularPermissions();
  const [saidas, setSaidas] = useState<SaidaMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSaida, setSelectedSaida] = useState<SaidaMaterial | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (hasPermission(PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_TODAS_SAIDAS)) {
      loadSaidas();
    }
  }, [hasPermission]);

  const loadSaidas = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('saida_materiais')
        .select(`
          id,
          created_at,
          status,
          observacoes,
          observacoes_portaria,
          veiculo_placa,
          base_origem,
          base:bases!base_origem(nome, codigo),
          conferido_portaria_em,
          equipe:equipes(nome),
          responsavel:usuarios!saida_materiais_responsavel_id_fkey(nome),
          entregador:usuarios!saida_materiais_entregue_por_fkey(nome),
          conferente:usuarios!saida_materiais_conferido_portaria_por_fkey(nome),
          itens:saida_materiais_itens(
            id,
            quantidade,
            unidade_medida,
            conferido_portaria,
            observacoes_conferencia,
            tipo_divergencia,
            quantidade_divergencia,
            material:lista_materiais(
              numero_material,
              descricao_material
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSaidas((data as unknown as SaidaMaterial[]) || []);
    } catch (error) {
      console.error('Erro ao carregar saídas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; label: string; icon: React.ComponentType<{ className?: string }>; className?: string }> = {
      entregue: { variant: 'default', label: 'Entregue', icon: Package },
      conferida_portaria: { variant: 'default', label: 'Conferida', icon: CheckCircle, className: 'bg-green-500 text-white border-green-500' },
      bloqueada_portaria: { variant: 'destructive', label: 'Bloqueada', icon: XCircle },
      cancelada: { variant: 'secondary', label: 'Cancelada', icon: AlertCircle },
    };

    const config = variants[status] || variants.entregue;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={cn("flex items-center gap-1", config.className)}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredSaidas = saidas.filter((saida) => {
    const matchesSearch =
      saida.equipe.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      saida.responsavel.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      saida.veiculo_placa?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || saida.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const viewDetails = (saida: SaidaMaterial) => {
    setSelectedSaida(saida);
    setDetailsOpen(true);
  };

  if (!hasPermission(PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_TODAS_SAIDAS)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Acesso Negado
            </CardTitle>
            <CardDescription>
              Você não tem permissão para visualizar as saídas de materiais.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-6 h-6" />
                Saídas de Materiais
              </CardTitle>
              <CardDescription>
                Visualize e gerencie todas as saídas de materiais do almoxarifado
              </CardDescription>
            </div>
            <Button 
              onClick={() => router.push('/almoxarifado/saida-materiais')}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Saída
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por equipe, responsável ou placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="conferida_portaria">Conferida</SelectItem>
                <SelectItem value="bloqueada_portaria">Bloqueada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadSaidas} variant="outline">
              Atualizar
            </Button>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Base Origem</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSaidas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhuma saída encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSaidas.map((saida) => (
                    <TableRow key={saida.id}>
                      <TableCell>
                        {new Date(saida.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{saida.equipe.nome}</TableCell>
                      <TableCell>{saida.responsavel.nome}</TableCell>
                      <TableCell>{saida.veiculo_placa || '-'}</TableCell>
                      <TableCell>{saida.base?.nome || '-'}</TableCell>
                      <TableCell>{saida.itens.length} itens</TableCell>
                      <TableCell>{getStatusBadge(saida.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewDetails(saida)}
                        >
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Saída</DialogTitle>
            <DialogDescription>
              Informações completas sobre a saída de materiais
            </DialogDescription>
          </DialogHeader>

          {selectedSaida && (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Equipe</p>
                  <p className="text-base">{selectedSaida.equipe.nome}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Responsável</p>
                  <p className="text-base">{selectedSaida.responsavel.nome}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entregue por</p>
                  <p className="text-base">{selectedSaida.entregador.nome}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Veículo</p>
                  <p className="text-base">{selectedSaida.veiculo_placa || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Base de Origem</p>
                  <p className="text-base">{selectedSaida.base?.nome || 'Não informada'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedSaida.status)}</div>
                </div>
                {selectedSaida.conferente && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Conferido por</p>
                    <p className="text-base">{selectedSaida.conferente.nome}</p>
                  </div>
                )}
              </div>

              {/* Observações */}
              {selectedSaida.observacoes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedSaida.observacoes}</p>
                </div>
              )}

              {selectedSaida.observacoes_portaria && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Observações da Portaria
                  </p>
                  <p className="text-sm bg-destructive/10 p-3 rounded-md">
                    {selectedSaida.observacoes_portaria}
                  </p>
                </div>
              )}

              {/* Itens */}
              <div>
                <p className="text-sm font-medium mb-3">Itens da Saída</p>
                <div className="space-y-2">
                  {selectedSaida.itens.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.material.descricao_material}</p>
                          <p className="text-sm text-muted-foreground">
                            Código: {item.material.numero_material}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {item.quantidade} {item.unidade_medida}
                          </p>
                          {item.conferido_portaria !== undefined && (
                            <Badge 
                              variant={item.conferido_portaria ? 'default' : 'destructive'}
                              className={item.conferido_portaria ? 'bg-green-500 text-white border-green-500' : ''}
                            >
                              {item.conferido_portaria ? 'OK' : 'Divergência'}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Divergência */}
                      {item.tipo_divergencia && item.quantidade_divergencia && (
                        <div className="bg-destructive/10 p-2 rounded text-sm">
                          <p className="font-medium text-destructive">
                            {item.tipo_divergencia === 'a_menos' ? '⚠️ A MENOS' : '⚠️ A MAIS'}:{' '}
                            {item.quantidade_divergencia} {item.unidade_medida}
                          </p>
                        </div>
                      )}

                      {item.observacoes_conferencia && (
                        <p className="text-sm text-muted-foreground">
                          Obs: {item.observacoes_conferencia}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
