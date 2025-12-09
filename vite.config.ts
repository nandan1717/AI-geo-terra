import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // Base path must be relative for GH Pages / Vercel to work in subdirectories
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Mortals',
          short_name: 'Mortals',
          description: 'Explore the world with AI locals.',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-icon.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            },
            {
              src: 'pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      // Polyfill process.env for libraries that might expect it, 
      // and inject the API key if it's set in the environment.
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'process.env.VITE_DEEPSEEK_API_KEY': JSON.stringify(env.VITE_DEEPSEEK_API_KEY),
      'process.env.VITE_CESIUM_ION_TOKEN': JSON.stringify(env.VITE_CESIUM_ION_TOKEN),
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY),
      // Also expose it as a global for direct access if needed (safety net)
      '__GEMINI_API_KEY__': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    optimizeDeps: {
      include: ['firebase/app', 'firebase/auth']
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['lucide-react'],
          }
        }
      },
      chunkSizeWarningLimit: 1000
    }
  };
});
