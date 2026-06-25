import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// El front llama a /v1/* de forma relativa; Vite lo proxea a la API.
// En docker compose la API es el servicio `api`; en local podés cambiar el target.
const apiTarget = process.env.API_PROXY ?? 'http://api:3000';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/v1': { target: apiTarget, changeOrigin: true },
    },
  },
});
