import { defineConfig } from 'astro/config'
import node from '@astrojs/node'
import react from '@astrojs/react'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://1ed.ge',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    assets: '_astro',
  },
  server: {
    port: 4321,
  },
})
