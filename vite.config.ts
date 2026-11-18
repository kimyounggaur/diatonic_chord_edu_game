import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({plugins:[react(),tailwindcss()],resolve:{alias:{'@':fileURLToPath(new URL('./src/rcb',import.meta.url))}},define:{'process.env.NEXT_PUBLIC_ASSET_BASE':JSON.stringify('/')},test:{environment:'node',include:['tests/**/*.test.ts']},build:{rollupOptions:{input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),remaster:fileURLToPath(new URL('./remaster.html',import.meta.url))},output:{manualChunks:{react:['react','react-dom'],phaser:['phaser']}}}}});
