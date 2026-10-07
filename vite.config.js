import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

const recarregarAoSalvar = () => ({
  name: 'recarregar-ao-salvar',
  handleHotUpdate({ file, server }) {
    if (/\.(jsx?|tsx?)$/.test(file)) {
      server.ws.send({ type: 'full-reload' })
      return []
    }
  },
})

export default defineConfig({
  base: '/alee/',
  plugins: [
    recarregarAoSalvar(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})