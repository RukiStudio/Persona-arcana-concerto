// ============================================================
// UI 渲染与交互
// ============================================================
import {
  ELEMENT, ELEMENT_INFO, POWER_INFO, RANK_LABEL, CARD_TYPE, AFFINITY,
  ENVIRONMENT_INFO,
} from "./data.js?v=18";
import { getActiveSkill, calcBaseDamage } from "./core.js?v=18";
import { playElementBurst } from "./vfx.js?v=2";

export class UI {
  constructor(game, onReturnHub) {
    this.game = game;
    this.onReturnHub = onReturnHub || null;
    this.selectedCardId = null;
    // 移动端拖动 / 长按状态
    this._drag = null;               // 当前指针拖动状态
    this._lpTimer = null;            // 长按定时器
    this._suppressThisClick = false; // 拖动/长按后抑制下一次 click
    this._flipCooldownUntil = 0;     // 长按翻面冷却截止时间戳，避免连续逆位
    this.bindStatic();
    game.on((type, data) => this.handleEvent(type, data));
  }

  handleEvent(type, data) {
    switch (type) {
      case "log": this.addLog(data.msg, data.cls); break;
      case "enemyHit": this.onEnemyHit(data); break;
      case "playerHurt": this.onPlayerHurt(data); break;
      case "playerHeal": this.onPlayerHeal(data); break;
      case "battleEnd": this.showOverlay(data); break;
      case "enemyAttack": this.onEnemyAttack(data); break;
      case "enemyAct": break;
      case "waveStart": this.onWaveStart(data); break;
      case "tutorial": this.onTutorial(data); break;
      case "enemyDeath": this.onEnemyDeath(data); break;
      case "attackCardCreated": this.onAttackCardCreated(data); break;
      case "attackCardUsed": this.onAttackCardUsed(data); break;
    }
    this.render();
  }

  // 攻击牌生成：在手牌区播放红色脉冲特效
  onAttackCardCreated(data) {
    // render 会重建手牌，新攻击牌通过 .type-ATTACK.card-enter 触发生成动画
    // 额外：手牌区闪一下红光
    const handArea = document.getElementById("hand-area");
    if (handArea) {
      handArea.classList.remove("attack-flash");
      void handArea.offsetWidth; // 重排以重启动画
      handArea.classList.add("attack-flash");
    }
  }

  // 攻击牌使用：全屏属性颜色粒子特效
  onAttackCardUsed(data) {
    const skill = data && data.card && data.card.skill;
    playElementBurst(skill ? skill.element : null);
  }

  // 敌人被击杀动画：克隆敌人卡片到独立浮层播放动画，避免被 render 覆盖
  onEnemyDeath(data) {
    const cardEl = document.querySelector(`.enemy-card[data-id="${data.enemy.id}"]`);
    if (!cardEl) return;
    // 取得敌人卡片在视口的位置
    const rect = cardEl.getBoundingClientRect();
    // 克隆到独立浮层（body 直接子元素），脱离 enemy-list 重建影响
    const ghost = cardEl.cloneNode(true);
    ghost.classList.add("enemy-dying-ghost");
    ghost.style.position = "fixed";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.zIndex = "9000";
    ghost.style.pointerEvents = "none";
    ghost.style.margin = "0";
    ghost.style.opacity = "1"; // 重置透明度，避免继承原元素 0.3
    document.body.appendChild(ghost);
    // 触发动画
    requestAnimationFrame(() => ghost.classList.add("enemy-dying"));
    // 700ms 后清除浮层
    setTimeout(() => ghost.remove(), 750);
  }

