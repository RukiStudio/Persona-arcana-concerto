// ============================================================
// 局外养成 Hub 界面：关卡选择、图鉴、合体、属性、阵营、商店
// ============================================================
import {
  PERSONAS, ARCANA, ARCANA_LIST, STAGES, SHOP_ITEMS,
  ELEMENT_INFO, POWER_INFO, RANK_LABEL, RANK, AFFINITY, ELEMENT,
  STAT_UPGRADE_COSTS, STAT_INCREMENTS, EXP_CURVE, MAX_PLAYER_LEVEL,
} from "./data.js?v=15";
import { MetaState } from "./meta.js?v=15";
import { getFusionResult, executeFusion, getAvailableFusions } from "./fusion.js?v=15";

export class Hub {
  constructor(meta, onEnterStage) {
    this.meta = meta;
    this.onEnterStage = onEnterStage; // callback(stageIndex)
    this.activeTab = "stages";
    this.fusionSelA = null;
    this.fusionSelB = null;
    this.bindTabs();
    this.render();
  }

  bindTabs() {
    document.querySelectorAll(".hub-tab").forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll(".hub-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeTab = tab.dataset.tab;
        this.render();
      };
    });
  }

  render() {
    this.renderHeader();
    const content = document.getElementById("hub-content");
    content.innerHTML = "";
    switch (this.activeTab) {
      case "stages": this.renderStages(content); break;
      case "compendium": this.renderCompendium(content); break;
      case "fusion": this.renderFusion(content); break;
      case "stats": this.renderStats(content); break;
      case "arcana": this.renderArcana(content); break;
      case "shop": this.renderShop(content); break;
    }
  }

  renderHeader() {
    document.getElementById("hub-level").textContent = this.meta.playerLevel;
    const prog = this.meta.getExpProgress();
    document.getElementById("hub-exp-fill").style.width = prog.pct + "%";
    document.getElementById("hub-exp-text").textContent = prog.cur >= prog.next && this.meta.playerLevel >= MAX_PLAYER_LEVEL ? "MAX" : `${prog.cur}/${prog.next}`;
    document.getElementById("hub-money").textContent = this.meta.money;
    document.getElementById("hub-stat-points").textContent = this.meta.statPoints;
    document.getElementById("hub-arcana").textContent = this.meta.getArcana().name;
  }

  // ==================== 关卡选择 ====================
  renderStages(container) {
    const html = `
      <div class="hub-section">
        <h2 class="hub-section-title">选择出击关卡</h2>
        <div class="stage-grid">
          ${STAGES.map((s, i) => {
            const cleared = this.meta.isStageCleared(s.id);
            const next = i === this.meta.getNextStage();
            const locked = i > 0 && !this.meta.isStageCleared(STAGES[i-1].id);
            const isTut = s.isTutorial;
            return `
              <div class="stage-card ${cleared ? "cleared" : ""} ${locked ? "locked" : ""} ${next ? "next" : ""} ${isTut ? "tutorial" : ""}"
                   data-idx="${i}">
                <div class="stage-header">
                  <span class="stage-id">${isTut ? "TUT" : "CH." + s.id}</span>
                  ${cleared ? '<span class="stage-cleared-tag">✓ CLEAR</span>' : ""}
                  ${locked ? '<span class="stage-locked-tag">🔒 LOCKED</span>' : ""}
                  ${isTut && !cleared ? '<span class="stage-tut-tag">📚 推荐</span>' : ""}
                </div>
                <div class="stage-name">${s.name}</div>
                <div class="stage-info">
                  <span>敌人: ${s.enemies.map(k => PERSONAS[k] ? PERSONAS[k].name : k).join(", ")}</span>
                  <span>推荐等级: Lv.${s.recommendedLevel}</span>
                </div>
                <div class="stage-reward">
                  <span>EXP ${s.reward.exp}</span>
                  <span>◈${s.reward.money}</span>
                </div>
                ${!locked ? `<button class="cut-btn confirm stage-enter-btn" data-idx="${i}">${isTut ? "开始教学" : "出 击"}</button>` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
    container.innerHTML = html;
    container.querySelectorAll(".stage-enter-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        this.onEnterStage(idx);
      };
    });
  }

  // ==================== 人格面具图鉴 ====================
  renderCompendium(container) {
    const list = this.meta.getCompendiumList();
    const html = `
      <div class="hub-section">
        <h2 class="hub-section-title">人格面具图鉴（${list.filter(p => p.seen).length}/${list.length}）</h2>
        <div class="compendium-grid">
          ${list.map(p => {
            if (!p.seen) {
              return `<div class="comp-card locked"><div class="comp-icon">❓</div><div class="comp-name">???</div></div>`;
            }
            const affHtml = Object.entries(p.affinities || {})
              .filter(([, v]) => v !== AFFINITY.NORMAL)
              .map(([el, v]) => {
                const info = ELEMENT_INFO[el];
                return `<span class="aff-badge aff-${v}">${info ? info.icon : ""}${v}</span>`;
              }).join("");
            return `
              <div class="comp-card ${p.unlocked ? "unlocked" : "seen-only"}" rank="${RANK_LABEL[p.rank]}">
                <span class="card-rank rank-${RANK_LABEL[p.rank]}">${RANK_LABEL[p.rank]}</span>
                <div class="comp-icon">${p.icon}</div>
                <div class="comp-name">${p.name}</div>
                <div class="comp-arcana">${ARCANA[p.arcana]?.name ?? p.arcana} · Lv.${p.level}</div>
                <div class="comp-affinities">${affHtml || '<span class="no-aff">无特殊相性</span>'}</div>
                <div class="comp-skills">
                  <div class="comp-skill">▲ ${ELEMENT_INFO[p.upright.element]?.icon ?? ""} ${p.upright.name}</div>
                  <div class="comp-skill">▼ ${ELEMENT_INFO[p.reversed.element]?.icon ?? ""} ${p.reversed.name}</div>
                </div>
                ${p.unlocked ? '<div class="comp-status unlocked-tag">已解锁</div>' : '<div class="comp-status locked-tag">未解锁</div>'}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
    container.innerHTML = html;
  }

  // ==================== 合体召唤 ====================
  renderFusion(container) {
    const unlocked = this.meta.getUnlockedList();
    const fusions = getAvailableFusions(this.meta);

    container.innerHTML = `
      <div class="hub-section">
        <h2 class="hub-section-title">人格面具合体 · 天鹅绒房间</h2>
        <div class="fusion-layout">
          <div class="fusion-panel">
            <div class="fusion-slots">
              <div class="fusion-slot" id="fusion-slot-a">
                <span class="fusion-slot-label">素材 A</span>
                <div class="fusion-slot-content" id="fusion-content-a">— 未选择 —</div>
              </div>
              <div class="fusion-plus">+</div>
              <div class="fusion-slot" id="fusion-slot-b">
                <span class="fusion-slot-label">素材 B</span>
                <div class="fusion-slot-content" id="fusion-content-b">— 未选择 —</div>
              </div>
              <div class="fusion-arrow">→</div>
              <div class="fusion-result-preview" id="fusion-result-preview">
                <span class="fusion-slot-label">结果预览</span>
                <div class="fusion-preview-content" id="fusion-preview-content">选择两个素材</div>
              </div>
            </div>
            <button id="btn-fusion-execute" class="cut-btn confirm" disabled>执 行 合 体</button>
            <div id="fusion-message" class="fusion-message"></div>
          </div>
          <div class="fusion-material-list">
            <h3>可用素材</h3>
            <div class="fusion-material-grid" id="fusion-material-grid">
              ${unlocked.map(key => {
                const p = PERSONAS[key];
                return `<div class="fusion-material ${this.fusionSelA === key ? "sel-a" : ""} ${this.fusionSelB === key ? "sel-b" : ""}" data-key="${key}">
                  <span class="card-rank rank-${RANK_LABEL[p.rank]}">${RANK_LABEL[p.rank]}</span>
                  <span class="comp-icon-sm">${p.icon}</span>
                  <span class="comp-name-sm">${p.name}</span>
                  <span class="comp-arcana-sm">${ARCANA[p.arcana]?.name}</span>
                </div>`;
              }).join("")}
            </div>
          </div>
        </div>
        ${fusions.length > 0 ? `
          <div class="fusion-quick-list">
            <h3>可发现的新合体（${fusions.length}）</h3>
            <div class="fusion-quick-grid">
              ${fusions.map(f => `
                <div class="fusion-quick-item" data-a="${f.matA}" data-b="${f.matB}">
                  <span class="comp-icon-sm">${PERSONAS[f.matA].icon}</span>
                  ${PERSONAS[f.matA].name}
                  <span class="fusion-quick-plus">+</span>
                  <span class="comp-icon-sm">${PERSONAS[f.matB].icon}</span>
                  ${PERSONAS[f.matB].name}
                  <span class="fusion-quick-arrow">→</span>
                  <span class="comp-icon-sm">${f.icon}</span>
                  <strong>${f.name}</strong>
                  <span class="card-rank-sm rank-${f.rankLabel}">${f.rankLabel}</span>
                  <span class="fusion-cost">◈${f.cost}</span>
                </div>
              `).join("")}
            </div>
          </div>
        ` : "<p class='hub-empty'>所有可用素材已合体完毕，继续解锁更多素材吧！</p>"}
      </div>
    `;

    this.bindFusion(container);
    this.updateFusionPreview();
  }

  bindFusion(container) {
    container.querySelectorAll(".fusion-material").forEach(el => {
      el.onclick = () => {
        const key = el.dataset.key;
        if (this.fusionSelA === key) { this.fusionSelA = null; }
        else if (this.fusionSelB === key) { this.fusionSelB = null; }
        else if (!this.fusionSelA) { this.fusionSelA = key; }
        else if (!this.fusionSelB) { this.fusionSelB = key; }
        else { this.fusionSelA = key; this.fusionSelB = null; }
        this.render();
      };
    });

    container.querySelectorAll(".fusion-quick-item").forEach(el => {
      el.onclick = () => {
        this.fusionSelA = el.dataset.a;
        this.fusionSelB = el.dataset.b;
        this.render();
      };
    });

    const execBtn = container.querySelector("#btn-fusion-execute");
    if (execBtn) {
      execBtn.onclick = () => this.doFusion();
    }
  }

  updateFusionPreview() {
    const elA = document.getElementById("fusion-content-a");
    const elB = document.getElementById("fusion-content-b");
    const elPreview = document.getElementById("fusion-preview-content");
    const execBtn = document.getElementById("btn-fusion-execute");

    if (elA) elA.innerHTML = this.fusionSelA ? this.renderMaterialChip(this.fusionSelA) : "— 未选择 —";
    if (elB) elB.innerHTML = this.fusionSelB ? this.renderMaterialChip(this.fusionSelB) : "— 未选择 —";

    if (this.fusionSelA && this.fusionSelB) {
      const result = getFusionResult(this.fusionSelA, this.fusionSelB);
      if (result) {
        if (elPreview) elPreview.innerHTML = `
          <div class="fusion-result-card">
            <span class="comp-icon">${result.icon}</span>
            <div class="comp-name">${result.name}</div>
            <div class="comp-arcana">${result.arcanaName} · ${result.rankLabel}</div>
            <div class="fusion-cost">费用: ◈${result.cost}</div>
            ${result.inheritedSkills.length ? `<div class="comp-skills-mini">继承: ${result.inheritedSkills.map(s => `${ELEMENT_INFO[s.element]?.icon ?? ""}${s.name}`).join(", ")}</div>` : ""}
            ${this.meta.isUnlocked(result.key) ? '<div class="comp-status locked-tag">已解锁</div>' : ""}
          </div>
        `;
        if (execBtn) execBtn.disabled = this.meta.isUnlocked(result.key) || this.meta.money < result.cost;
      } else {
        if (elPreview) elPreview.innerHTML = '<span class="fusion-fail">合体失败：无可用结果</span>';
        if (execBtn) execBtn.disabled = true;
      }
    } else {
      if (elPreview) elPreview.innerHTML = "选择两个素材";
      if (execBtn) execBtn.disabled = true;
    }
  }

  renderMaterialChip(key) {
    const p = PERSONAS[key];
    return `<div class="fusion-chip"><span class="comp-icon-sm">${p.icon}</span> ${p.name} <span class="card-rank-sm rank-${RANK_LABEL[p.rank]}">${RANK_LABEL[p.rank]}</span></div>`;
  }

  doFusion() {
    if (!this.fusionSelA || !this.fusionSelB) return;
    const r = executeFusion(this.meta, this.fusionSelA, this.fusionSelB);
    const msgEl = document.getElementById("fusion-message");
    if (msgEl) {
      msgEl.textContent = r.msg;
      msgEl.className = "fusion-message " + (r.ok ? "success" : "fail");
    }
    if (r.ok) {
      this.fusionSelA = null;
      this.fusionSelB = null;
    }
    this.render();
  }

  // ==================== 属性强化 ====================
  renderStats(container) {
    const stats = ["attack", "maxHp", "critRate", "maxReversed", "theurgyMax"];
    const labels = { attack: "攻击力", maxHp: "最大HP", critRate: "暴击率", maxReversed: "逆位上限", theurgyMax: "神通法次数" };
    const html = `
      <div class="hub-section">
        <h2 class="hub-section-title">属性强化 · 可用属性点: ${this.meta.statPoints} SP</h2>
        <div class="stats-grid">
          ${stats.map(stat => {
            const disp = this.meta.getStatDisplay(stat);
            const cost = this.meta.getStatCost(stat);
            const canUp = this.meta.statPoints >= cost;
            return `
              <div class="stat-upgrade-card">
                <div class="stat-upgrade-name">${labels[stat]}</div>
                <div class="stat-upgrade-current">当前: ${disp.total}</div>
                <div class="stat-upgrade-bonus">加成: ${disp.bonus || "+0"}</div>
                <div class="stat-upgrade-cost">消耗: ${cost} SP</div>
                <button class="cut-btn ${canUp ? "confirm" : ""}" data-stat="${stat}" ${canUp ? "" : "disabled"}>+1</button>
              </div>
            `;
          }).join("")}
        </div>
        <div class="stats-hint">
          <p>每升一级获得 ${3} 属性点。当前等级 Lv.${this.meta.playerLevel}/${MAX_PLAYER_LEVEL}。</p>
        </div>
      </div>
    `;
    container.innerHTML = html;
    container.querySelectorAll("[data-stat]").forEach(btn => {
      btn.onclick = () => {
        this.meta.upgradeStat(btn.dataset.stat);
        this.render();
      };
    });
  }

  // ==================== 阵营选择 + 阵营特性升级 ====================
  renderArcana(container) {
    const html = `
      <div class="hub-section">
        <h2 class="hub-section-title">阿尔卡那阵营选择 · 特性升级</h2>
        <p class="hub-desc">选择你的阵营，在战斗中获得独特增益；可用精魄升级当前阵营特性（Lv.1→Lv.3）。</p>
        <div class="arcana-grid">
          ${ARCANA_LIST.map(key => {
            const a = ARCANA[key];
            const selected = this.meta.arcanaId === key;
            const lv = this.meta.getArcanaLevel(key);
            // 阵营锁定卡池：persona_pool 中已解锁的数量
            const poolUnlocked = a.persona_pool.filter(k => this.meta.isUnlocked(k)).length;
            const locked = poolUnlocked === 0;
            // 当前等级文案
            const bonusText = a.bonusLevels[lv - 1] || a.bonusLevels[0];
            // 升级费用
            const upgradeCost = lv * 800;
            const canUpgrade = lv < 3 && this.meta.money >= upgradeCost;
            return `
              <div class="arcana-card ${selected ? "selected" : ""} ${locked ? "locked" : ""}" data-key="${key}">
                <div class="arcana-icon">${a.icon}</div>
                <div class="arcana-name">${a.name} <span class="arcana-level">Lv.${lv}</span></div>
                <div class="arcana-bonus">${bonusText}</div>
                <div class="arcana-pool-count">${poolUnlocked}/${a.persona_pool.length} 人格面具</div>
                ${locked ? '<div class="arcana-locked-tag">未解锁人格面具</div>' : ''}
                <div class="arcana-actions">
                  ${selected
                    ? '<div class="arcana-selected-tag">当前阵营</div>'
                    : (locked
                        ? '<button class="cut-btn arcana-select-btn" data-key="' + key + '" disabled>未解锁</button>'
                        : '<button class="cut-btn confirm arcana-select-btn" data-key="' + key + '">选择</button>')
                  }
                  ${!locked && lv < 3
                    ? `<button class="cut-btn arcana-upgrade-btn" data-key="${key}" ${canUpgrade ? "" : "disabled"}>
                        升级 ◈${upgradeCost}
                      </button>`
                    : (lv >= 3 ? '<div class="arcana-max-tag">已满级</div>' : '')
                  }
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
    container.innerHTML = html;
    container.querySelectorAll(".arcana-select-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        this.meta.setArcana(btn.dataset.key);
        this.render();
      };
    });
    container.querySelectorAll(".arcana-upgrade-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        const r = this.meta.upgradeArcana(btn.dataset.key);
        if (r.ok) this.showToast(r.msg);
        else this.showToast(r.msg, true);
        this.render();
      };
    });
  }

  // ==================== 商店 ====================
  renderShop(container) {
    const html = `
      <div class="hub-section">
        <h2 class="hub-section-title">天鹅绒商店 · 持有 ◈${this.meta.money} 精魄</h2>
        <div class="shop-grid">
          ${SHOP_ITEMS.map(item => {
            const canBuy = this.meta.money >= item.cost;
            return `
              <div class="shop-card">
                <div class="shop-icon">${item.icon}</div>
                <div class="shop-name">${item.name}</div>
                <div class="shop-desc">${item.desc}</div>
                <div class="shop-price">◈${item.cost}</div>
                <button class="cut-btn ${canBuy ? "confirm" : ""} shop-buy-btn" data-id="${item.id}" ${canBuy ? "" : "disabled"}>购 买</button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
    container.innerHTML = html;
    container.querySelectorAll(".shop-buy-btn").forEach(btn => {
      btn.onclick = () => {
        const r = this.meta.buyItem(btn.dataset.id);
        this.render();
        // Show toast
        if (r.ok) this.showToast(r.msg);
        else this.showToast(r.msg, true);
      };
    });
  }

  showToast(msg, isError = false) {
    const toast = document.createElement("div");
    toast.className = "hub-toast " + (isError ? "error" : "success");
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 2000);
  }
}
