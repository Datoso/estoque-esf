import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/estoque-esf/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Estoque ESF',
        short_name: 'Estoque ESF',
        description: 'Controle de estoque e vacinação da Estratégia Saúde da Família',
        lang: 'pt-BR',
        theme_color: '#0F5E56',
        background_color: '#F5F7F6',
        display: 'standalone',
        start_url: '/estoque-esf/',
        scope: '/estoque-esf/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: { navigateFallback: '/estoque-esf/index.html' },
      devOptions: { enabled: false }
    })
  ],
  test: { environment: 'node' }
} as any);
