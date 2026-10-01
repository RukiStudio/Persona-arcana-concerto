// 从 icons/app-icon.png (1024x1024) 生成 Android mipmap 各密度启动图标
// 在 CI 中执行于 `npx cap add android` 之后（android/ 目录已存在）
import sharp from 'sharp';
import { mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'icons/app-icon.png';
const BASE = 'android/app/src/main/res';

// 各密度对应像素尺寸
const SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

async function main() {
  for (const [dpi, size] of Object.entries(SIZES)) {
    const dir = join(BASE, `mipmap-${dpi}`);
    mkdirSync(dir, { recursive: true });
    const buf = await sharp(SRC).resize(size, size).png().toBuffer();
    await Promise.all([
      sharp(buf).toFile(join(dir, 'ic_launcher.png')),
      sharp(buf).toFile(join(dir, 'ic_launcher_round.png'))
    ]);
  }

  // 移除自适应图标引用，让系统回退到上面的方形位图图标（避免圆形遮罩裁切）
  for (const f of [
    join(BASE, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
    join(BASE, 'mipmap-anydpi-v26', 'ic_launcher_round.xml')
  ]) {
    if (existsSync(f)) unlinkSync(f);
  }

  console.log('Android launcher icons generated.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});