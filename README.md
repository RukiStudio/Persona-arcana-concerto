# 女神异闻录：阿尔卡那协奏（P: AC）

> 塔罗主题的即时卡牌战斗网页游戏，灵感源自《女神异闻录》系列的人格面具与阿尔卡那（Arcana）体系。

纯前端实现，无需安装依赖即可游玩；支持网页、Windows 桌面（Electron）与 Android（APK）三种形态。

---

## ✨ 特性

- **22 张大阿尔卡那（人格面具卡）**：召唤人格面具加入战局，可翻转切换正/逆位技能
- **小阿尔卡那辅助卡**：权杖 / 圣杯 / 星币 / 宝剑，即时发挥战术效果
- **构筑合成系统**：将人格面具卡拖入构筑槽，按「总力度 × 等级」合成强力攻击牌
- **弱点与倒地机制**：命中弱点触发 `WEAK!` 使敌人倒地，全体倒地后可发动「总攻击」
- **神通法（Theurgy）**：怒气值攒满后释放必杀技
- **多玩家档案**：本地独立存档，互不干扰
- **关卡编辑器**：可视化自制关卡（`stage-editor.html`）
- **移动端适配**：横屏锁定 + 等比缩放，触摸拖拽 / 点选 / 长按翻面
- **离线 PWA**：可添加到手机/电脑桌面，离线游玩

---

## 🎮 玩法速览

1. **构筑**：把人格面具卡拖入下方 5 个构筑槽，点击 CONFIRM 合成攻击牌
2. **释放**：再点一次手牌中的「攻击牌」即可对敌人造成属性伤害
3. **弱点**：命中弱点使敌人倒地；全部倒地即触发全体「总攻击」
4. **养成**：战斗结伴后在 Hub 中合成人格面具、管理卡组

---

## 🛠 技术栈

- 原生 **HTML5 / CSS3 / JavaScript（ES Module）**，无第三方运行时依赖
- 关卡数据 `stages.json` 动态加载
- 可选 **Python** 本地服务器（`web_server.py`）
- 打包：**Capacitor**（Android APK）、**Electron**（Windows 桌面）、**PWA**

---

## 📁 目录结构

```
Persona即时卡牌/
├── index.html            # 游戏主页面
├── stage-editor.html     # 关卡编辑器
├── stages.json           # 关卡数据
├── css/                  # 样式表
├── js/                   # 游戏逻辑（main/game/ui/core/data/meta/hub/fusion）
├── assets/               # 图片资源（背景、卡框）
├── icons/                # 应用图标
├── manifest.webmanifest  # PWA 清单
├── sw.js                 # Service Worker（离线缓存）
├── scripts/              # Android 图标生成脚本
├── .github/workflows/    # GitHub Actions（APK 自动构建）
├── run.bat               # 一键启动网页版（需 Python）
├── web_server.py         # 本地静态文件服务器
```

---

## 🚀 本地运行

### 方式一：一键启动（推荐）

双击 `run.bat`，自动启动本地服务器并打开浏览器。

> 需要 **Python 3.8+** 并加入 PATH。服务器默认端口 8765，被占用时自动尝试 8765–8784。

### 方式二：手动启动服务器

```bash
python -u web_server.py
```

然后浏览器访问 `http://localhost:8765`。

### 方式三：直接打开

如果浏览器允许 `file://` 加载 `stages.json`（如 Edge/Chrome 关闭安全限制），可直接双击 `index.html`。否则请使用方式一/二启动本地服务器。

---

## 📦 打包与分发

### Android APK（GitHub Actions，无需本地 SDK）

推送代码后，[GitHub Actions](https://github.com/RukiStudio/Persona-arcana-concerto/actions) 会自动在云端（预装 Android SDK + Java 17）构建 APK。

```bash
# 1. 触发构建
.\push.ps1 -Message "feat: build apk"

# 2. 下载产物（或直接在 Actions 页面 Artifacts 下载）
cd f:\Persona-arcana-apk
.\download-apk.ps1
```

- 包名：`com.pac.ruki`
- 应用名：`P: AC`
- 产物：`P-AC-debug`（可直接安装的调试版）、`P-AC-release-unsigned`（未签名发布版）

### Windows 桌面版（Electron）

桌面版工程位于独立目录 `f:\Persona-arcana-electron`，双击该目录下的 `run.bat` 运行、`build.bat` 打包 `.exe`。

### PWA（添加到桌面）

访问部署后的站点（如 GitHub Pages），浏览器「添加到主屏幕」即可全屏离线游玩。

---

## 📱 移动端操作

| 操作 | 方式 |
| --- | --- |
| 选牌 / 出牌 | 点击选中，再点一次使用 |
| 拖入构筑槽 | 按住并拖拽 |
| 翻转人格面具 | 长按 |
| 游戏方向 | 横屏（自动缩放适配） |

---

## 📄 声明

本项目为粉丝同人作品，仅供学习交流。其中「女神异闻录 / Persona」相关角色、世界观与素材版权归 ATLUS / SEGA 所有。