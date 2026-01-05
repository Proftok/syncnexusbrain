import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
      'process.env.EVOLUTION_API_URL': JSON.stringify(env.EVOLUTION_API_URL),
      'process.env.EVOLUTION_API_KEY': JSON.stringify(env.EVOLUTION_API_KEY),
      'process.env.INSTANCE_NAME': JSON.stringify(env.INSTANCE_NAME),
      'process.env.INSTANCE_NAME_2': JSON.stringify(env.INSTANCE_NAME_2),
      'process.env.ACCESS_EMAIL': JSON.stringify(env.ACCESS_EMAIL),
      'process.env.ACCESS_PASSWORD': JSON.stringify(env.ACCESS_PASSWORD)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
