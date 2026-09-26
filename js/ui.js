// ============================================================
// UI 渲染与交互
// ============================================================
import {
  ELEMENT, ELEMENT_INFO, POWER_INFO, RANK_LABEL, CARD_TYPE, AFFINITY,
} from "./data.js?v=4";
import { getActiveSkill, calcBaseDamage } from "./core.js?v=4";

export class UI {
  constructor(game) {
    this.game = game;
    this.selectedCardId = null;
    this.clickTimer = null; // 区分单击/双击
    this.bindStatic();
    game.on((type, data) => this.handleEvent(type, data));
  }

  handleEvent(type, data) {
    switch (type) {
      case "log": this.addLog(data.msg, data.cls); break;
      case "enemyHit": this.onEnemyHit(data); break;
      case "playerHurt": this.onPlayerHurt(data); break;
      case "playerHeal": this.onPlayerHeal(data); break;
      case "battleEnd": this.showOverlay(data.victory); break;
      case "enemyAct": break;
    }
    this.render();
  }

  bindStatic() {
    document.getElementById("btn-confirm").onclick = () => this.game.confirmCompose();
    document.getElementById("btn-clear").onclick = () => this.game.clearCompose();
    document.getElementById("btn-flip").onclick = () => this.tryFlip();
    document.getElementById("btn-draw").onclick = () => this.game.buyDraw();
    document.getElementById("btn-upgrade").onclick = () => this.game.upgradeDeck();
    document.getElementById("btn-end").onclick = () => this.game.endTurn();
    document.getElementById("overlay-btn").onclick = () => this.nextStage();

    // 构建 5 个构筑槽，并设为拖放目标
    const slotsEl = document.getElementById("compose-slots");
    slotsEl.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.idx = i;
      slot.innerHTML = `<span class="slot-label">0${i + 1}</span>`;
      slot.onclick = () => this.game.removeFromCompose(i);
      // 拖放：允许将手牌拖入构筑槽
      slot.addEventListener("dragover", (e) => {
        e.preventDefault();
        slot.classList.add("drag-over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        slot.classList.remove("drag-over");
        const cardId = e.dataTransfer.getData("text/plain");
        if (cardId) this.game.addToCompose(cardId);
      });
      slotsEl.appendChild(slot);
      if (i < 4) {
        const arrow = document.createElement("div");
        arrow.className = "slot-arrow";
        arrow.textContent = "→";
        slotsEl.appendChild(arrow);
      }
    }

    // 手牌区作为拖放目标：可将构筑槽中的卡拖回手牌
    const handArea = document.getElementById("hand-area");
    handArea.addEventListener("dragover", (e) => e.preventDefault());
    handArea.addEventListener("drop", (e) => {
      e.preventDefault();
      const cardId = e.dataTransfer.getData("text/plain");
      if (!cardId) return;
      // 若该卡位于构筑槽中，则移回手牌
      const idx = this.game.composeSlots.findIndex(c => c && c.id === cardId);
      if (idx >= 0) this.game.removeFromCompose(idx);
    });
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
    document.getElementById("arcana-name").textContent = g.arcana.name;
    document.getElementById("theurgy-fill").style.width = g.theurgy + "%";
    document.getElementById("theurgy-text").textContent = g.theurgy + "%";

    // 操作栏
    document.getElementById("player-hp-text").textContent = `${g.player.hp}/${g.player.maxHp}`;
    document.getElementById("player-hp-fill").style.width = (g.player.hp / g.player.maxHp * 100) + "%";
    document.getElementById("cup-stack").textContent = g.player.cupStack;
    document.getElementById("flip-remain").textContent = `${g.getReversedCount()}/${g.player.maxReversed}`;

    const canAct = g.state === "PLAYER_ACTION";
    document.getElementById("btn-end").disabled = !canAct;
    document.getElementById("btn-confirm").disabled = !canAct || g.composeSlots.length === 0;
    document.getElementById("btn-clear").disabled = !canAct || g.composeSlots.length === 0;
    document.getElementById("btn-flip").disabled = !canAct;
    document.getElementById("btn-draw").disabled = !canAct;
    document.getElementById("btn-upgrade").disabled = !canAct;
    document.getElementById("btn-draw").textContent = `DRAW ¥${g.player.drawCost}`;
    const upCosts = [500, 1000, 2000, 4000];
    document.getElementById("btn-upgrade").textContent = g.deckLevel >= 5 ? "MAX" : `UPGRADE ¥${upCosts[g.deckLevel - 1]}`;

    this.renderEnemies();
    this.renderComposeSlots();
    this.renderResult();
    this.renderHand();
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

      // 相性角标
      const affs = Object.entries(e.affinities)
        .filter(([, v]) => v !== AFFINITY.NORMAL)
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
        <div class="affinity-row">${affs || '<span style="opacity:0.4;font-size:10px">无弱点</span>'}</div>
        <div class="enemy-intent">${intentIcon} ${intentName}</div>
      `;
      card.onclick = () => {
        if (e.hp > 0) { this.game.targetEnemyId = e.id; this.render(); }
      };
      list.appendChild(card);
    });
  }

  renderComposeSlots() {
    const slots = document.querySelectorAll(".slot");
    slots.forEach((slot, i) => {
      const label = slot.querySelector(".slot-label");
      slot.innerHTML = "";
      slot.appendChild(label);
      const card = this.game.composeSlots[i];
      if (card) {
        slot.classList.add("active");
        const mini = this.buildCardEl(card, true);
        // 槽内卡牌可拖回手牌
        mini.draggable = true;
        mini.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", card.id);
          e.dataTransfer.effectAllowed = "move";
        });
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
  }

  renderResult() {
    const skill = this.game.getEffectiveComposeSkill();
    const el = document.getElementById("result-element");
    const pw = document.getElementById("result-power");
    if (skill) {
      const info = ELEMENT_INFO[skill.element];
      el.innerHTML = `<span class="el-${skill.element}">${info.icon} ${info.name} · ${skill.range}</span>`;
      const pinfo = POWER_INFO[skill.power];
      pw.textContent = `POWER: ${pinfo.name} (${pinfo.label})${skill.foolBonus ? " ★" : ""}`;
      // 伤害估算
      const target = this.game.targetEnemy();
      let base = calcBaseDamage(skill, this.game.player);
      document.getElementById("result-base").textContent = base;
      const cup = 1 + 0.5 * this.game.player.cupStack;
      document.getElementById("result-cup").textContent = `×${cup.toFixed(1)}`;
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
    list.innerHTML = "";
    this.game.hand.forEach(card => {
      const el = this.buildCardEl(card, false);
      if (this.selectedCardId === card.id) el.classList.add("selected");

      // 拖动：将卡牌拖入构筑槽
      el.draggable = true;
      el.addEventListener("dragstart", (e) => {
        if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));

      // 单击选中 / 双击使用（辅助卡直接发动，人格面具/宝剑入槽）
      el.addEventListener("click", () => this.onHandCardClick(card));

      // 右键翻转人格面具卡
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.game.flipCard(card.id);
      });

      list.appendChild(el);
    });
  }

  // 区分单击（选中）与双击（使用）
  onHandCardClick(card) {
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
      this.onHandCardDblClick(card);
    } else {
      this.clickTimer = setTimeout(() => {
        this.clickTimer = null;
        this.onHandCardSingleClick(card);
      }, 250);
    }
  }

  onHandCardSingleClick(card) {
    this.selectedCardId = card.id;
    this.render();
  }

  onHandCardDblClick(card) {
    this.selectedCardId = card.id;
    const t = card.type;
    // 辅助卡（权杖/圣杯/星币/总攻击/神通法）双击直接使用
    if (t === CARD_TYPE.WAND || t === CARD_TYPE.CUP || t === CARD_TYPE.PENTACLE) {
      this.game.useMinorCard(card);
    } else if (t === CARD_TYPE.ALL_OUT) {
      this.game.useAllOut(card);
    } else if (t === CARD_TYPE.THEURGY) {
      this.game.useTheurgy(card);
    } else {
      // 人格面具 / 宝剑：双击直接加入构筑槽
      this.game.addToCompose(card.id);
    }
  }

  buildCardEl(card, mini) {
    const el = document.createElement("div");
    el.className = `card type-${card.type}`;
    if (card.type === CARD_TYPE.PERSONA && card.is_reversed) el.classList.add("reversed");
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
      skillsHtml = `<div class="card-skill el-${skill.element}">${info.icon} ${skill.name} · ${skill.range === "ALL" ? "ALL" : "SGL"}</div>`;
    }

    const orient = card.type === CARD_TYPE.PERSONA
      ? `<div class="card-orient ${card.is_reversed ? "reversed" : ""}">${card.is_reversed ? "▼ REVERSED" : "▲ UPRIGHT"}</div>`
      : "";

    el.innerHTML = `
      ${rankLabel ? `<span class="card-rank rank-${rankLabel}">${rankLabel}</span>` : ""}
      <div class="card-art">${card.icon}</div>
      <div class="card-divider"></div>
      <div class="card-name">${card.name}</div>
      ${skillsHtml}
      <div class="card-footer">
        ${skill ? `<span class="el-${skill.element}">${powerLabel}</span>` : ""}
        <span>${card.type === CARD_TYPE.PERSONA ? "PERSONA" : card.type}</span>
      </div>
      ${orient}
    `;
    return el;
  }

  // ---------- 事件视觉反馈 ----------
  onEnemyHit(data) {
    const { enemy, dmg, crit, repel, drain } = data;
    const cardEl = document.querySelector(`.enemy-card[data-id="${enemy.id}"]`);
    if (!cardEl) return;
    cardEl.classList.add("hit-flash");
    setTimeout(() => cardEl.classList.remove("hit-flash"), 300);
    if (dmg > 0) this.floatNumber(cardEl, dmg, crit ? "var(--c-gold)" : "var(--c-red)");
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

  showOverlay(victory) {
    const ov = document.getElementById("overlay");
    ov.classList.remove("hidden");
    const content = ov.querySelector(".overlay-content");
    content.classList.toggle("defeat", !victory);
    document.getElementById("overlay-title").textContent = victory ? "VICTORY" : "DEFEAT";
    document.getElementById("overlay-desc").textContent = victory
      ? "所有暗影已被驱散。" : "你倒下了……";
    const isLast = this.game.stageIndex >= 2;
    document.getElementById("overlay-btn").textContent = victory ? (isLast ? "GAME CLEAR" : "NEXT STAGE") : "RETRY";
  }

  nextStage() {
    const g = this.game;
    document.getElementById("overlay").classList.add("hidden");
    if (g.state !== "BATTLE_END") return;
    if (g.player.hp <= 0) {
      g.player.hp = g.player.maxHp;
    }
    let next = g.stageIndex;
    if (g.player.hp > 0 && g.stageIndex < 2) next = g.stageIndex + 1;
    g.startStage(next);
  }
}
