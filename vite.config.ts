import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

console.log(process.env.NODE_ENV);

// https://vite.dev/config/
export default defineConfig({
  base:
    process.env.NODE_ENV === 'production'
      ? '/model-context-protocol-course/'
      : undefined,
  plugins: [react()],
});
