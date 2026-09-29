import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  publicDir: resolve('public'),
  build: {
    outDir: resolve('dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        devtools: resolve('src/devtools.html'),
        panel: resolve('src/panel.html'),
        background: resolve('src/background.ts'),
      },
      output: { entryFileNames: '[name].js' },
    },
  },
})
