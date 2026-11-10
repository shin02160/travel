import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleTrips } from './server/notion-trips.js'
import { handleAuth } from './server/auth-core.js'

// Local development API. For production, api/auth.js runs as a Vercel function.
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  return {
    plugins: [react(), {
      name: 'travel-local-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = req.url?.split('?')[0]
          if (path !== '/api/trips' && !/^\/api\/trips\/[^/]+$/.test(path)) return next()
          return handleTrips(req, res, env).catch(next)
        })
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
