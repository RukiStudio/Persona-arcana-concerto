// ============================================================
// 全屏粒子特效：打出攻击牌时按属性颜色爆发粒子
// 独立浮层挂到 document.body（不随战斗界面 transform 缩放），
// 极高 z-index + pointer-events:none，确保任何界面下都覆盖显示
// ============================================================
import { ELEMENT_INFO } from "./data.js?v=1";

let burstSeq = 0;

function ensureCanvas() {
  let canvas = document.getElementById("vfx-particle-burst");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "vfx-particle-burst";
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "2147483000";
    document.body.appendChild(canvas);
  }
  // 界面元素可能由 transform 缩放导致 body 尺寸变化，画布像素固定为视口大小
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  return { canvas, dpr };
}

/**
 * 播放一次全屏粒子爆发（颜色取自属性对应色）
 * @param {string} element 技能属性（ELEMENT.*），用于取 ELEMENT_INFO.color
 * @param {{color?:string, count?:number}} [opts]
 * @returns {HTMLCanvasElement|null}
 */
export function playElementBurst(element, opts = {}) {
  if (typeof document === "undefined") return null;
  const info = ELEMENT_INFO && ELEMENT_INFO[element];
  const color = opts.color || (info && info.color) || "#ffffff";
  const count = opts.count || 90;
  const seq = ++burstSeq;

  const { canvas, dpr } = ensureCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;

  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.12 + Math.random() * 0.5) * dpr;
    const spread = Math.random() * 0.9 + 0.4;
    particles.push({
      x: cx + (Math.random() - 0.5) * W * 0.12,
      y: cy + (Math.random() - 0.5) * H * 0.08,
      vx: Math.cos(angle) * speed * spread,
      vy: Math.sin(angle) * speed * spread,
      r: (1.5 + Math.random() * 3.5) * dpr,
      life: 1,
      decay: 0.008 + Math.random() * 0.014,
      alpha: 0.95,
      glow: Math.random() > 0.45, // 部分粒子带光晕
    });
  }

  const start = performance.now();
  const DURATION = 1000;

  function again() {
    // 已被清理（新的一次爆发覆盖时）则不继续画
    if (!document.body.contains(canvas)) return false;
    if (seq !== burstSeq) return false;
    return true;
  }

  function frame(now) {
    const t = now - start;
    if (t >= DURATION || !again()) {
      canvas.remove();
      return;
    }
    ctx.clearRect(0, 0, W, H);
    const alpha = 1 - t / DURATION;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.018 * dpr; // 轻微重力
      p.life -= p.decay;
      const a = Math.max(0, p.alpha * p.life) * alpha;
      if (a <= 0) continue;
      // 拖尾
      const tail = Math.min(12, 4 + Math.abs(p.vx + p.vy) * 25);
      const grad = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 3, p.y - p.vy * 3);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = grad;
      ctx.lineWidth = p.r * 0.9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * tail, p.y - p.vy * tail);
      ctx.stroke();

      if (p.glow) {
        ctx.globalAlpha = a * 0.28;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return canvas;
}