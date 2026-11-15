import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 5180 e não o 5173 de omissão: o 5173 está ocupado por outro projeto nesta máquina.
  // strictPort para nunca saltar para outra porta — o backend só aceita esta origem.
  server: { port: 5180, strictPort: true },
})