  // 教程引导：根据 step 显示气泡提示
  onTutorial(data) {
    const tips = {
      1: { title: "① 构 筑 卡 牌", body: "★ 构筑规则：将人格面具卡拖入（或点击两次）下方 5 个构筑槽，\n合成更强的技能（按总力度×等级计算伤害）。\n\n现在请将「软泥怪」和「小宝剑」拖入（或点击两次放入）构筑槽", target: "#compose-slots" },
      2: { title: "② 生 成 攻 击 牌", body: "卡牌已入构筑槽！\n点击「CONFIRM」按钮，\n构筑牌将被消耗，生成一张红色的「攻击牌」加入手牌。\n★ 攻击牌可点击两次直接释放，造成对应的属性伤害", target: "#btn-confirm" },
      3: { title: "③ 释 放 攻 击 牌", body: "攻击牌已生成！\n点击两次手牌中红色边框的「攻击牌」，\n立即对敌人释放合成技能造成伤害。\n★ 攻击牌每回合结束自动消失，请及时使用", target: "#hand-area" },
      4: { title: "④ 抽 取 卡 牌", body: "已造成伤害！现在点击「DRAW」抽一张牌。\n★ 抽到的卡牌将决定下一步策略", target: "#btn-draw" },
      5: { title: "⑤ 翻 转 俄 耳 甫 斯", body: "★ 你抽到了俄耳甫斯！其逆位技能是「Agi（火焰）」\n点击俄耳甫斯选中后，按「FLIP」按钮翻转为逆位\n★ 敌人有火焰弱点（▼FIRE），逆位俄耳甫斯可造成双倍伤害并使其倒地", target: "#btn-flip" },
      6: { title: "⑥ 打 出 俄 耳 甫 斯", body: "再点一次逆位的俄耳甫斯，直接释放其火焰技能！\n★ 弱点命中将显示「WEAK!」并使敌人倒地\n★ 全部敌人倒地后可发动总攻击", target: "#hand-area" },
      7: { title: "⑦ 总 攻 击", body: "敌人已倒地！点击两次手牌中的「总攻击」卡，\n对全体敌人造成超大伤害！\n★ 总攻击有回合冷却，使用后解除倒地状态", target: "#hand-area" },
      8: { title: "⑧ 战 斗 胜 利", body: "击败所有敌人即可获胜！\n返回天鹅绒房间查看局外养成系统……", target: null },
    };
    const tip = tips[data.step];
    if (!tip) { this.hideTutorialTip(); return; }
    this.showTutorialTip(tip);
  }

  showTutorialTip(tip) {
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
    el.querySelector(".tutorial-tip-close").onclick = () => this.hideTutorialTip();
    el.classList.add("show");
    // 高亮目标元素
    document.querySelectorAll(".tutorial-highlight").forEach(n => n.classList.remove("tutorial-highlight"));
    if (tip.target) {
      const tgt = document.querySelector(tip.target);
      if (tgt) tgt.classList.add("tutorial-highlight");
    }
  }

  hideTutorialTip() {
    const el = document.getElementById("tutorial-tip");
    if (el) el.classList.remove("show");
    document.querySelectorAll(".tutorial-highlight").forEach(n => n.classList.remove("tutorial-highlight"));
  }

  // 敌人攻击动画：突进 + 属性色屏闪
  onEnemyAttack(data) {
    const { enemy, skill, heal } = data;
    const cardEl = document.querySelector(`.enemy-card[data-id="${enemy.id}"]`);
    if (!cardEl) return;
    if (heal !== undefined) {
      // 敌人恢复：绿色脉动
      cardEl.classList.add("heal-pulse");
      this.floatNumber(cardEl, "+" + heal, "var(--c-green)");
      setTimeout(() => cardEl.classList.remove("heal-pulse"), 600);
      return;
    }
    cardEl.classList.add("enemy-attacking");
    setTimeout(() => cardEl.classList.remove("enemy-attacking"), 500);
    // 属性色屏闪
    const el = skill?.element;
    if (el && ELEMENT_INFO[el]) {
      document.body.classList.add(`el-flash-${el}`);
      setTimeout(() => document.body.classList.remove(`el-flash-${el}`), 350);
    }
  }

  onWaveStart(data) {
    this.addLog(`▶ 新的暗影将你包围了！（第 ${data.waveIndex + 1}/${data.total} 波）`, "dmg");
    this.showFlashText("新的暗影将你包围了！", "var(--c-red)", 1600);
  }

  // 中央大字弹窗（WEAK/CRIT/波次切换等）
  showFlashText(text, color, duration = 1100) {
    let el = document.getElementById("flash-text");
    if (!el) {
      el = document.createElement("div");
      el.id = "flash-text";
      el.className = "flash-text";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.color = color;
    el.classList.remove("show");
    void el.offsetWidth; // 触发重排重启动画
    el.classList.add("show");
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => el.classList.remove("show"), duration);
  }

