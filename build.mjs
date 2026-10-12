import { resolveConfig } from 'vite';
import { rollup } from 'rollup';

async function main() {
  console.log('🚀 開始建置前端生產環境檔案 (Vite + Rollup)...');
  const config = await resolveConfig({}, 'build', 'production');
  const bundle = await rollup({
    input: 'D:/中教大XR/AI test vibe/index.html',
    plugins: config.plugins,
    onwarn: () => {}
  });

  const res = await bundle.write({
    dir: 'dist',
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
  console.error('Build error:', err);
  process.exit(1);
});
