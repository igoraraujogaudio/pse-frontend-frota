import { supabase } from '@/lib/supabase';
import { 
  SaidaMaterial, 
  CreateSaidaMaterialDTO,
  AprovarSaidaMaterialDTO,
  EntregarSaidaMaterialDTO
} from '@/types/saida-materiais';

interface DatabaseSaidaMaterial {
  id: string;
  contrato_id: string;
  equipe_id: string;
  responsavel_id: string;
  entregue_por: string;
  data_entrega?: string;
  status: string;
  observacoes?: string;
  base_origem?: string;
  created_at: string;
  updated_at?: string;
  base?: {
    id: string;
    nome: string;
    codigo: string;
  };
  responsavel?: {
    id: string;
    nome: string;
    email: string;
  };
  equipe?: {
    id: string;
    nome: string;
  };
  entregador?: {
    id: string;
    nome: string;
    email: string;
  };
  itens?: DatabaseSaidaMaterialItem[];
}

interface DatabaseSaidaMaterialItem {
  id: string;
  saida_id: string;
  material_id: string;
  quantidade: number;
  unidade_medida: string;
  observacoes?: string;
  patrimonio?: string;
  created_at: string;
  updated_at?: string;
  material?: {
    id: string;
    numero_material: string;
    descricao_material: string;
    unidade_medida: string;
  };
}

export class SaidaMateriaisService {
  private static readonly TABLE_NAME = 'saida_materiais';
  private static readonly ITENS_TABLE = 'saida_materiais_itens';

  static async getAll(contratoId?: string): Promise<SaidaMaterial[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select(`
        *,
        base:bases!base_origem(id, nome, codigo),
        responsavel:usuarios!responsavel_id(id, nome, email),
        equipe:equipes(id, nome),
        entregador:usuarios!entregue_por(id, nome, email),
        itens:saida_materiais_itens(
          *,
          material:lista_materiais(id, numero_material, descricao_material, unidade_medida)
        )
      `)
      .order('created_at', { ascending: false });

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar saídas de materiais:', error);
      throw error;
    }

    return (data || []).map(this.mapToSaidaMaterial);
  }

  static async getById(id: string): Promise<SaidaMaterial | null> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select(`
        *,
        base:bases!base_origem(id, nome, codigo),
        responsavel:usuarios!responsavel_id(id, nome, email),
        equipe:equipes(id, nome),
        entregador:usuarios!entregue_por(id, nome, email),
        itens:saida_materiais_itens(
          *,
          material:lista_materiais(id, numero_material, descricao_material, unidade_medida)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar saída de material:', error);
      throw error;
    }

    if (!data) return null;

    return this.mapToSaidaMaterial(data);
  }

  static async getByContrato(contratoId: string): Promise<SaidaMaterial[]> {
    return this.getAll(contratoId);
  }

  static async create(dto: CreateSaidaMaterialDTO): Promise<SaidaMaterial> {
    const { data: saida, error: saidaError } = await supabase
      .from(this.TABLE_NAME)
      .insert([{
        contrato_id: dto.contratoId,
        equipe_id: dto.equipeId,
        responsavel_id: dto.responsavelId,
        entregue_por: dto.entreguePor,
        observacoes: dto.observacoes,
        veiculo_placa: dto.veiculoPlaca,
        base_origem: dto.baseOrigem,
        status: 'entregue'
      }])
      .select()
      .single();

    if (saidaError) {
      console.error('Erro ao criar saída de material:', saidaError);
      throw saidaError;
    }

    const itensFormatted = dto.itens.map(item => ({
      saida_id: saida.id,
      material_id: item.materialId,
      quantidade: item.quantidade,
      unidade_medida: item.unidadeMedida,
      observacoes: item.observacoes,
      patrimonio: item.patrimonio
    }));

    const { error: itensError } = await supabase
      .from(this.ITENS_TABLE)
      .insert(itensFormatted);

    if (itensError) {
      await supabase.from(this.TABLE_NAME).delete().eq('id', saida.id);
      console.error('Erro ao criar itens da saída:', itensError);
      throw itensError;
    }

    return this.getById(saida.id) as Promise<SaidaMaterial>;
  }


  static async cancelar(id: string): Promise<SaidaMaterial> {
    const { error } = await supabase
      .from(this.TABLE_NAME)
      .update({
        status: 'cancelada'
      })
      .eq('id', id)

    if (error) {
      console.error('Erro ao cancelar saída de material:', error);
      throw error;
    }

    return this.getById(id) as Promise<SaidaMaterial>;
  }

  static async aprovar(id: string, dto: AprovarSaidaMaterialDTO): Promise<SaidaMaterial> {
    const { error } = await supabase
      .from(this.TABLE_NAME)
      .update({
        status: 'conferida_portaria',
        conferido_portaria_por: dto.aprovadoPor,
        conferido_portaria_em: new Date().toISOString(),
        observacoes_portaria: dto.observacoes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Erro ao aprovar saída de material:', error);
      throw error;
    }

    return this.getById(id) as Promise<SaidaMaterial>;
  }

  static async entregar(id: string, dto: EntregarSaidaMaterialDTO): Promise<SaidaMaterial> {
    const { error } = await supabase
      .from(this.TABLE_NAME)
      .update({
        status: 'entregue',
        data_entrega: dto.dataEntrega || new Date().toISOString(),
        entregue_por: dto.entreguePor,
        observacoes: dto.observacoes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Erro ao entregar saída de material:', error);
      throw error;
    }

    return this.getById(id) as Promise<SaidaMaterial>;
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar saída de material:', error);
      throw error;
    }
  }

  private static mapToSaidaMaterial(data: DatabaseSaidaMaterial): SaidaMaterial {
    return {
      id: data.id,
      contratoId: data.contrato_id,
      equipeId: data.equipe_id,
      responsavelId: data.responsavel_id,
      entreguePor: data.entregue_por,
      dataEntrega: data.data_entrega || data.created_at,
      status: data.status as 'entregue' | 'cancelada' | 'conferida_portaria' | 'bloqueada_portaria',
      observacoes: data.observacoes || '',
      baseOrigem: data.base_origem,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
      itens: data.itens?.map((item: DatabaseSaidaMaterialItem) => ({
        id: item.id,
        saidaId: item.saida_id,
        materialId: item.material_id,
        quantidade: item.quantidade,
        unidadeMedida: item.unidade_medida,
        observacoes: item.observacoes || '',
        createdAt: item.created_at,
        updatedAt: item.updated_at || item.created_at,
        material: item.material ? {
          id: item.material.id,
          numeroMaterial: item.material.numero_material,
          descricaoMaterial: item.material.descricao_material,
          unidadeMedida: item.material.unidade_medida
        } : undefined
      })) || [],
      responsavel: data.responsavel ? {
        id: data.responsavel.id,
        nome: data.responsavel.nome,
        email: data.responsavel.email
      } : undefined,
      equipe: data.equipe ? {
        id: data.equipe.id,
        nome: data.equipe.nome
      } : undefined,
      entregador: data.entregador ? {
        id: data.entregador.id,
        nome: data.entregador.nome,
        email: data.entregador.email
      } : undefined,
      base: data.base ? {
        id: data.base.id,
        nome: data.base.nome,
        codigo: data.base.codigo
      } : undefined
    };
  }
}
