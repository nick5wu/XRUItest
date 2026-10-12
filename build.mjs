import { resolveConfig } from 'vite';
import { rollup } from 'rollup';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('🚀 開始建置前端生產環境檔案 (Vite + Rollup)...');
  const config = await resolveConfig({}, 'build', 'production');
  const inputHtml = path.resolve(__dirname, 'index.html');
  const outDir = path.resolve(__dirname, 'dist');

  // 確保輸出目錄存在
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 複製 public 靜態資源到 dist (如 favicon.svg, icons.svg)
  const publicDir = path.resolve(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    try {
      for (const file of fs.readdirSync(publicDir)) {
        const srcFile = path.join(publicDir, file);
        const destFile = path.join(outDir, file);
        if (fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, destFile);
        }
      }
    } catch (e) {
      console.warn('⚠️ 複製 public 資源時略過:', e.message);
    }
  }

  console.log('📦 正在解析前端模組相依圖 (跨平台入口:', inputHtml, ')...');
  const bundle = await rollup({
    input: inputHtml,
    plugins: config.plugins,
    onwarn: (warning) => {
      if (warning.code === 'CIRCULAR_DEPENDENCY' || warning.code === 'THIS_IS_UNDEFINED') return;
      console.warn(`[build:warn] ${warning.message}`);
    }
  });

  const res = await bundle.write({
    dir: outDir,
    format: 'es',
    entryFileNames: 'assets/[name]-[hash].js',
    chunkFileNames: 'assets/[name]-[hash].js',
    assetFileNames: 'assets/[name]-[hash].[ext]'
  });

  console.log('✅ 前端生產環境打包成功！產出檔案：');
  for (const item of res.output) {
    console.log(`   - dist/${item.fileName}`);
  }
}

main().catch(err => {
  console.error('❌ Build failed with error:', err);
  process.exit(1);
});
