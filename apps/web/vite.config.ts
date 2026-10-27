import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const PUBLIC_ROUTES = ['/', '/solutions', '/solutions/providers', '/solutions/vendors', '/products', '/products/privexa-connect', '/products/privexa-trust', '/products/privexa-studio', '/integrations', '/security', '/about', '/contact', '/demo', '/privacy', '/terms']

/** Emits sitemap.xml and robots.txt using the deployment's public URL (VITE_SITE_URL). */
function seoFiles(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/$/, '')
  return {
    name: 'privexa-seo-files',
    generateBundle() {
      const urls = PUBLIC_ROUTES.map((r) => `  <url><loc>${base}${r}</loc></url>`).join('\n')
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /app/\nDisallow: /demo/workspace\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n` })
    },
  }
}

const env = loadEnv(process.env.NODE_ENV ?? 'production', '../..', 'VITE_')

export default defineConfig({
  plugins: [react(), tailwindcss(), seoFiles(env.VITE_SITE_URL || 'http://localhost:5173')],
  envDir: '../..',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          data: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:8000', changeOrigin: true } },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.tsx'] },
} as never)
