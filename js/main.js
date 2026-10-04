// ============================================================
// 游戏入口：玩家档案选择、初始化、Hub ↔ 战斗切换
// ============================================================
import { Game } from "./game.js?v=20";
import { UI } from "./ui.js?v=22";
import { MetaState } from "./meta.js?v=19";
import { Hub } from "./hub.js?v=20";
import { startDuel } from "./duel.js?v=24";
import { loadStagesData } from "./data.js?v=20";

// 等比缩放适配：min 等比完整显示，桌面与移动端一致
// Hub 不做缩放，按自身布局自适应
function fitScreen() {
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 1080;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (window.innerWidth - 1920 * scale) / 2;
  const offsetY = (window.innerHeight - 1080 * scale) / 2;
  // 战斗界面：等比完整显示
  const gameRoot = document.getElementById("game-root");
  gameRoot.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

  // Hub 不缩放
  const hubEl = document.getElementById("hub-screen");
  hubEl.style.transform = "";
}
window.addEventListener("resize", fitScreen);

// 移动端自动全屏：首次触摸/点击触发（浏览器要求必须由用户手势触发）
function tryAutoFullscreen() {
  const isMobile = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (!isMobile || document.fullscreenElement) return;
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}
window.addEventListener("touchstart", tryAutoFullscreen, { once: true });
window.addEventListener("click", tryAutoFullscreen, { once: true });

// 全局状态
let meta = null;
let game = null;
let ui = null;
let hub = null;

// ---------- 玩家档案选择 ----------
const profileScreen = document.getElementById("profile-screen");
const profileListEl = document.getElementById("profile-list");
const profileInput = document.getElementById("profile-name-input");
const profileMsgEl = document.getElementById("profile-msg");

function renderProfileList() {
  const profiles = MetaState.listProfiles();
  profileListEl.innerHTML = "";
  if (profiles.length === 0) {
    profileListEl.innerHTML = '<div class="profile-item-empty">尚无存档，创建一个新档案开始游戏</div>';
    return;
  }
  profiles.forEach(name => {
    const item = document.createElement("div");
    item.className = "profile-item";
    item.innerHTML = `<span class="profile-item-name">${name}</span>`;
    item.onclick = (e) => {
      if (e.target.classList.contains("profile-del-btn")) return;
      enterProfile(name);
    };
    const delBtn = document.createElement("button");
    delBtn.className = "profile-del-btn";
    delBtn.textContent = "删除";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`确定删除玩家「${name}」的所有存档？此操作不可撤销。`)) {
        MetaState.deleteProfile(name);
        renderProfileList();
      }
    };
    item.appendChild(delBtn);
    profileListEl.appendChild(item);
  });
}

function createProfile() {
  const name = profileInput.value.trim();
  if (!name) { profileMsgEl.textContent = "请输入玩家名"; return; }
  const res = MetaState.createProfile(name);
  if (!res.ok) { profileMsgEl.textContent = res.msg; return; }
  profileMsgEl.textContent = "";
  profileInput.value = "";
  renderProfileList();
}

document.getElementById("profile-create-btn").onclick = createProfile;
profileInput.addEventListener("keydown", (e) => { if (e.key === "Enter") createProfile(); });

// 进入指定玩家档案
function enterProfile(name) {
  meta = new MetaState(name);
  profileScreen.classList.add("hidden");
  document.getElementById("hub-screen").classList.remove("hidden");
  document.getElementById("hub-profile-name").textContent = name;
  hub = new Hub(meta, (stageIndex) => showBattle(stageIndex), () => showDuel());
  showHub();
}

// 切换回档案选择
document.getElementById("btn-switch-profile").onclick = () => {
  document.getElementById("hub-screen").classList.add("hidden");
  profileScreen.classList.remove("hidden");
  renderProfileList();
};

