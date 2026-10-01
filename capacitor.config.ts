import type { CapacitorConfig } from '@capacitor/cli';

// Android APK 打包配置（由 GitHub Actions 云端构建）
// 包名: com.pac.ruki  应用名: P: AC
const config: CapacitorConfig = {
  appId: 'com.pac.ruki',
  appName: 'P: AC',
  webDir: 'www',
  android: {
    allowMixedContent: true
  }
};

export default config;