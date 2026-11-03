import type { NextConfig } from 'next';

// arquivos lidos em tempo de execução pelas rotas que geram PDF: Chrome e fontes
const FILES_FOR_PDF = [
  './node_modules/@sparticuz/chromium/bin/**',
  './node_modules/katex/dist/**',
  './node_modules/@fontsource/arimo/files/arimo-{latin,latin-ext,greek}-*.woff2',
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Chrome do servidor para gerar os PDFs das listas (fica fora do pacote do Next)
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // os arquivos do Chrome (bin/*.br) são lidos em tempo de execução: entram no pacote das rotas que geram PDF
  outputFileTracingIncludes: {
    '/api/listas/[id]/arquivo': FILES_FOR_PDF,
    '/admin/questoes/listas': FILES_FOR_PDF,
    '/admin/questoes/listas/[id]': FILES_FOR_PDF,
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
    optimizePackageImports: ['lucide-react'],
    // Voltar para uma página já aberta nos últimos 30 s é instantâneo (sem ir ao servidor)
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
