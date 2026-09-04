import { templateCompilerOptions } from '@tresjs/core'
import vue from '@vitejs/plugin-vue'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv } from 'vite'
import glsl from 'vite-plugin-glsl'
import { handleValidateHost, handleValidatePattern } from './src/prologue/d14/server/d14Validate.ts'

function applyD14Env(env: Record<string, string>): void {
  if (env.D14_PATTERN) process.env.D14_PATTERN = env.D14_PATTERN
  if (env.D14_HOST) process.env.D14_HOST = env.D14_HOST
}

function readNodeBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  res.end(Buffer.from(await response.arrayBuffer()))
}

function d14ValidateDevPlugin() {
  return {
    name: 'd14-validate-api',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        const handle =
          url === '/api/validate-pattern'
            ? handleValidatePattern
            : url === '/api/validate-host'
              ? handleValidateHost
              : null
        if (!handle) {
          next()
          return
        }
        void (async () => {
          const body = await readNodeBody(req)
          const request = new Request(`http://127.0.0.1${url}`, {
            method: req.method,
            headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          })
          await writeWebResponse(res, await handle(request))
        })().catch(next)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  applyD14Env(env)
  const serverTarget = env.VITE_INCUBATOR_SERVER_TARGET || 'http://127.0.0.1:8787'

  return {
    plugins: [
      vue({
        ...templateCompilerOptions,
      }),
      glsl(),
      d14ValidateDevPlugin(),
    ],
    build: {
      sourcemap: false,
    },
    server: {
      proxy: {
        '/api': { target: serverTarget, changeOrigin: false },
        '/ws': { target: serverTarget, changeOrigin: false, ws: true },
      },
    },
  }
})
