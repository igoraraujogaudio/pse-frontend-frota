// =============================
// SERVIÇO PARA GERENCIAR CARROS PARTICULARES
// =============================

import { createClient } from '@/lib/supabase';
import { 
  CarroParticular, 
  CarroParticularForm, 
  MovimentacaoCarroParticular,
  BuscaVeiculoResponse,
  DadosMovimentacao,
  EstatisticasCarrosParticulares,
  FiltrosCarrosParticulares,
  ListaCarrosParticularesResponse
} from '@/types/carro-particular';

class CarrosParticularesService {
  private supabase = createClient();

  // =============================
  // CRUD BÁSICO
  // =============================

  /**
   * Listar carros particulares do funcionário logado
   */
  async listarCarrosDoFuncionario(funcionarioId: string): Promise<CarroParticular[]> {
    try {
      const { data, error } = await this.supabase
        .from('carros_particulares')
        .select(`
          *,
          funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
        `)
        .eq('funcionario_id', funcionarioId)
        .eq('ativo', true)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao listar carros do funcionário:', error);
      throw new Error('Erro ao buscar carros particulares');
    }
  }

  /**
   * Listar todos os carros particulares (admin)
   */
  async listarTodosCarros(filtros?: FiltrosCarrosParticulares): Promise<ListaCarrosParticularesResponse> {
    try {
      let query = this.supabase
        .from('carros_particulares')
        .select(`
          *,
          funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
        `, { count: 'exact' });

      // Aplicar filtros
      if (filtros?.funcionario_id) {
        query = query.eq('funcionario_id', filtros.funcionario_id);
      }
      if (filtros?.placa) {
        query = query.ilike('placa', `%${filtros.placa}%`);
      }
      if (filtros?.ativo !== undefined) {
        query = query.eq('ativo', filtros.ativo);
      }

      const { data, error, count } = await query
        .order('criado_em', { ascending: false });

      if (error) throw error;

      return {
        carros: data || [],
        total: count || 0,
        pagina: 1,
        limite: 100
      };
    } catch (error) {
      console.error('Erro ao listar todos os carros:', error);
      throw new Error('Erro ao buscar carros particulares');
    }
  }

