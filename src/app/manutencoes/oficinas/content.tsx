"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { CurrencyDollarIcon, ClockIcon, ChartBarIcon, BuildingOfficeIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";

export function OficinasContent() {
  const router = useRouter();
  const { userContratoIds } = useAuth();
  type Oficina = { 
    id: string; 
    nome: string; 
    endereco: string; 
    telefone: string; 
    cidade?: string; 
    estado?: string; 
    ativo: boolean;
    especialidades?: string[];
    contrato_id?: string;
    base_id?: string;
    contrato?: { id: string; nome: string; codigo: string };
    base?: { id: string; nome: string; codigo: string };
  };
  type Maintenance = { id: string; oficina_id?: string; criado_em?: string; em_manutencao_em?: string; retornado_em?: string; cancelado_em?: string; custo_real?: number; custo_estimado?: number; };
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Buscar todas as oficinas
      const { data: oficinasData } = await supabase
        .from("oficinas")
        .select(`
          *,
          contrato:contratos(id, nome, codigo),
          base:bases(id, nome, codigo)
        `)
        .order("nome");
      
      // Filtrar oficinas pelos contratos do usuário
      let oficinasFiltradas = oficinasData || [];
      if (userContratoIds && userContratoIds.length > 0) {
        oficinasFiltradas = oficinasData?.filter(oficina => 
          oficina.contrato_id && userContratoIds.includes(oficina.contrato_id)
        ) || [];
      }
      
      const { data: maintData } = await supabase.from("maintenances").select("*");
      setOficinas(oficinasFiltradas);
      setMaintenances(maintData || []);
      setLoading(false);
    };
    fetchData();
  }, [userContratoIds]);

  // Filtros e busca
  const filtered = useMemo(() => oficinas.filter(of =>
    of.nome.toLowerCase().includes(search.toLowerCase()) ||
    (of.cidade || "").toLowerCase().includes(search.toLowerCase()) ||
    (of.estado || "").toLowerCase().includes(search.toLowerCase())
  ), [oficinas, search]);

  // Cálculos dos cards de resumo
  const totalGasto = useMemo(() => maintenances.reduce((acc, m) => acc + (m.custo_real || m.custo_estimado || 0), 0), [maintenances]);
  const last30 = useMemo(() => {
    const now = new Date();
    return maintenances.filter(m => m.criado_em && (new Date(m.criado_em) > new Date(now.getTime() - 30*24*60*60*1000)));
  }, [maintenances]);
  const gastoPeriodo = useMemo(() => last30.reduce((acc, m) => acc + (m.custo_real || m.custo_estimado || 0), 0), [last30]);
  const gastoMedio = useMemo(() => (oficinas.length ? totalGasto / oficinas.length : 0), [totalGasto, oficinas.length]);
  // Tempo médio de veículos em oficina
  const tempoMedio = useMemo(() => {
    const tempos: number[] = maintenances
      .filter(m => m.oficina_id && m.em_manutencao_em && (m.retornado_em || m.cancelado_em))
      .map(m => {
        if (!m.em_manutencao_em) return 0;
        const endDate = m.retornado_em || m.cancelado_em;
        if (!endDate) return 0;
        const start = new Date(m.em_manutencao_em).getTime();
        const end = new Date(endDate).getTime();
        return (end - start) / (1000 * 60 * 60 * 24); // dias
      });
    if (!tempos.length) return 0;
    return tempos.reduce((a, b) => a + b, 0) / tempos.length;
  }, [maintenances]);

  return (
    <main>
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <h1 className="text-3xl font-extrabold text-blue-900 flex items-center gap-2">
            <BuildingOfficeIcon className="h-8 w-8 text-blue-700" /> Oficinas
          </h1>
          <button
            onClick={() => router.push("/manutencoes/oficinas/create")}
            className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-semibold shadow"
          >
            Nova Oficina
          </button>
        </div>
        {/* Cards de resumo */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-4 bg-blue-50 border rounded-xl p-5 border-blue-100">
            <CurrencyDollarIcon className="h-8 w-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-700">R$ {totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="text-sm text-blue-800 font-medium">Gasto Total</div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-green-50 border rounded-xl p-5 border-green-100">
            <ChartBarIcon className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-700">R$ {gastoPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="text-sm text-green-800 font-medium">Gasto Últimos 30 dias</div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-yellow-50 border rounded-xl p-5 border-yellow-100">
            <CurrencyDollarIcon className="h-8 w-8 text-yellow-600" />
            <div>
              <div className="text-2xl font-bold text-yellow-700">R$ {gastoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="text-sm text-yellow-800 font-medium">Gasto Médio/Oficina</div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-purple-50 border rounded-xl p-5 border-purple-100">
            <ClockIcon className="h-8 w-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-700">{tempoMedio.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias</div>
              <div className="text-sm text-purple-800 font-medium">Tempo Médio em Oficina</div>
            </div>
          </div>
        </div>
        {/* Busca */}
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-4">
          <Input
            placeholder="Buscar por nome, cidade ou estado..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {/* Tabela de oficinas */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          {loading ? (
            <div className="text-center text-gray-500 py-10">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-10">Nenhuma oficina encontrada.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Especialidades</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Contrato</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Base</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Endereço</th>
                         <th className="px-4 py-3 text-left font-semibold text-gray-700">Telefone</th>
                         <th className="px-4 py-3 text-left font-semibold text-gray-700">Cidade</th>
                         <th className="px-4 py-3 text-left font-semibold text-gray-700">Estado</th>
                         <th className="px-4 py-3 text-left font-semibold text-gray-700">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(of => (
                  <tr key={of.id} className="border-b hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-blue-900">{of.nome}</td>
                    <td className="px-4 py-3">
                      {of.especialidades && of.especialidades.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {of.especialidades.slice(0, 2).map((especialidade, index) => (
                            <span key={index} className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {especialidade}
                            </span>
                          ))}
                          {of.especialidades.length > 2 && (
                            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              +{of.especialidades.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {of.contrato ? (
                        <div>
                          <div className="font-medium">{of.contrato.nome}</div>
                          <div className="text-xs text-gray-500">({of.contrato.codigo})</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {of.base ? (
                        <div>
                          <div className="font-medium">{of.base.nome}</div>
                          <div className="text-xs text-gray-500">({of.base.codigo})</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{of.endereco}</td>
                           <td className="px-4 py-3">{of.telefone}</td>
                           <td className="px-4 py-3">{of.cidade || "-"}</td>
                           <td className="px-4 py-3">{of.estado || "-"}</td>
                           <td className="px-4 py-3">
                             <span className={of.ativo ? "inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs" : "inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs"}>
                               {of.ativo ? "Sim" : "Não"}
                             </span>
                           </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
} 