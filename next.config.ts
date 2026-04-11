import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/**/*': [
      './src/templates/**/*',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'supabase.pse.srv.br',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Suppress critical dependency warnings for Supabase
    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
    ];

    // Handle Supabase realtime client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Configuração para módulos nativos no servidor
    if (isServer) {
      // Excluir módulos nativos do processamento do webpack
      // Eles devem ser carregados dinamicamente via require() nativo do Node.js
      const originalExternals = config.externals;
      
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals || []]),
        ({ request, context }: { request?: string; context?: string }, callback: (err?: Error | null, result?: string) => void) => {
          // Se for um caminho absoluto para um arquivo .node, não processar com webpack
          if (request && (request.endsWith('.node') || request.includes('idbio-native.node'))) {
            return callback(null, `commonjs ${request}`);
          }
          // Se for uma função original, chamar
          if (typeof originalExternals === 'function') {
            return originalExternals({ request, context }, callback);
          }
          callback();
        },
      ];

      // Usar node-loader para arquivos .node (permite carregar módulos nativos)
      config.module = config.module || {};
      config.module.rules = config.module.rules || [];
      config.module.rules.push({
        test: /\.node$/,
        use: {
          loader: 'node-loader',
        },
      });
    }

    return config;
  },
};

export default nextConfig;
