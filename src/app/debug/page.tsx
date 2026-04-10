import DebugPermissions from '@/components/DebugPermissions';

export default function DebugPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            🔍 Debug Sistema Modular
          </h1>
          <p className="mt-2 text-gray-600">
            Página para testar e debugar o sistema modular de permissões
          </p>
        </div>
        
        <DebugPermissions />
        
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            📋 Instruções de Uso
          </h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div>
              <strong>1. Verificar Usuário:</strong> Confirme se os dados do usuário estão corretos
            </div>
            <div>
              <strong>2. Testar Permissões:</strong> Use o campo &quot;Testar Permissão&quot; para verificar códigos específicos
            </div>
            <div>
              <strong>3. Verificar Estatísticas:</strong> Confirme se as permissões personalizadas estão sendo carregadas
            </div>
            <div>
              <strong>4. Testes Rápidos:</strong> Verifique se as permissões principais estão funcionando
            </div>
            <div>
              <strong>5. Dados do Sistema:</strong> Confirme se módulos, plataformas e perfis estão carregando
            </div>
            <div>
              <strong>6. JSON Debug:</strong> Use para análise detalhada dos dados
            </div>
          </div>
        </div>
        
        <div className="mt-6 bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            🎯 Códigos de Permissão para Teste
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-blue-700 mb-2">Almoxarifado:</h4>
              <ul className="space-y-1 text-blue-600">
                <li>• almoxarifado.site.dashboard_completo</li>
                <li>• almoxarifado.site.relatorios_avancados</li>
                <li>• almoxarifado.site.configurar_categorias</li>
                <li>• almoxarifado.mobile.dashboard</li>
                <li>• almoxarifado.mobile.visualizar_estoque</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-700 mb-2">Veículos:</h4>
              <ul className="space-y-1 text-blue-600">
                <li>• veiculos.site.dashboard_frota</li>
                <li>• veiculos.site.cadastrar_veiculo</li>
                <li>• veiculos.site.editar_veiculo</li>
                <li>• veiculos.mobile.listar_veiculos</li>
                <li>• veiculos.mobile.detalhes_veiculo</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-700 mb-2">Manutenção:</h4>
              <ul className="space-y-1 text-blue-600">
                <li>• manutencao.site.dashboard_manutencoes</li>
                <li>• manutencao.site.planejar_preventivas</li>
                <li>• manutencao.mobile.indicar_manutencao</li>
                <li>• manutencao.mobile.aprovar_manutencao</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-700 mb-2">Configurações:</h4>
              <ul className="space-y-1 text-blue-600">
                <li>• configuracoes.site.gerenciar_usuarios</li>
                <li>• configuracoes.site.gerenciar_permissoes</li>
                <li>• configuracoes.site.configurar_sistema</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


