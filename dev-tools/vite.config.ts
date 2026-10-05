import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: 'extension-classic-entries',
      renderChunk(code, chunk) {
        if (chunk.fileName !== 'devtools.js' && chunk.fileName !== 'content.js')
          return null
        return {
          code: `(function () {\n${code}\n})()`,
          map: null,
        }
      },
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          if (!ctx.filename.endsWith('devtools.html'))
            return html
          return html.replace('<script type="module" crossorigin', '<script')
        },
      },
    },
  ],
  root: 'src',
  server: {
    port: 5174,
    open: '/index.html',
  },
  publicDir: resolve('public'),
  build: {
    modulePreload: false,
    outDir: resolve('dist'),
    emptyOutDir: true,
    // Chrome extension pages do not have a Node-style module resolver. Keep
    // runtime dependencies inside the generated extension bundles.
    rollupOptions: {
      input: {
        devtools: resolve('src/devtools.html'),
        panel: resolve('src/panel.html'),
        background: resolve('src/background.ts'),
        content: resolve('src/content.ts'),
      },
      output: { entryFileNames: '[name].js' },
    },
  },
  resolve: {
    noExternal: ['vue', '@iconify/vue'],
  },
})
