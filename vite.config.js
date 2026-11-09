import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleAuth } from './server/auth-core.js'

// Local development API. For production, api/auth.js runs as a Vercel function.
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  return {
    plugins: [react(), {
      name: 'travel-local-auth-api',
      configureServer(server) {
        server.middlewares.use('/api/auth', (req, res) => {
          Promise.resolve(handleAuth(req, res, env)).catch(() => {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Authentication failed' }))
          })
        })
      },
    }],
  }
})
