// ============================================================
// 游戏入口：初始化、缩放适配、Hub ↔ 战斗切换
// ============================================================
import { Game } from "./game.js?v=10";
import { UI } from "./ui.js?v=10";
import { MetaState } from "./meta.js?v=10";
import { Hub } from "./hub.js?v=10";

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

// 初始化 meta 状态
const meta = new MetaState();

// 全局状态
let game = null;
let ui = null;
let hub = null;

// 显示 Hub
function showHub() {
  document.getElementById("hub-screen").classList.remove("hidden");
  document.getElementById("game-root").classList.add("hidden");
  if (hub) hub.render();
}

// 显示战斗画面
function showBattle(stageIndex) {
  document.getElementById("hub-screen").classList.add("hidden");
  document.getElementById("game-root").classList.remove("hidden");
  fitScreen();
  game = new Game(meta);
  ui = new UI(game, showHub);
  window.__game = game;
  game.startStage(stageIndex);
}

// 启动 Hub
hub = new Hub(meta, (stageIndex) => {
  showBattle(stageIndex);
});
showHub();
