import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 子路径部署: /ceping/
export default defineConfig({
  plugins: [react()],
  base: '/ceping/',
})
