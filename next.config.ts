import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Chrome do servidor para gerar os PDFs das listas (fica fora do pacote do Next)
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
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
