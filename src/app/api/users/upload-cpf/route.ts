import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatarCPF, processarCPFExcel } from '@/utils/cpfUtils';

interface UsuarioData {
    matricula: string;
    cpf?: string;
    data_nascimento?: string;
    data_admissao?: string;
}

interface ResultadoProcessamento {
    status: string;
    matricula_retorno: string;
    nome_retorno: string;
    cpf_atualizado: string;
    data_nascimento_atualizada: string;
    data_admissao_atualizada: string;
}

export async function POST(request: NextRequest) {
    try {
        // Criar cliente Supabase com service role key para operações administrativas
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ 
                error: 'Configuração do Supabase não encontrada' 
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Para operações administrativas, não precisamos verificar autenticação do usuário
        // pois estamos usando a service role key

        const body = await request.json();
        const { usuarios }: { usuarios: UsuarioData[] } = body;

        if (!usuarios || !Array.isArray(usuarios)) {
            return NextResponse.json({
                error: 'Dados inválidos. Esperado array de usuários com matrícula, CPF, data de nascimento e/ou data de admissão'
            }, { status: 400 });
        }

        // Preparar dados para a função SQL
        const dadosJson = usuarios.map(u => ({
            matricula: u.matricula.toString(),
            cpf: u.cpf ? formatarCPF(processarCPFExcel(u.cpf)) : null,
            data_nascimento: u.data_nascimento || null,
            data_admissao: u.data_admissao || null
        }));

        // Usar a função SQL para importar em lote (nova função que suporta data de admissão)
        const { data: resultados, error } = await supabase
            .rpc('importar_dados_colaboradores_lote', { dados_json: dadosJson });

        if (error) {
            console.error('Erro na função SQL:', error);
            return NextResponse.json(
                { error: `Erro ao processar dados: ${error.message}` },
                { status: 500 }
            );
        }

        // Contar sucessos e erros
        const sucessos = resultados?.filter((r: ResultadoProcessamento) => r.status === 'SUCESSO').length || 0;
        const erros = resultados?.filter((r: ResultadoProcessamento) => r.status.startsWith('ERRO')).length || 0;

        return NextResponse.json({
            message: `Processamento concluído. ${sucessos} sucessos, ${erros} erros.`,
            resultados: {
                sucesso: sucessos,
                erros: erros,
                detalhes: resultados?.map((r: ResultadoProcessamento) => ({
                    matricula: r.matricula_retorno,
                    nome: r.nome_retorno,
                    cpf: r.cpf_atualizado,
                    data_nascimento: r.data_nascimento_atualizada,
                    data_admissao: r.data_admissao_atualizada,
                    status: r.status === 'SUCESSO' ? 'sucesso' : 'erro',
                    mensagem: r.status === 'SUCESSO' ? 'Dados atualizados com sucesso' : r.status
                })) || []
            }
        });

    } catch (error) {
        console.error('Erro no upload de CPFs:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}