// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || '5000'

  return {
    plugins: [react()],
    server: {
      // 👈 Membenarkan host/domain tersebut
      allowedHosts: ['dashboard-bak.tvetdfk.com'],
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{js,jsx}'], // 👈 Strictly only frontend tests
    },
  }
})