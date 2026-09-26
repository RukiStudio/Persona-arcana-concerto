// ============================================================
// 游戏入口：初始化、缩放适配、启动战斗
// ============================================================
import { Game } from "./game.js?v=5";
import { UI } from "./ui.js?v=5";

// 等比缩放适配
function fitScreen() {
  const root = document.getElementById("game-root");
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 1080;
  const scale = Math.min(scaleX, scaleY);
  root.style.transform = `scale(${scale})`;
  // 垂直居中
  const offset = (window.innerHeight - 1080 * scale) / 2;
  root.style.marginTop = offset > 0 ? offset + "px" : "0";
}
window.addEventListener("resize", fitScreen);

// 启动
const game = new Game();
const ui = new UI(game);
window.__game = game; // 便于调试

fitScreen();
game.startStage(0);
