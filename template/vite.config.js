import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import shopify from 'vite-plugin-shopify';
import { readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const ASSETS_DIR = path.resolve('./assets');
const MANIFEST_PATH = path.join(ASSETS_DIR, '.vite', 'manifest.json');

/**
 * Deletes all files previously emitted by Vite (tracked in manifest.json).
 * Non-Vite theme assets (theme.js, vendor.js, etc.) are untouched.
 */
function cleanViteAssets() {
  return {
    name: 'clean-vite-assets',
    buildStart() {
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
      } catch {
        return; // No previous manifest — first build
      }

      const filesToDelete = new Set(
        Object.values(manifest).flatMap((entry) => {
          const files = [entry.file];
          if (entry.css) files.push(...entry.css);
          return files;
        })
      );

      filesToDelete.forEach((file) => {
        try {
          unlinkSync(path.join(ASSETS_DIR, file));
        } catch { /* ignore if already gone */ }
      });
    },
  };
}

export default defineConfig(() => ({
  plugins: [
    cleanViteAssets(),
    shopify({
      themeRoot: './',
      sourceCodeDir: 'frontend',
      entrypointsDir: 'frontend/entrypoints',
      snippetFile: 'vite-tag.liquid',
      themeHotReload: true,
      versionNumbers: true,
    }),
  ],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./frontend', import.meta.url)),
      '@': fileURLToPath(new URL('./frontend/modules', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: false,
    target: 'es2022',
    // Nothing renders <link rel="modulepreload">, so the polyfill would only add
    // a document-wide MutationObserver to every page.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        entryFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
        chunkFileNames: '[name]-[hash].js',
        preserveModules: false,
        manualChunks: undefined,
      }
    }
  },
  server: {
    host: '127.0.0.1',
    cors: {
      origin: [/\.myshopify\.com$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, /^https?:\/\/localhost(:\d+)?$/],
    },
  },
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase'
    },
    preprocessorOptions: {
      scss: {
        // Lets partials say `@use 'utils' as u` instead of counting ../ hops.
        loadPaths: ['frontend/styles'],
        api: 'modern-compiler',
        quietDeps: true,
        logger: {
          warn: () => { }
        }
      }
    }
  }
}));