  bindStatic() {
    document.getElementById("btn-confirm").onclick = () => this.game.confirmCompose();
    document.getElementById("btn-clear").onclick = () => this.game.clearCompose();
    document.getElementById("btn-flip").onclick = () => this.tryFlip();
    document.getElementById("btn-draw").onclick = () => this.game.buyDraw();
    document.getElementById("btn-upgrade").onclick = () => this.game.upgradeDeck();
    document.getElementById("btn-end").onclick = () => this.game.endTurn();
    document.getElementById("overlay-btn").onclick = () => this.onOverlayContinue();
    document.getElementById("btn-hub-return").onclick = () => {
      if (this.onReturnHub) this.onReturnHub();
    };

    // 空格键：快速确认构筑（生成攻击牌）
    document.addEventListener("keydown", (e) => {
      if (e.code !== "Space") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return; // 输入框中不触发
      // 仅在战斗界面、玩家行动阶段、构筑槽非空时生效
      if (!this.game || this.game.state !== "PLAYER_ACTION") return;
      if (!this.game.composeSlots || this.game.composeSlots.length === 0) return;
      e.preventDefault();
      this.game.confirmCompose();
    });

    // 构建 5 个构筑槽，并设为拖放目标
    const slotsEl = document.getElementById("compose-slots");
    slotsEl.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.idx = i;
      slot.innerHTML = `<span class="slot-label">0${i + 1}</span>`;
      slot.onclick = () => this.game.removeFromCompose(i);
      slotsEl.appendChild(slot);
      if (i < 4) {
        const arrow = document.createElement("div");
        arrow.className = "slot-arrow";
        arrow.textContent = "→";
        slotsEl.appendChild(arrow);
      }
    }

