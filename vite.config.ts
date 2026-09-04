import { templateCompilerOptions } from '@tresjs/core'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverTarget = env.VITE_INCUBATOR_SERVER_TARGET || 'http://127.0.0.1:8787'

  return {
    plugins: [
      vue({
        ...templateCompilerOptions,
      }),
      glsl(),
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
