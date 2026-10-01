<<<<<<< HEAD
<<<<<<< HEAD
﻿// ============================================================
// 游戏入口：初始化、缩放适配、Hub ↔ 战斗切换
// ============================================================
import { Game } from "./game.js?v=10";
import { UI } from "./ui.js?v=10";
import { MetaState } from "./meta.js?v=10";
import { Hub } from "./hub.js?v=10";
=======
// ============================================================
// 游戏入口：玩家档案选择、初始化、Hub ↔ 战斗切换
// ============================================================
import { Game } from "./game.js?v=16";
import { UI } from "./ui.js?v=16";
import { MetaState } from "./meta.js?v=16";
import { Hub } from "./hub.js?v=16";
import { loadStagesData } from "./data.js?v=16";
>>>>>>> feat-develop-game-plan-KtGMvY
=======
// ============================================================
// 游戏入口：玩家档案选择、初始化、Hub ↔ 战斗切换
// ============================================================
import { Game } from "./game.js?v=18";
import { UI } from "./ui.js?v=18";
import { MetaState } from "./meta.js?v=18";
import { Hub } from "./hub.js?v=18";
import { loadStagesData } from "./data.js?v=18";
>>>>>>> feat-develop-game-plan-KtGMvY

// 等比缩放适配
function fitScreen() {
  const root = document.getElementById("game-root");
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 1080;
  const scale = Math.min(scaleX, scaleY);
  root.style.transform = `scale(${scale})`;
  const offset = (window.innerHeight - 1080 * scale) / 2;
  root.style.marginTop = offset > 0 ? offset + "px" : "0";
}
window.addEventListener("resize", fitScreen);

<<<<<<< HEAD
<<<<<<< HEAD
// 初始化 meta 状态
const meta = new MetaState();

// 全局状态
=======
// 全局状态
let meta = null;
>>>>>>> feat-develop-game-plan-KtGMvY
=======
// 全局状态
let meta = null;
>>>>>>> feat-develop-game-plan-KtGMvY
let game = null;
let ui = null;
let hub = null;

<<<<<<< HEAD
<<<<<<< HEAD
// 显示 Hub
=======
=======
>>>>>>> feat-develop-game-plan-KtGMvY
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
  hub = new Hub(meta, (stageIndex) => showBattle(stageIndex));
  showHub();
}

// 切换回档案选择
document.getElementById("btn-switch-profile").onclick = () => {
  document.getElementById("hub-screen").classList.add("hidden");
  profileScreen.classList.remove("hidden");
  renderProfileList();
};

// ---------- Hub / 战斗切换 ----------
<<<<<<< HEAD
>>>>>>> feat-develop-game-plan-KtGMvY
=======
>>>>>>> feat-develop-game-plan-KtGMvY
function showHub() {
  document.getElementById("hub-screen").classList.remove("hidden");
  document.getElementById("game-root").classList.add("hidden");
  if (hub) hub.render();
<<<<<<< HEAD
<<<<<<< HEAD
}

// 显示战斗画面
=======
=======
>>>>>>> feat-develop-game-plan-KtGMvY
  // 教程胜利后返回 Hub：显示局外养成引导
  if (game && game.isTutorial && game.tutorialStep === 8) {
    const tip = {
      title: "⑦ 局 外 养 成",
      body: "★ 局外养成系统：\n• 人格面具图鉴：查看已收集的人格面具\n• 合体召唤：用 2 张人格面具合成新的（消耗精魄）\n• 属性强化：用属性点提升基础属性\n• 阵营选择：切换阵营并升级特性\n• 天鹅绒商店：购买精魄包与扩展\n★ 多档案存档：每个玩家独立进度",
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

<<<<<<< HEAD
>>>>>>> feat-develop-game-plan-KtGMvY
=======
>>>>>>> feat-develop-game-plan-KtGMvY
function showBattle(stageIndex) {
  document.getElementById("hub-screen").classList.add("hidden");
  document.getElementById("game-root").classList.remove("hidden");
  fitScreen();
  game = new Game(meta);
  ui = new UI(game, showHub);
  window.__game = game;
<<<<<<< HEAD
<<<<<<< HEAD
  game.startStage(stageIndex);
}

// 启动 Hub
hub = new Hub(meta, (stageIndex) => {
  showBattle(stageIndex);
});
showHub();
=======
=======
>>>>>>> feat-develop-game-plan-KtGMvY
  window.__ui = ui;
  game.startStage(stageIndex);
}

// 启动：先加载关卡数据，再显示档案选择界面
loadStagesData().then(source => {
  console.log("关卡数据加载来源:", source);
  renderProfileList();
}).catch(e => {
  console.error("关卡数据加载失败，使用默认值", e);
  renderProfileList();
});
<<<<<<< HEAD
>>>>>>> feat-develop-game-plan-KtGMvY
=======
>>>>>>> feat-develop-game-plan-KtGMvY
