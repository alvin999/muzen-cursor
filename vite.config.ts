import { defineConfig, build as viteBuild } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, cpSync } from 'fs';

// 自訂建置外掛 (Manifest、靜態資源、以及獨立封裝 Content Script 為自包含 IIFE)
function extensionBuildPlugin() {
  return {
    name: 'extension-build-plugin',
    async closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }

      // 1. 複製 manifest.json
      const manifestPath = resolve(__dirname, 'manifest.json');
      if (existsSync(manifestPath)) {
        copyFileSync(manifestPath, resolve(distDir, 'manifest.json'));
      }

      // 2. 複製 public/
      const publicDir = resolve(__dirname, 'public');
      if (existsSync(publicDir)) {
        cpSync(publicDir, distDir, { recursive: true });
      }

      // 3. 複製 PDF.js Worker 檔案至 dist/pdf-viewer/
      const pdfWorkerSrc = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
      const pdfViewerDistDir = resolve(distDir, 'pdf-viewer');
      if (existsSync(pdfWorkerSrc)) {
        if (!existsSync(pdfViewerDistDir)) {
          mkdirSync(pdfViewerDistDir, { recursive: true });
        }
        copyFileSync(pdfWorkerSrc, resolve(pdfViewerDistDir, 'pdf.worker.min.mjs'));
      }

      // 4. 將 Content Script 獨立編譯為自包含 IIFE（解決 Chrome MV3 原生不支援 content script 執行 import 語句）
      console.log('\n[Muzen Cursor] 正在打包自包含 IIFE Content Script...');
      await viteBuild({
        configFile: false,
        resolve: {
          alias: {
            '@': resolve(__dirname, 'src')
          }
        },
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          sourcemap: process.env.NODE_ENV === 'development',
          lib: {
            entry: resolve(__dirname, 'src/content/index.ts'),
            name: 'MuzenContentScript',
            formats: ['iife'],
            fileName: () => 'content/index.js'
          },
          rollupOptions: {
            output: {
              extend: true
            }
          }
        }
      });
      console.log('[Muzen Cursor] Content Script IIFE 打包完成！');
    }
  };
}

export default defineConfig({
  base: '',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'popup/index.html'),
        options: resolve(__dirname, 'options/index.html'),
        pdfViewer: resolve(__dirname, 'src/pdf-viewer/viewer.html')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background/index.js';
          return '[name]/index.js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  plugins: [extensionBuildPlugin()]
});