  /**
   * Buscar carro particular por ID
   */
  async buscarCarroPorId(id: string): Promise<CarroParticular | null> {
    try {
      const { data, error } = await this.supabase
        .from('carros_particulares')
        .select(`
          *,
          funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
        `)
        .eq('id', id)
        .eq('ativo', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar carro por ID:', error);
      return null;
    }
  }

  /**
   * Buscar carro particular por placa
   */
  async buscarCarroPorPlaca(placa: string): Promise<CarroParticular | null> {
    try {
      const { data, error } = await this.supabase
        .from('carros_particulares')
        .select(`
          *,
          funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
        `)
        .eq('placa', placa.toUpperCase())
        .eq('ativo', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar carro por placa:', error);
      return null;
    }
  }

  /**
   * Cadastrar novo carro particular
   */
  async cadastrarCarro(dados: CarroParticularForm, funcionarioId: string): Promise<CarroParticular> {
    try {
      // Validar se placa já existe
      const carroExistente = await this.buscarCarroPorPlaca(dados.placa);
      if (carroExistente) {
        throw new Error('Placa já cadastrada no sistema');
      }

      const { data, error } = await this.supabase
        .from('carros_particulares')
        .insert({
          funcionario_id: funcionarioId,
          placa: dados.placa.toUpperCase(),
          ativo: true
        })
        .select(`
          *,
          funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao cadastrar carro:', error);
      throw error;
    }
  }

  /**
   * Atualizar dados do carro
   */
  async atualizarCarro(id: string, dados: Partial<CarroParticularForm>): Promise<CarroParticular> {
    try {
      const updateData: Record<string, unknown> = {};
      
      if (dados.placa) {
        // Validar se nova placa já existe
        const carroExistente = await this.buscarCarroPorPlaca(dados.placa);
        if (carroExistente && carroExistente.id !== id) {
          throw new Error('Placa já cadastrada no sistema');
        }
        updateData.placa = dados.placa.toUpperCase();
      }

      if (dados.funcionario_id) {
        updateData.funcionario_id = dados.funcionario_id;
      }

      const { data, error } = await this.supabase
        .from('carros_particulares')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao atualizar carro:', error);
      throw error;
    }
  }

  /**
   * Desativar carro particular
   */
  async desativarCarro(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('carros_particulares')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao desativar carro:', error);
      throw new Error('Erro ao desativar carro');
    }
  }

  // =============================
  // BUSCA UNIFICADA (PORTARIA)
  // =============================

  /**
   * Buscar veículo por QR code (frota ou particular)
   */
  async buscarVeiculoPorQR(qrData: string): Promise<BuscaVeiculoResponse | null> {
    try {
      // Usar função do banco para busca unificada
      const { data, error } = await this.supabase
        .rpc('buscar_veiculo_por_qr', { qr_data: qrData });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const veiculo = data[0];
      
      return {
        veiculo: {
          id: veiculo.id,
          placa: veiculo.placa,
          tipo: veiculo.tipo,
          proxima_acao: veiculo.proxima_acao,
          modelo: veiculo.modelo,
          marca_equipamento: veiculo.marca,
          funcionario_nome: veiculo.funcionario_nome,
          funcionario_matricula: veiculo.funcionario_matricula
        },
        alertas: [] // TODO: Implementar alertas se necessário
      };
    } catch (error) {
      console.error('Erro ao buscar veículo por QR:', error);
      return null;
    }
  }

  // =============================
  // MOVIMENTAÇÕES
  // =============================

  /**
   * Registrar movimentação de carro particular
   */
  async registrarMovimentacao(dados: DadosMovimentacao): Promise<MovimentacaoCarroParticular> {
    try {
      const { data, error } = await this.supabase
        .from('movimentacoes_veiculos')
        .insert({
          carro_particular_id: dados.carro_particular_id,
          colaborador_id: dados.colaborador_id,
          tipo: dados.acao,
          tipo_veiculo: 'particular',
          quilometragem: dados.quilometragem || 0,
          data_movimentacao: new Date().toISOString(),
          observacoes: dados.observacoes,
          base_id: dados.base_id,
          contrato_id: dados.contrato_id
        })
        .select(`
          *,
          carro_particular:carros_particulares(
            *,
            funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula)
          )
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
      throw new Error('Erro ao registrar movimentação');
    }
  }

  /**
   * Listar movimentações de carro particular
   */
  async listarMovimentacoes(carroId: string, limite: number = 50): Promise<MovimentacaoCarroParticular[]> {
    try {
      const { data, error } = await this.supabase
        .from('movimentacoes_veiculos')
        .select(`
          *,
          carro_particular:carros_particulares(
            *,
            funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula)
          )
        `)
        .eq('carro_particular_id', carroId)
        .eq('tipo_veiculo', 'particular')
        .order('data_movimentacao', { ascending: false })
        .limit(limite);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao listar movimentações:', error);
      throw new Error('Erro ao buscar movimentações');
    }
  }

  // =============================
  // ESTATÍSTICAS
  // =============================

  /**
   * Obter estatísticas de carros particulares
   */
  async obterEstatisticas(): Promise<EstatisticasCarrosParticulares> {
    try {
      // Total de carros
      const { count: totalCarros } = await this.supabase
        .from('carros_particulares')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);

      // Carros ativos
      const { count: carrosAtivos } = await this.supabase
        .from('carros_particulares')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);

      // Movimentações hoje
      const hoje = new Date().toISOString().split('T')[0];
      const { count: movimentacoesHoje } = await this.supabase
        .from('movimentacoes_veiculos')
        .select('*', { count: 'exact', head: true })
        .eq('tipo_veiculo', 'particular')
        .gte('data_movimentacao', `${hoje}T00:00:00`)
        .lte('data_movimentacao', `${hoje}T23:59:59`);

      // Funcionários com carro
      const { count: funcionariosComCarro } = await this.supabase
        .from('carros_particulares')
        .select('funcionario_id', { count: 'exact', head: true })
        .eq('ativo', true);

      return {
        total_carros: totalCarros || 0,
        carros_ativos: carrosAtivos || 0,
        movimentacoes_hoje: movimentacoesHoje || 0,
        funcionarios_com_carro: funcionariosComCarro || 0
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      throw new Error('Erro ao buscar estatísticas');
    }
  }

  // =============================
  // UTILITÁRIOS
  // =============================

  /**
   * Gerar dados do QR code para carro particular
   */
  gerarDadosQR(carro: CarroParticular): string {
    return `PRIVATE:${carro.placa}:${carro.id}`;
  }

  /**
   * Validar formato de placa
   */
  validarPlaca(placa: string): boolean {
    // Formato brasileiro: ABC1234 ou ABC1D23 (Mercosul)
    const placaUpper = placa.toUpperCase().replace(/-/g, '');
    const oldFormat = /^[A-Z]{3}\d{4}$/.test(placaUpper);
    const mercosulFormat = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(placaUpper);
    return oldFormat || mercosulFormat;
  }

  /**
   * Formatar placa
   */
  formatarPlaca(placa: string): string {
    return placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
}

export const carrosParticularesService = new CarrosParticularesService();
