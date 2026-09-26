// ============================================================
// 游戏入口：玩家档案选择、初始化、Hub ↔ 战斗切换
// ============================================================
import { Game } from "./game.js?v=12";
import { UI } from "./ui.js?v=12";
import { MetaState } from "./meta.js?v=12";
import { Hub } from "./hub.js?v=12";

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
function showHub() {
  document.getElementById("hub-screen").classList.remove("hidden");
  document.getElementById("game-root").classList.add("hidden");
  if (hub) hub.render();
}

function showBattle(stageIndex) {
  document.getElementById("hub-screen").classList.add("hidden");
  document.getElementById("game-root").classList.remove("hidden");
  fitScreen();
  game = new Game(meta);
  ui = new UI(game, showHub);
  window.__game = game;
  game.startStage(stageIndex);
}

// 启动：显示档案选择界面
renderProfileList();