    // 手牌区：拖拽目标由 Pointer Events 处理（见 attachCardPointer）
    const handArea = document.getElementById("hand-area");
    void handArea;
  }

  tryFlip() {
    if (!this.selectedCardId) { this.game.log("请先选择一张人格面具卡", "info"); return; }
    this.game.flipCard(this.selectedCardId);
  }

  render() {
    const g = this.game;
    // 状态栏
    document.getElementById("turn-num").textContent = String(g.turn).padStart(2, "0");
    document.getElementById("money-num").textContent = g.player.money;
    document.getElementById("deck-level").textContent = g.deckLevel;
    document.getElementById("hand-count").textContent = `${g.hand.length}/${g.handLimit}`;
    document.getElementById("arcana-name").textContent = `${g.arcana.name} Lv.${g.arcanaLv}`;
    document.getElementById("theurgy-fill").style.width = g.theurgy + "%";
    document.getElementById("theurgy-text").textContent = g.theurgy + "%";

    // 环境徽章区
    this.renderEnvironment();

    // 操作栏
    document.getElementById("player-hp-text").textContent = `${g.player.hp}/${g.player.maxHp}`;
    document.getElementById("player-hp-fill").style.width = (g.player.hp / g.player.maxHp * 100) + "%";
    document.getElementById("cup-stack").textContent = g.player.cupStack;
    document.getElementById("flip-remain").textContent = `${g.getReversedCount()}/${g.player.maxReversed}`;

    // 主角倒地状态
    document.getElementById("game-root").classList.toggle("player-knocked-down", !!g.player.is_knocked_down);
    // 主角相性徽章
    this.renderPlayerAffinities();

    const canAct = g.state === "PLAYER_ACTION";
    document.getElementById("btn-end").disabled = !canAct;
    document.getElementById("btn-confirm").disabled = !canAct || g.composeSlots.length === 0;
    document.getElementById("btn-clear").disabled = !canAct || g.composeSlots.length === 0;
    document.getElementById("btn-flip").disabled = !canAct;
    document.getElementById("btn-draw").disabled = !canAct;
    document.getElementById("btn-upgrade").disabled = !canAct;
    document.getElementById("btn-draw").textContent = `DRAW ¥${g.player.drawCost}`;
    const upCosts = [600, 1200, 2400, 4800];
    const baseCost = upCosts[g.deckLevel - 1] || 9999;
    // 计算回合折扣（与 game.js 逻辑一致）
    const discountTurns = Math.min(g.turn - g.lastUpgradeTurn - 1, 3);
    const discount = discountTurns <= 0 ? 0 : [0, 0.15, 0.30, 0.50][discountTurns];
    const cost = Math.round(baseCost * (1 - discount));
    const discountTag = discount > 0 ? ` (-${Math.round(discount * 100)}%)` : "";
    document.getElementById("btn-upgrade").textContent = g.deckLevel >= 5 ? "MAX" : `UPGRADE ¥${cost}${discountTag}`;

    this.renderEnemies();
    this.renderComposeSlots();
    this.renderResult();
    this.renderHand();

    // 背景特效：持有攻击牌+总攻击牌时变亮；神通法准备好时特效
    const root = document.getElementById("game-root");
    const hasAttack = g.hand.some(c => c.type === CARD_TYPE.ATTACK);
    const hasAllOut = g.hand.some(c => c.type === CARD_TYPE.ALL_OUT);
    const hasTheurgy = g.hand.some(c => c.type === CARD_TYPE.THEURGY);
    root.classList.toggle("has-attack-combo", hasAttack && hasAllOut);
    root.classList.toggle("theurgy-ready", hasTheurgy);
  }

  // 渲染局内减益环境徽章
  renderEnvironment() {
    const el = document.getElementById("env-badges");
    if (!el) return;
    const env = this.game.environment || [];
    if (!env.length) { el.innerHTML = ""; return; }
    el.innerHTML = env.map(key => {
      const info = ENVIRONMENT_INFO[key];
      if (!info) return "";
      return `<span class="env-badge" title="${info.desc}">${info.icon} ${info.name}</span>`;
    }).join("");
  }

  // 渲染主角相性徽章（弱点/耐性）
  renderPlayerAffinities() {
    const el = document.getElementById("player-affinities");
    if (!el) return;
    const affs = this.game.player.affinities || {};
    const entries = Object.entries(affs).filter(([, v]) => v !== AFFINITY.NORMAL);
    if (!entries.length) { el.innerHTML = '<span class="aff-hint">无特殊相性</span>'; return; }
    el.innerHTML = entries.map(([el2, v]) => {
      const info = ELEMENT_INFO[el2];
      const cls = v === AFFINITY.WEAK ? "aff-WEAK" : v === AFFINITY.RESIST ? "aff-RESIST" : "aff-NULL";
      const label = v === AFFINITY.WEAK ? "弱点" : v === AFFINITY.RESIST ? "耐性" : "无效";
      return `<span class="player-aff-badge ${cls}" title="${info?.name || el2} ${label}">${info ? info.icon : ""}${label}</span>`;
    }).join("");
  }

  renderEnemies() {
    const list = document.getElementById("enemy-list");
    list.innerHTML = "";
    this.game.enemies.forEach(e => {
      const card = document.createElement("div");
      card.className = "enemy-card";
      if (e.hp <= 0) card.style.opacity = "0.3";
      if (e.is_knocked_down && e.hp > 0) card.classList.add("knocked-down");
      if (this.game.targetEnemyId === e.id) card.classList.add("targeted");
      card.dataset.id = e.id;

      const intentIcon = e.intent ? (e.intent.element === "HEAL" || e.intent.element === "SUPPORT" ? "▲" : "▸") : "?";
      const intentName = e.intent ? `${e.intent.name} (${e.intent.range === "ALL" ? "ALL" : "SINGLE"})` : "UNKNOWN";

      // 相性角标：仅显示已揭示的属性（受对应属性伤害后才揭示；死亡后全部揭示）
      const revealed = e.revealedAffinities || new Set();
      const showAll = e.hp <= 0;
      const affs = Object.entries(e.affinities)
        .filter(([el, v]) => v !== AFFINITY.NORMAL && (showAll || revealed.has(el)))
        .map(([el, v]) => {
          const info = ELEMENT_INFO[el];
          return `<span class="aff-badge aff-${v}">${info ? info.icon : ""}${v}</span>`;
        }).join("");

      card.innerHTML = `
        <div class="enemy-top">
          <span>◆ SHADOW ◆</span>
          <span>Lv.${e.level}</span>
        </div>
        <div class="enemy-portrait">${e.icon}</div>
        <div class="enemy-name">${e.name.toUpperCase()}</div>
        <div class="enemy-hp-block">
          <div class="enemy-hp-bar"><div class="enemy-hp-fill" style="width:${e.hp / e.maxHp * 100}%"></div></div>
          <span class="enemy-hp-text">${e.hp}/${e.maxHp}</span>
        </div>
        <div class="affinity-row">${affs || '<span style="opacity:0.4;font-size:10px">未揭示</span>'}</div>
        <div class="enemy-intent">${intentIcon} ${intentName}</div>
      `;
      card.onclick = () => {
        if (e.hp > 0) { this.game.targetEnemyId = e.id; this.render(); }
      };
      list.appendChild(card);
    });
  }

  renderComposeSlots() {
    // 限定在主线构筑区内：AI 对战界面（#duel-screen）也使用 .slot 类名且常驻 DOM
    const slots = document.querySelectorAll("#compose-slots .slot");
    const prevSlotIds = new Set((this._prevSlotIds || []));
    const curSlotIds = [];
    slots.forEach((slot, i) => {
      const label = slot.querySelector(".slot-label");
      slot.innerHTML = "";
      slot.appendChild(label);
      const card = this.game.composeSlots[i];
      if (card) {
        curSlotIds.push(card.id);
        slot.classList.add("active");
        const mini = this.buildCardEl(card, true);
        // 新入槽的卡触发入场动画
        if (!prevSlotIds.has(card.id)) mini.classList.add("card-enter");
        // 槽内卡牌可拖回手牌（Pointer Events，兼容触屏）
        this.attachCardPointer(mini, card, true);
        // 右键也可翻转槽内的人格面具卡
        mini.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.game.flipCard(card.id);
        });
        slot.appendChild(mini);
      } else {
        slot.classList.remove("active");
      }
    });
    this._prevSlotIds = curSlotIds;
  }

  renderResult() {
    const skill = this.game.getEffectiveComposeSkill();
    const panel = document.getElementById("result-panel");
    const el = document.getElementById("result-element");
    const pw = document.getElementById("result-power");
    panel.classList.toggle("attack-preview", !!skill);
    if (skill) {
      const info = ELEMENT_INFO[skill.element];
      el.innerHTML = `<span class="el-${skill.element}">${info.icon} ${info.name} · ${skill.range}</span>`;
      const pinfo = POWER_INFO[skill.power];
      pw.textContent = `POWER: ${pinfo.name} (${pinfo.label})${skill.foolBonus ? " ★" : ""}`;
      // 伤害估算
      const target = this.game.targetEnemy();
      let base = calcBaseDamage(skill, this.game.player);
      document.getElementById("result-base").textContent = base;
      // 圣杯加成：基础 0.4/层；女皇阵营按等级再放大
      const p = this.game.player;
      const cupScale = p.arcanaBonus === "CUP_DOUBLE" ? ([1.5, 2.0, 2.5][(p.arcanaLv || 1) - 1] || 1.5) : 1;
      const cup = 1 + 0.4 * (p.cupStack || 0) * cupScale;
      document.getElementById("result-cup").textContent = `×${cup.toFixed(2)}`;
      // 最终估算（取目标相性）
      let final = base * cup;
      if (target) {
        const aff = target.affinities[skill.element] ?? "NORMAL";
        const mult = { WEAK: 1.5, NORMAL: 1.0, RESIST: 0.5, NULL: 0, REPEL: 1, DRAIN: 1 }[aff] || 1;
        final *= mult;
        if (target.is_knocked_down) final *= 1.25;
      }
      document.getElementById("result-final").textContent = Math.round(final);
      document.getElementById("result-chain").textContent = `${this.game.composeSlots.length} CARDS`;
    } else {
      el.textContent = "— —";
      pw.textContent = "POWER: —";
      document.getElementById("result-base").textContent = "0";
      document.getElementById("result-cup").textContent = "×1.0";
      document.getElementById("result-final").textContent = "0";
      document.getElementById("result-chain").textContent = "0 CARDS";
    }
  }

  renderHand() {
    const list = document.getElementById("hand-list");
    // 记录上一帧手牌 id，新出现的卡触发入场动画
    const prevIds = new Set((this._prevHandIds || []));
    const curIds = [];
    list.innerHTML = "";
    this.game.hand.forEach(card => {
      curIds.push(card.id);
      const el = this.buildCardEl(card, false);
      if (this.selectedCardId === card.id) el.classList.add("selected");
      // 新抽到的卡触发入场动画
      if (!prevIds.has(card.id)) el.classList.add("card-enter");

      // 拖动：将卡牌拖入构筑槽（Pointer Events，兼容鼠标+触屏）
      this.attachCardPointer(el, card, false);

      // 单击选中 / 再次点击使用（辅助卡直接发动，人格面具/宝剑入槽）
      el.addEventListener("click", () => this.onHandCardClick(card));

      // 右键翻转人格面具卡
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.game.flipCard(card.id);
      });

      list.appendChild(el);
    });
    this._prevHandIds = curIds;
  }

  // 单击选中 / 再次点击使用（移动端友好，替代双击）
  onHandCardClick(card) {
    // 拖动或长按后产生的 click 直接忽略
    if (this._suppressThisClick) { this._suppressThisClick = false; return; }
    if (this.selectedCardId === card.id) {
      this.useSelectedCard(card);
    } else {
      this.selectedCardId = card.id;
      this.render();
    }
  }

  // 使用当前卡牌（选中后再次点击触发）
  useSelectedCard(card) {
    this.selectedCardId = card.id;
    const t = card.type;
    // 打出动画：克隆一张浮起消散（原元素会被 re-render 销毁）
    this.playCardFx(card);
    // 辅助卡（权杖/圣杯/星币/总攻击/神通法/攻击牌）直接使用
    if (t === CARD_TYPE.WAND || t === CARD_TYPE.CUP || t === CARD_TYPE.PENTACLE) {
      this.game.useMinorCard(card);
    } else if (t === CARD_TYPE.ALL_OUT) {
      this.game.useAllOut(card);
    } else if (t === CARD_TYPE.THEURGY) {
      this.game.useTheurgy(card);
    } else if (t === CARD_TYPE.ATTACK) {
      this.game.useAttackCard(card);
    } else {
      // 人格面具 / 宝剑：双击直接加入构筑槽
      // 教程 step 6：双击逆位俄耳甫斯直接释放技能（火焰弱点）
      if (this.game.isTutorial && this.game.tutorialStep === 6
          && card.cardKey === "orpheus" && card.is_reversed) {
        this.game.usePersonaDirect(card);
      } else {
        this.game.addToCompose(card.id);
      }
    }
  }

  // 卡牌指针交互：拖动（入槽/回手牌）+ 长按翻面（移动端替代右键）
  attachCardPointer(el, card, inSlot) {
    const game = this.game;

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      this._suppressThisClick = false;
      const pid = e.pointerId;

      // 长按翻面（仅人格面具卡，带冷却避免连续逆位）
      clearTimeout(this._lpTimer);
      this._lpTimer = setTimeout(() => {
        this._suppressThisClick = true;
        if (card.type === CARD_TYPE.PERSONA) {
          const now = Date.now();
          if (now >= this._flipCooldownUntil) {
            this._flipCooldownUntil = now + 800; // 800ms 内不再响应长按翻面
            game.flipCard(card.id);
          }
        }
      }, 500);

      this._drag = { x: e.clientX, y: e.clientY, active: false, pid, inSlot };
    });

    el.addEventListener("pointermove", (e) => {
      const d = this._drag;
      if (!d || e.pointerId !== d.pid) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.active && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        d.active = true;
        clearTimeout(this._lpTimer);
        this._suppressThisClick = true;
        try { el.setPointerCapture(d.pid); } catch (_) {}
        el.classList.add("dragging");
      }
      if (d.active) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const slot = under && under.closest ? under.closest("#compose-slots .slot") : null;
        document.querySelectorAll("#compose-slots .slot.drag-over").forEach(s => s.classList.remove("drag-over"));
        if (slot) slot.classList.add("drag-over");
      }
    });

    const finish = (e) => {
      const d = this._drag;
      clearTimeout(this._lpTimer);
      if (d && d.active && e.pointerId === d.pid) {
        el.classList.remove("dragging");
        document.querySelectorAll("#compose-slots .slot.drag-over").forEach(s => s.classList.remove("drag-over"));
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const slot = under && under.closest ? under.closest("#compose-slots .slot") : null;
        if (inSlot) {
          // 从构筑槽拖回手牌
          const ha = document.getElementById("hand-area");
          if (under && ha && (under === ha || ha.contains(under))) {
            const idx = game.composeSlots.findIndex(c => c && c.id === card.id);
            if (idx >= 0) game.removeFromCompose(idx);
          }
        } else if (slot) {
          game.addToCompose(card.id);
        }
      }
      this._drag = null;
    };
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
  }

  // 打出卡牌的视觉特效：克隆元素上飘消散
  playCardFx(card) {
    const src = document.querySelector(`.card[data-id="${card.id}"]`);
    if (!src) return;
    const rect = src.getBoundingClientRect();
    const clone = src.cloneNode(true);
    clone.classList.add("card-played-fx");
    clone.style.position = "absolute";
    clone.style.left = rect.left + "px";
    clone.style.top = rect.top + "px";
    clone.style.width = rect.width + "px";
    clone.style.height = rect.height + "px";
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "60";
    clone.style.margin = "0";
    document.body.appendChild(clone);
    setTimeout(() => clone.remove(), 700);
  }

  buildCardEl(card, mini) {
    const el = document.createElement("div");
    el.className = `card type-${card.type}`;
    const isReversed = card.type === CARD_TYPE.PERSONA && card.is_reversed;
    if (isReversed) el.classList.add("reversed");
    if (mini) el.classList.add("in-slot");
    el.dataset.id = card.id;

    const skill = getActiveSkill(card);
    const info = skill ? ELEMENT_INFO[skill.element] : null;
    const rankLabel = card.rank ? RANK_LABEL[card.rank] : "";
    const powerLabel = skill ? POWER_INFO[skill.power].label : "";

    // 人格面具卡：同时显示正位和逆位技能
    let skillsHtml = "";
    if (card.type === CARD_TYPE.PERSONA) {
      const up = card.skill_upright;
      const rev = card.skill_reversed;
      const upInfo = ELEMENT_INFO[up.element];
      const revInfo = ELEMENT_INFO[rev.element];
      const upActive = !card.is_reversed;
      skillsHtml = `
        <div class="card-skills">
          <div class="skill-line ${upActive ? "active" : "dim"}">
            <span class="orient-mark">▲</span>
            <span class="el-${up.element}">${upInfo.icon}${upInfo.name}·${up.range === "ALL" ? "ALL" : "SGL"}</span>
            <span class="pw">${POWER_INFO[up.power].label}</span>
          </div>
          <div class="skill-line ${!upActive ? "active" : "dim"}">
            <span class="orient-mark">▼</span>
            <span class="el-${rev.element}">${revInfo.icon}${revInfo.name}·${rev.range === "ALL" ? "ALL" : "SGL"}</span>
            <span class="pw">${POWER_INFO[rev.power].label}</span>
          </div>
        </div>
      `;
    } else if (skill) {
      const sName = skill.name || `${info.name}攻击`;
      skillsHtml = `<div class="card-skill el-${skill.element}">${info.icon} ${sName} · ${skill.range === "ALL" ? "ALL" : "SGL"}</div>`;
    }

    const orient = card.type === CARD_TYPE.PERSONA
      ? `<div class="card-orient ${card.is_reversed ? "reversed" : ""}">${card.is_reversed ? "▼ REVERSED" : "▲ UPRIGHT"}</div>`
      : "";

    // 卡牌介绍 tooltip 内容
    let tooltipText = `${card.name}`;
    if (card.type === CARD_TYPE.PERSONA) {
      tooltipText += ` (${card.arcana || "?"} ${rankLabel || ""})`;
      const up = card.skill_upright, rev = card.skill_reversed;
      tooltipText += `\n▲正位: ${up.name} [${POWER_INFO[up.power].label}] ${up.range === "ALL" ? "全体" : "单体"}`;
      tooltipText += `\n▼逆位: ${rev.name} [${POWER_INFO[rev.power].label}] ${rev.range === "ALL" ? "全体" : "单体"}`;
      tooltipText += `\n再次点击使用当前朝向技能，或加入构筑槽合成`;
    } else if (skill) {
      tooltipText += `\n${skill.name} [${powerLabel}] ${skill.range === "ALL" ? "全体" : "单体"}`;
      tooltipText += `\n小阿尔卡那：再次点击立即生效`;
    } else if (card.type === CARD_TYPE.ALL_OUT) {
      tooltipText += `\n总攻击：全体大伤害\n需敌人全部倒地后获得`;
    } else if (card.type === CARD_TYPE.THEURGY) {
      tooltipText += `\n神通法：强力一击\n神通法槽满后可用`;
    } else if (card.type === CARD_TYPE.ATTACK) {
      tooltipText += `\n${info.name}属性 [${powerLabel}] ${skill.range === "ALL" ? "全体" : "单体"}\n攻击牌：再次点击直接释放伤害，每回合结束后消失`;
    }
    el.title = tooltipText;

    // 逆位时内部内容再次旋转（便于阅读）
    const innerWrap = isReversed ? `<div class="card-inner-rotate">` : "";
    const innerClose = isReversed ? `</div>` : "";

    el.innerHTML = `
      ${rankLabel ? `<span class="card-rank rank-${rankLabel}">${rankLabel}</span>` : ""}
      ${innerWrap}
      <div class="card-art">${card.icon}</div>
      <div class="card-divider"></div>
      <div class="card-name">${card.name}</div>
      ${skillsHtml}
      <div class="card-footer">
        ${skill ? `<span class="el-${skill.element}">${powerLabel}</span>` : ""}
        <span>${card.type === CARD_TYPE.PERSONA ? "PERSONA" : card.type}</span>
      </div>
      ${orient}
      ${innerClose}
      ${card.type === CARD_TYPE.ATTACK ? `<span class="attack-shockwave"></span>` : ""}
    `;
    return el;
  }

  // ---------- 事件视觉反馈 ----------
  // 浮动数字按相性/属性染色：弱点=金、耐性=灰、暴击=金、普通=红、吸收=紫
  onEnemyHit(data) {
    const { enemy, dmg, crit, repel, drain, affinity } = data;
    const cardEl = document.querySelector(`.enemy-card[data-id="${enemy.id}"]`);
    if (!cardEl) return;
    cardEl.classList.add("hit-flash");
    setTimeout(() => cardEl.classList.remove("hit-flash"), 300);
    // 弱点命中弹窗
    if (affinity === AFFINITY.WEAK && dmg > 0) {
      this.showFlashText("WEAK!", "var(--c-gold)");
    } else if (crit && dmg > 0) {
      this.showFlashText("CRIT!", "var(--c-gold)");
    }
    if (dmg > 0) {
      let color = "var(--c-red)";
      if (crit) color = "var(--c-gold)";
      else if (affinity === AFFINITY.WEAK) color = "#ff5722";
      else if (affinity === AFFINITY.RESIST) color = "#9e9e9e";
      this.floatNumber(cardEl, dmg, color);
    }
    if (repel) this.floatNumber(cardEl, "REPEL", "var(--c-purple)");
    if (drain) this.floatNumber(cardEl, "DRAIN", "var(--c-green)");
  }

  onPlayerHurt(dmg) {
    const root = document.getElementById("game-root");
    root.classList.add("shake");
    setTimeout(() => root.classList.remove("shake"), 400);
  }

  onPlayerHeal(amt) {
    const hpBar = document.querySelector(".hp-block");
    if (!hpBar) return;
    // HP 条绿色脉动
    const fill = hpBar.querySelector(".hp-fill");
    if (fill) {
      fill.classList.add("heal-pulse");
      setTimeout(() => fill.classList.remove("heal-pulse"), 600);
    }
    if (amt > 0) this.floatNumber(hpBar, "+" + amt, "var(--c-green)");
  }

  floatNumber(parent, text, color) {
    const n = document.createElement("div");
    n.className = "float-num";
    n.textContent = text;
    n.style.color = color;
    const rect = parent.getBoundingClientRect();
    n.style.left = (rect.left + rect.width / 2) + "px";
    n.style.top = (rect.top + 20) + "px";
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 1200);
  }

  addLog(msg, cls = "info") {
    const log = document.getElementById("battle-log");
    const entry = document.createElement("div");
    entry.className = `log-entry log-${cls}`;
    entry.textContent = msg;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    while (log.children.length > 40) log.removeChild(log.firstChild);
  }

  showOverlay(data) {
    const { victory, reward } = data;
    const ov = document.getElementById("overlay");
    ov.classList.remove("hidden");
    const content = ov.querySelector(".overlay-content");
    content.classList.toggle("defeat", !victory);
    document.getElementById("overlay-title").textContent = victory ? "VICTORY" : "DEFEAT";
    let desc = victory
      ? "所有暗影已被驱散，返回天鹅绒房间查看养成。"
      : "你倒下了……";
    // 胜利时显示奖励
    if (victory && reward) {
      desc = `获得奖励：EXP +${reward.exp}　◈ +${reward.money} 精魄`;
    }
    document.getElementById("overlay-desc").textContent = desc;
    document.getElementById("overlay-btn").textContent = victory ? "返回房间" : "重试";
    this.hideTutorialTip();
  }

  onOverlayContinue() {
    const g = this.game;
    document.getElementById("overlay").classList.add("hidden");
    // 无论胜利或失败，结算后一律返回 Hub
    // （旧版本用 g.state !== "BATTLE_END" 提前返回会导致按钮无反应）
    if (this.onReturnHub) {
      this.onReturnHub();
    } else {
      // 兜底：若未提供返回回调，强制切换显示
      document.getElementById("hub-screen").classList.remove("hidden");
      document.getElementById("game-root").classList.add("hidden");
    }
  }
}
