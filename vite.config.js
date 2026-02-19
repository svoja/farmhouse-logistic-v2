import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || '3001'
  const apiTarget = `http://127.0.0.1:${apiPort}`
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err, _req, res) => {
              console.error('[Vite proxy] Backend unreachable at', apiTarget, err.message)
            })
          },
        },
        '/route-radar': { target: apiTarget, changeOrigin: true },
        '/route-radar.js': { target: apiTarget, changeOrigin: true },
      },
    },
  }
})
