import { useState, useEffect } from 'react';
import { Workshop } from '@/types';
import { baseService } from '@/services/baseService';
import { contratoService } from '@/services/contratoService';

type WorkshopFormState = {
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  contact_person: string;
  cnpj: string;
  specialties: string[];
  active: boolean;
  contrato_id: string;
  base_id: string;
};

type WorkshopFormProps = {
  initialData?: Partial<Workshop>;
  onSubmit: (data: WorkshopFormState) => void;
  onCancel: () => void;
};

export default function WorkshopForm({ initialData, onSubmit, onCancel }: WorkshopFormProps) {
  const [form, setForm] = useState<WorkshopFormState>({
    name: initialData?.nome || '',
    address: initialData?.endereco || '',
    city: initialData?.cidade || '',
    state: initialData?.estado || '',
    phone: initialData?.telefone || '',
    email: initialData?.email || '',
    contact_person: initialData?.pessoa_contato || '',
    cnpj: initialData?.cnpj || '',
    specialties: initialData?.especialidades || [],
    active: initialData?.ativo ?? true,
    contrato_id: (initialData as Workshop & {contrato_id?: string})?.contrato_id || '',
    base_id: (initialData as Workshop & {base_id?: string})?.base_id || '',
  });

  const [contratos, setContratos] = useState<Array<{id: string; nome: string; codigo: string}>>([]);
  const [bases, setBases] = useState<Array<{id: string; nome: string; codigo: string; estado?: string; cidade?: string}>>([]);
  const [loading, setLoading] = useState(true);

  const specialtiesOptions = [
    'Mecânica',
    'Elétrica',
    'Pintura',
    'Funilaria',
    'Suspensão',
    'Freios',
    'Outros'
  ];

  // Carregar contratos e bases
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [contratosData, basesData] = await Promise.all([
          contratoService.getAll(),
          baseService.getAll()
        ]);
        setContratos(contratosData);
        setBases(basesData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Atualizar estado quando base for selecionada
  const handleBaseChange = (baseId: string) => {
    const selectedBase = bases.find(base => base.id === baseId);
    setForm(prev => ({
      ...prev,
      base_id: baseId,
      state: selectedBase?.estado || '',
      city: selectedBase?.cidade || ''
    }));
  };


  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm(f => ({
        ...f,
        specialties: checked
          ? [...f.specialties, value]
          : f.specialties.filter((s: string) => s !== value)
      }));
    } else if (type === 'radio') {
      setForm(f => ({ ...f, [name]: value === 'true' }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(form);
  }

         return (
           <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-lg">
      <h2 className="text-xl font-bold mb-4">{initialData ? 'Editar Oficina' : 'Nova Oficina'}</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
        <input
          name="name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          value={form.name}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="mb-4 flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Contrato</label>
          <select
            name="contrato_id"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={form.contrato_id}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="">Selecione um contrato</option>
            {contratos.map(contrato => (
              <option key={contrato.id} value={contrato.id}>
                {contrato.nome} ({contrato.codigo})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Base</label>
          <select
            name="base_id"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={form.base_id}
            onChange={(e) => handleBaseChange(e.target.value)}
            disabled={loading}
          >
            <option value="">Selecione uma base</option>
            {bases.map(base => (
              <option key={base.id} value={base.id}>
                {base.nome} ({base.codigo})
              </option>
            ))}
          </select>
        </div>
      </div>
             <div className="mb-4">
               <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
               <input
                 name="address"
                 className="w-full border border-gray-300 rounded-lg px-3 py-2"
                 value={form.address}
                 onChange={handleChange}
               />
             </div>
      <div className="mb-4 flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cidade
            {form.base_id && <span className="text-xs text-blue-600 ml-1">(preenchido automaticamente)</span>}
          </label>
          <input
            name="city"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={form.city}
            onChange={handleChange}
            placeholder={form.base_id ? "Preenchido automaticamente" : "Digite a cidade"}
          />
        </div>
        <div className="w-24">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            UF
            {form.base_id && <span className="text-xs text-blue-600 ml-1">(auto)</span>}
          </label>
          <input
            name="state"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={form.state}
            onChange={handleChange}
            maxLength={2}
            placeholder={form.base_id ? "Auto" : "UF"}
          />
        </div>
      </div>
      <div className="mb-4 flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
          <input
            name="phone"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={form.phone}
            onChange={handleChange}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
          <input
            name="email"
            type="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={form.email}
            onChange={handleChange}
          />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
        <input
          name="contact_person"
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          value={form.contact_person}
          onChange={handleChange}
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
        <input
          name="cnpj"
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          value={form.cnpj}
          onChange={handleChange}
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Especialidades</label>
        <div className="flex flex-wrap gap-3">
          {specialtiesOptions.map(opt => (
            <label key={opt} className="flex items-center gap-1">
              <input
                type="checkbox"
                name="specialties"
                value={opt}
                checked={form.specialties.includes(opt)}
                onChange={handleChange}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Ativa?</label>
        <div className="flex gap-4">
          <label>
            <input
              type="radio"
              name="active"
              value="true"
              checked={form.active === true}
              onChange={handleChange}
            /> Sim
          </label>
          <label>
            <input
              type="radio"
              name="active"
              value="false"
              checked={form.active === false}
              onChange={handleChange}
            /> Não
          </label>
        </div>
      </div>
             <div className="flex justify-end gap-2">
               <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 cursor-pointer">Cancelar</button>
               <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white cursor-pointer">{initialData ? 'Salvar' : 'Cadastrar'}</button>
             </div>
           </form>

         );
       }