// ---------- Hub / 战斗切换 ----------
function showHub() {
  fitScreen();
  document.getElementById("hub-screen").classList.remove("hidden");
  document.getElementById("game-root").classList.add("hidden");
  if (hub) hub.render();
  // 教程胜利后返回 Hub：显示局外养成引导
  if (game && game.isTutorial && game.tutorialStep === 8) {
    const tip = {
      title: "⑦ 局 外 养 成",
      body: "★ 局外养成系统：\n• 人格面具图鉴：查看已收集的人格面具\n• 合体召唤：用 2 张人格面具合成新的（免费）\n• 属性强化：用属性点提升基础属性\n• 阵营选择：切换阵营并升级特性\n• 天鹅绒商店：购买精魄包与扩展\n★ 多档案存档：每个玩家独立进度",
      target: ".hub-nav",
    };
    setTimeout(() => {
      let el = document.getElementById("tutorial-tip");
      if (!el) {
        el = document.createElement("div");
        el.id = "tutorial-tip";
        el.className = "tutorial-tip";
        document.body.appendChild(el);
      }
      el.innerHTML = `
        <div class="tutorial-tip-head">
          <span class="tutorial-tip-title">${tip.title}</span>
          <button class="tutorial-tip-close" title="关闭提示">×</button>
        </div>
        <div class="tutorial-tip-body">${tip.body.replace(/\n/g, "<br>")}</div>
      `;
      el.querySelector(".tutorial-tip-close").onclick = () => el.classList.remove("show");
      el.classList.add("show");
      document.querySelectorAll(".tutorial-highlight").forEach(n => n.classList.remove("tutorial-highlight"));
      const tgt = document.querySelector(tip.target);
      if (tgt) tgt.classList.add("tutorial-highlight");
      game.tutorialStep = 0; // 仅显示一次
    }, 500);
  }
}

function showBattle(stageIndex) {
  document.getElementById("hub-screen").classList.add("hidden");
  document.getElementById("game-root").classList.remove("hidden");
  fitScreen();
  game = new Game(meta);
  ui = new UI(game, showHub);
  window.__game = game;
  window.__ui = ui;
  game.startStage(stageIndex);
}

// 进入 AI 对战（本地三局制）
function showDuel() {
  document.getElementById("hub-screen").classList.add("hidden");
  document.getElementById("game-root").classList.add("hidden");
  startDuel(meta, showHub);
}

// 启动：先加载关卡数据，再显示档案选择界面
loadStagesData().then(source => {
  console.log("关卡数据加载来源:", source);
  renderProfileList();
}).catch(e => {
  console.error("关卡数据加载失败，使用默认值", e);
  renderProfileList();
});

// ---------- 移动端：横屏锁定与竖屏提示 ----------
function checkOrientation() {
  const hint = document.getElementById("rotate-hint");
  if (!hint) return;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const portrait = window.innerHeight > window.innerWidth;
  hint.classList.toggle("hidden", !(isTouch && portrait));
}

// 尝试锁定横屏（PWA 全屏 / 原生包装下生效；普通浏览器标签页可能忽略）
function tryLockLandscape() {
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("landscape").catch(() => {});
    }
  } catch (_) {}
}
checkOrientation();
tryLockLandscape();
window.addEventListener("resize", checkOrientation);
window.addEventListener("orientationchange", () => {
  setTimeout(checkOrientation, 300);
  tryLockLandscape();
});

// ---------- PWA Service Worker：离线缓存 + 可安装 + 自动更新 ----------
// 仅在 http/https 下注册（PWA 场景）；Electron 的 app:// 与本地 file:// 不注册
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.protocol === "http:")) {
  // 新 SW 接管后自动刷新一次，确保移动端加载到最新阵营/战斗逻辑
  // 仅在「更新」场景刷新（页面原本已被旧 SW 控制）；首次安装不刷新，避免无意义重载
  const hadController = !!navigator.serviceWorker.controller;
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || swRefreshing) return;
    swRefreshing = true;
    location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
      // 立即检查一次更新（移动端 PWA 从后台恢复时尤其重要）
      reg.update().catch(() => {});
      const activate = worker => worker && worker.state === "installed" && worker.postMessage("SKIP_WAITING");
      activate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed") {
            if (navigator.serviceWorker.controller) worker.postMessage("SKIP_WAITING");
          }
        });
      });
    }).catch(e => console.warn("SW 注册失败", e));

    // 页面从后台切回前台时再次检查更新
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        navigator.serviceWorker.getRegistration()
          .then(reg => reg && reg.update())
          .catch(() => {});
      }
    });
  });
}
