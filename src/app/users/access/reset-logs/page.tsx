"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';

type Log = {
  reset_at: string;
  reason?: string;
  user?: { name?: string; email?: string };
  admin?: { name?: string; email?: string };
};

function exportToCSV(logs: Log[]) {
  const header = ['Data/Hora', 'Usuário', 'Email Usuário', 'Admin', 'Email Admin', 'Motivo'];
  const rows = logs.map(log => [
    new Date(log.reset_at).toLocaleString('pt-BR'),
    log.user?.name || '',
    log.user?.email || '',
    log.admin?.name || '',
    log.admin?.email || '',
    log.reason || ''
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'logs_reset_senha.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function PasswordResetLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      setError('');
      const { data, error } = await supabase
        .from('password_reset_logs')
        .select('reset_at, reason, user:user_id(name,email), admin:admin_id(name,email)')
        .order('reset_at', { ascending: false });
      if (error) setError('Erro ao carregar logs.');
      setLogs((data || []).map((log: Log | (Log & { user: { name?: string; email?: string }[]; admin: { name?: string; email?: string }[] })) => ({
        ...log,
        user: Array.isArray(log.user) ? log.user[0] : log.user,
        admin: Array.isArray(log.admin) ? log.admin[0] : log.admin,
      })));
      setLoading(false);
    }
    fetchLogs();
  }, []);

  // Filtros aplicados em memória (pode ser feito no SQL se preferir)
  const filteredLogs = logs.filter((log: Log) => {
    const logDate = new Date(log.reset_at);
    const matchUser = !userFilter || (log.user?.name?.toLowerCase().includes(userFilter.toLowerCase()) || log.user?.email?.toLowerCase().includes(userFilter.toLowerCase()));
    const matchAdmin = !adminFilter || (log.admin?.name?.toLowerCase().includes(adminFilter.toLowerCase()) || log.admin?.email?.toLowerCase().includes(adminFilter.toLowerCase()));
    const matchSearch = !search || (log.reason?.toLowerCase().includes(search.toLowerCase()) || log.user?.name?.toLowerCase().includes(search.toLowerCase()) || log.admin?.name?.toLowerCase().includes(search.toLowerCase()));
    const matchStart = !dateStart || logDate >= new Date(dateStart);
    const matchEnd = !dateEnd || logDate <= new Date(dateEnd + 'T23:59:59');
    return matchUser && matchAdmin && matchSearch && matchStart && matchEnd;
  });

  return (
    <ProtectedRoute requiredAccessLevel={["admin"]}>
      <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Logs de Reset de Senha</h1>
        <div className="mb-4 flex flex-wrap gap-2 items-end">
          <input placeholder="Buscar motivo, usuário, admin..." className="px-2 py-1 border rounded" value={search} onChange={e => setSearch(e.target.value)} />
          <input placeholder="Filtrar por usuário" className="px-2 py-1 border rounded" value={userFilter} onChange={e => setUserFilter(e.target.value)} />
          <input placeholder="Filtrar por admin" className="px-2 py-1 border rounded" value={adminFilter} onChange={e => setAdminFilter(e.target.value)} />
          <input type="date" className="px-2 py-1 border rounded" value={dateStart} onChange={e => setDateStart(e.target.value)} />
          <input type="date" className="px-2 py-1 border rounded" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => exportToCSV(filteredLogs)}>Exportar CSV</button>
          <span className="ml-auto text-sm text-gray-600">{filteredLogs.length} registro(s)</span>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
        {loading ? (
          <div className="text-gray-500">Carregando logs...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log: Log, idx: number) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(log.reset_at).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.user?.name} <span className="text-xs text-gray-500">({log.user?.email})</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.admin?.name} <span className="text-xs text-gray-500">({log.admin?.email})</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{log.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLogs.length === 0 && <div className="p-6 text-gray-500">Nenhum log encontrado.</div>}
          </div>
        )}
      </div>
    </main>
    </ProtectedRoute>
  );
} 