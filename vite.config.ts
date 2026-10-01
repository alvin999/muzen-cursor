import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, cpSync } from 'fs';

// 自訂複製擴充功能檔案的外掛 (Manifest 與靜態資源)
function copyExtensionAssets() {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }

      // 複製 manifest.json
      const manifestPath = resolve(__dirname, 'manifest.json');
      if (existsSync(manifestPath)) {
        copyFileSync(manifestPath, resolve(distDir, 'manifest.json'));
      }

      // 複製 public/
      const publicDir = resolve(__dirname, 'public');
      if (existsSync(publicDir)) {
        cpSync(publicDir, distDir, { recursive: true });
      }

      // 複製 PDF.js Worker 檔案至 dist/pdf-viewer/
      const pdfWorkerSrc = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
      const pdfViewerDistDir = resolve(distDir, 'pdf-viewer');
      if (existsSync(pdfWorkerSrc)) {
        if (!existsSync(pdfViewerDistDir)) {
          mkdirSync(pdfViewerDistDir, { recursive: true });
        }
        copyFileSync(pdfWorkerSrc, resolve(pdfViewerDistDir, 'pdf.worker.min.mjs'));
      }
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
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'popup/index.html'),
        pdfViewer: resolve(__dirname, 'src/pdf-viewer/viewer.html')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content') return 'content/index.js';
          if (chunkInfo.name === 'background') return 'background/index.js';
          return '[name]/index.js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  plugins: [copyExtensionAssets()]
});
