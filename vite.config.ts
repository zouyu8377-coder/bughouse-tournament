import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'Bughouse 比赛编排系统',
        short_name: 'Bughouse',
        description: 'Bughouse 瑞士制比赛编排系统',
        theme_color: '#0984e3',
        background_color: '#f5f6fa',
        display: 'standalone',
        start_url: './index.html',
        scope: './',
        icons: [
          {
            src: './favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
