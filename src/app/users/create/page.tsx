'use client';

import { useState, useEffect, useRef } from 'react';
import { UserPlusIcon, BuildingOfficeIcon, ShieldCheckIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import ProtectedRoute from '@/components/ProtectedRoute';
import { userService } from '@/services/userService';
import { contratoService } from '@/services/contratoService';
import { baseService } from '@/services/baseService';
import { Contrato, Base } from '@/types/contratos';
import { validarCPF, formatarCPF, limparCPF } from '@/utils/cpfUtils';

const accessLevels = [
  { id: 'admin', name: 'Administrador', description: 'Acesso total ao sistema' },
  { id: 'diretor', name: 'Diretor', description: 'Acesso executivo e estratégico' },
  { id: 'manager', name: 'Gerente', description: 'Acesso à gestão de equipes e recursos' },
  { id: 'fleet_manager', name: 'Gestor de Frota', description: 'Acesso à frota e manutenções' },
  { id: 'supervisor', name: 'Supervisor', description: 'Aprovação e acompanhamento operacional' },
  { id: 'portaria', name: 'Portaria', description: 'Controle de acesso e registro' },
  { id: 'almoxarifado', name: 'Almoxarifado', description: 'Gestão de estoque' },
  { id: 'operacao', name: 'Operação', description: 'Execução operacional' },
];

const roles = [
  "Administrador",
  "Gerente",
  "Gestor Frota",
  "Supervisor",
  "Portaria",
  "Almoxarifado",
  "Operação",
];

// Cargos serão carregados dinamicamente da API
// const positions = [
//   "Assistente",
//   "Analista", 
//   "Coordenador",
//   "Gerente",
//   "Diretor",
//   "Supervisor",
//   "Operador",
//   "Motorista",
//   "Mecânico",
//   "Auxiliar",
// ];

// const turnos = [ // TODO: Use when shifts functionality is implemented
//   "A",
//   "B",
//   "C",
// ];

// Novo componente MultiSelectTags para localizações

type MultiSelectTagsProps = {
  options: { id: string; nome: string }[];
  value: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
};

function MultiSelectTags({ options, value, onChange, placeholder = "Selecione..." }: MultiSelectTagsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !(ref.current as HTMLDivElement).contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v: string) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div
        className="w-full min-h-[38px] flex flex-wrap items-center gap-1 px-2 py-1 border border-gray-300 rounded-lg bg-gray-50 cursor-pointer focus-within:ring-2 focus-within:ring-blue-400"
        onClick={() => setOpen((o) => !o)}
        tabIndex={0}
      >
        {value.length === 0 && (
          <span className="text-gray-400 text-sm">{placeholder}</span>
        )}
        {value.map((id: string) => {
          const opt = options.find((o: { id: string; nome: string }) => o.id === id);
          return (
            <span key={id} className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs flex items-center gap-1">
              {opt?.nome}
              <button
                type="button"
                className="ml-1 text-blue-500 hover:text-blue-700 focus:outline-none"
                onClick={e => { e.stopPropagation(); onChange(value.filter((v: string) => v !== id)); }}
                aria-label="Remover"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-48 overflow-auto">
          {options.map((opt: { id: string; nome: string }) => (
            <div
              key={opt.id}
              className={`px-3 py-2 cursor-pointer hover:bg-blue-50 flex items-center gap-2 ${value.includes(opt.id) ? "bg-blue-100" : ""}`}
              onClick={() => handleSelect(opt.id)}
            >
              <input
                type="checkbox"
                checked={value.includes(opt.id)}
                readOnly
                className="accent-blue-500"
              />
              <span>{opt.nome}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreateUserPage() {
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    role: '',
    position: '',
    employeeId: '',
    cpf: '',
    cnh: '',
    validade_cnh: '',
    cnh_categoria: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    accessLevel: '',
    operacao: 'geral', // Campo obrigatório com valor padrão
    contratos: [] as string[], // Mudança: contratos em vez de locations
    bases: [] as string[], // Mudança: bases específicas (opcional)
  });
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [cargos, setCargos] = useState<{ id: string; nome: string; nivel_acesso: string; ativo: boolean }[]>([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cpfError, setCpfError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔍 Carregando contratos, bases e cargos...');
        
        // Usar os mesmos métodos que outras páginas usam
        const [contratosData, basesData, cargosResponse] = await Promise.all([
          contratoService.getContratosAtivos(),
          baseService.getBasesAtivas(),
          fetch('/api/cargos').then(res => res.json())
        ]);
        
        console.log('✅ Contratos carregados:', contratosData);
        console.log('✅ Bases carregadas:', basesData);
        console.log('✅ Cargos carregados:', cargosResponse);
        
        setContratos(contratosData);
        setBases(basesData);
        setCargos(cargosResponse.cargos || []);
      } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
      }
    };
    
    loadData();
  }, []);

  const handleEmployeeIdChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      employeeId: value,
      email: value ? `${value}@pse.srv.br` : "",
    }));
  };

  const handleEmailChange = (value: string) => {
    setFormData((prev) => ({ ...prev, email: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setLoading(true);
    
    // Validações
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }
    if (!formData.email || !formData.email.includes("@")) {
      setError('Email inválido');
      setLoading(false);
      return;
    }
    if (formData.cpf && !validarCPF(formData.cpf)) {
      setError('CPF inválido');
      setLoading(false);
      return;
    }
    
    try {
      const user = await userService.createWithMatricula({
        name: formData.name,
        department: formData.department,
        role: formData.role,
        position: formData.position,
        employee_id: formData.employeeId,
        cpf: formData.cpf ? limparCPF(formData.cpf) : undefined,
        cnh: formData.cnh || undefined,
        validade_cnh: formData.validade_cnh || undefined,
        cnh_categoria: formData.cnh_categoria || undefined,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        access_level: formData.accessLevel,
        operacao: formData.operacao,
        contratos: formData.contratos.map(contratoId => ({
          contrato_id: contratoId,
          perfil_contrato: 'operador' // Padrão
        })),
        bases: formData.bases.map(baseId => ({
          base_id: baseId,
          tipo_acesso: 'total' // Padrão
        })),
      }) as { email: string };
      setSuccess(true);
      setFormData({
        name: '',
        department: '',
        role: '',
        position: '',
        employeeId: '',
        cpf: '',
        cnh: '',
        validade_cnh: '',
        cnh_categoria: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        accessLevel: '',
        operacao: 'geral',
        contratos: [],
        bases: [],
      });
      setError('');
      setCpfError('');
      alert(`Usuário criado! Email de acesso: ${user.email}`);
    } catch {
      setError('Erro ao criar usuário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredAccessLevel={["admin"]}>
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-6xl mx-auto py-10 px-2 sm:px-4 lg:px-0">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight mb-0">Criar Novo Usuário</h1>
            <p className="mt-1 text-lg text-gray-600 mb-0">Preencha os dados do novo colaborador</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              {/* DADOS PESSOAIS */}
              <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2 mb-0 flex-1">
                <h2 className="text-xl font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <UserPlusIcon className="h-6 w-6 text-blue-500" /> Dados Pessoais
                  </h2>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Nome Completo</label>
                    <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Matrícula</label>
                    <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.employeeId} onChange={(e) => handleEmployeeIdChange(e.target.value)} />
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">CPF</label>
                    <input 
                      type="text" 
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50 ${cpfError ? 'border-red-300' : 'border-gray-300'}`}
                      value={formData.cpf} 
                      onChange={(e) => {
                        const formatted = formatarCPF(e.target.value);
                        setFormData({ ...formData, cpf: formatted });
                        setCpfError('');
                      }}
                      onBlur={() => {
                        if (formData.cpf && !validarCPF(formData.cpf)) {
                          setCpfError('CPF inválido');
                        } else {
                          setCpfError('');
                        }
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                    {cpfError && <span className="text-xs text-red-500 mt-1">{cpfError}</span>}
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">CNH</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50"
                      value={formData.cnh}
                      onChange={(e) => setFormData({ ...formData, cnh: e.target.value })}
                      placeholder="Número da CNH"
                    />
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Validade CNH</label>
                    <input 
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50"
                      value={formData.validade_cnh}
                      onChange={(e) => setFormData({ ...formData, validade_cnh: e.target.value })}
                    />
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">CNH Categoria</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50"
                      value={formData.cnh_categoria}
                      onChange={(e) => setFormData({ ...formData, cnh_categoria: e.target.value })}
                      placeholder="Categoria da CNH"
                    />
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Telefone</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-1 flex items-center gap-1">Email <EnvelopeIcon className="h-4 w-4 text-gray-400" /></label>
                    <input type="email" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.email} onChange={(e) => handleEmailChange(e.target.value)} />
                    <span className="text-xs text-gray-500 mt-1">Preenchido automaticamente pela matrícula, mas pode ser editado.</span>
                  </div>
                </div>
              </section>

              {/* DADOS PROFISSIONAIS */}
              <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2 mb-0 flex-1">
                <h2 className="text-xl font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <BuildingOfficeIcon className="h-6 w-6 text-blue-500" /> Dados Profissionais
                  </h2>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Departamento</label>
                    <select required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} >
                        <option value="">Selecione...</option>
                        <option value="rh">Recursos Humanos</option>
                        <option value="operacoes">Operações</option>
                        <option value="manutencao">Manutenção</option>
                        <option value="administrativo">Administrativo</option>
                      </select>
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Contratos</label>
                    <MultiSelectTags
                      options={contratos}
                      value={formData.contratos}
                      onChange={(selected: string[]) => setFormData({ ...formData, contratos: selected })}
                      placeholder="Selecione os contratos..."
                    />
                      <span className="text-xs text-gray-500 mt-1 block">Selecione os contratos que o usuário poderá acessar.</span>
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Bases Específicas (Opcional)</label>
                    <MultiSelectTags
                      options={bases}
                      value={formData.bases}
                      onChange={(selected: string[]) => setFormData({ ...formData, bases: selected })}
                      placeholder="Selecione bases específicas..."
                    />
                      <span className="text-xs text-gray-500 mt-1 block">Opcional: Selecione bases específicas para acesso restrito.</span>
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Cargo</label>
                    <select required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} >
                      <option value="">Selecione...</option>
                      {cargos.filter(c => c.ativo).map((cargo) => (
                        <option key={cargo.id} value={cargo.nome}>{cargo.nome}</option>
                      ))}
                    </select>
                    </div>
                    <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Função</label>
                    <select required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} >
                      <option value="">Selecione...</option>
                      {roles.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>
            </div>

            {/* DADOS DE ACESSO */}
            <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2 mb-0">
              <h2 className="text-xl font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <ShieldCheckIcon className="h-6 w-6 text-blue-500" /> Dados de Acesso
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1">Nível de Acesso</label>
                  <select required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.accessLevel} onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })} >
                    <option value="">Selecione...</option>
                    {accessLevels.map((level) => (
                      <option key={level.id} value={level.id}>{level.name} - {level.description}</option>
                    ))}
                  </select>
                    </div>
                    <div>
                  <label className="block text-base font-medium text-gray-700 mb-1">Operação</label>
                  <select required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.operacao} onChange={(e) => setFormData({ ...formData, operacao: e.target.value })} >
                    <option value="geral">Geral</option>
                    <option value="linha_viva">Linha Viva</option>
                    <option value="comercial">Comercial</option>
                    <option value="emergencia">Emergência</option>
                    <option value="manutencao">Manutenção</option>
                    <option value="almoxarifado">Almoxarifado</option>
                    <option value="portaria">Portaria</option>
                  </select>
                    </div>
                    <div>
                  <label className="block text-base font-medium text-gray-700 mb-1">Senha</label>
                  <input type="password" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1">Confirmar Senha</label>
                  <input type="password" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-gray-50" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} />
                </div>
              </div>
            </section>

            {/* FEEDBACK */}
            {error && (<div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-base text-center font-medium mt-2">{error}</div>)}
            {success && (<div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-600 text-base text-center font-medium mt-2">Usuário criado com sucesso!</div>)}

            {/* AÇÕES */}
            <div className="flex justify-end gap-4 mt-4">
              <button type="button" className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition" onClick={() => { setFormData({ name: '', department: '', role: '', position: '', employeeId: '', cpf: '', cnh: '', validade_cnh: '', cnh_categoria: '', email: '', phone: '', password: '', confirmPassword: '', accessLevel: '', operacao: 'geral', contratos: [], bases: [] }); setCpfError(''); }}>Limpar</button>
              <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      </main>
    </ProtectedRoute>
  );
} 