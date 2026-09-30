// ============================================================
// 游戏状态机：回合流程、牌库、战斗结算
// ============================================================
import {
  ARCANA, PERSONAS, MINOR_CARDS, ENEMIES, STAGES,
  CARD_TYPE, RANK, RANK_LABEL, POWER, RANGE, ELEMENT, AFFINITY,
  ELEMENT_INFO, POWER_INFO,
  STARTING_PERSONAS,
  nextId,
} from "./data.js?v=17";
import { composeSkill, calculateDamage, getActiveSkill } from "./core.js?v=17";

// 卡牌工厂
function makePersonaCard(key) {
  const p = PERSONAS[key];
  return {
    id: nextId("per"),
    type: CARD_TYPE.PERSONA,
    cardKey: key,
    name: p.name,
    icon: p.icon,
    arcana: p.arcana,
    rank: p.rank,
    is_reversed: false,
    skill_upright: p.upright,
    skill_reversed: p.reversed,
  };
}
function makeMinorCard(key) {
  const m = MINOR_CARDS[key];
  return { id: nextId("min"), cardKey: key, name: m.name, icon: m.icon, ...m };
}
function makeTheurgyCard(key) {
  const t = PERSONAS[key];
  return { id: nextId("the"), type: CARD_TYPE.THEURGY, cardKey: key, name: t.name, icon: t.icon, skill: t.skill };
}
function makeAllOutCard(power) {
  return {
    id: nextId("aoa"),
    type: CARD_TYPE.ALL_OUT,
    name: "总攻击",
    icon: "💥",
    skill: { name: "All-Out Attack", element: ELEMENT.ALMIGHTY, power, range: RANGE.ALL },
  };
}
// 构筑合成后产生的攻击牌：持有合成技能，双击直接释放
function makeAttackCard(skill) {
  const info = ELEMENT_INFO[skill.element] || { name: "?", icon: "⚔" };
  const pinfo = POWER_INFO[skill.power] || { name: "?", label: "?" };
  return {
    id: nextId("atk"),
    type: CARD_TYPE.ATTACK,
    name: `攻击牌·${info.name}`,
    icon: info.icon,
    skill: { ...skill },
    powerLabel: pinfo.label,
  };
}

export class Game {
  constructor(meta) {
    this.meta = meta || null;
    this.stageIndex = 0;
    this.arcana = (meta && meta.getArcana()) || ARCANA.FOOL;
    // 从 meta 获取战斗属性（难度压缩后基础值 300/18/0.03/5/2）
    const ms = meta ? meta.getBattlePlayerStats() : { attack: 18, maxHp: 300, critRate: 0.03, maxReversed: 2, theurgyMax: 2, handLimit: 5, arcanaLv: 1 };
    this.arcanaLv = ms.arcanaLv || 1;
    this.player = {
      maxHp: ms.maxHp, hp: ms.maxHp, attack: ms.attack,
      critRate: ms.critRate,
      cupStack: 0,
      // 局内资金 ¥：每局固定起手 120，不持久（区别于 meta.money = 精魄 ◈）
      money: 120,
      drawCost: 60,
      arcanaBonus: this.arcana.bonusKey,
      arcanaLv: this.arcanaLv,
      maxReversed: ms.maxReversed,
    };
    this.deckLevel = 1;
    this.handLimit = ms.handLimit;
    this.theurgy = 0;
    this.theurgyUses = 0;
    this.theurgyMax = ms.theurgyMax;
    this.turn = 0;
    this.state = "IDLE"; // IDLE, PLAYER_ACTION, ENEMY_ACTION, BATTLE_END
    this.deck = [];
    this.hand = [];
    this.composeSlots = []; // 当前构筑中的卡牌
    this.enemies = [];
    this.waves = [];       // 多波次关卡数据
    this.waveIndex = 0;
    this.environment = []; // 局内减益环境
    this.targetEnemyId = null;
    this.listeners = [];
    this.firstComposeThisTurn = false;
    this.bonusCards = []; // 升级解锁的高阶卡 key（牌库重建时保留）
    this.supportBuffs = {}; // 辅助技能的临时 buff（tarukaja, rakukaja 等）
    this.allowPersonaRefresh = true; // 牌库重建时是否补充人格面具卡（首次或升级后）
    this.allOutUsedThisTurn = false; // 一回合内总攻击冷却
    this.lastUpgradeTurn = 0; // 上次升级的回合数（用于计算折扣）
  }

  on(fn) { this.listeners.push(fn); }
  emit(type, data) { this.listeners.forEach(fn => fn(type, data)); }
  log(msg, cls = "info") { this.emit("log", { msg, cls }); }

  // ---------- 牌库 / 发牌 ----------
  // 阵营锁定卡池：仅本阵营 persona_pool 中已解锁的人格面具入牌库
  buildDeck() {
    let pool = this.arcana.persona_pool;
    if (this.meta) {
      pool = pool.filter(k => this.meta.isUnlocked(k));
    }
    // 空池回退到初始人格面具
    if (!pool || pool.length === 0) pool = STARTING_PERSONAS;
    const deck = [];
    // 人格面具卡：首次建造每个 1 张；再次重建时只补充小阿尔卡那（避免无限刷新强力技能）
    if (this.allowPersonaRefresh) {
      const usePool = pool.length > 10 ? pool.slice(0, 10) : pool;
      usePool.forEach(key => deck.push(makePersonaCard(key)));
      this.allowPersonaRefresh = false; // 下次重建不再补充人格面具
    }
    // 升级解锁的高阶卡（重建时保留）
    this.bonusCards.forEach(key => deck.push(makePersonaCard(key)));
    // 小阿尔卡那（每次重建都补充）
    deck.push(makeMinorCard("wand"));
    deck.push(makeMinorCard("cup")); deck.push(makeMinorCard("cup"));
    deck.push(makeMinorCard("pentacle")); deck.push(makeMinorCard("pentacle"));
    // 宝剑
    deck.push(makeMinorCard("sword_sm")); deck.push(makeMinorCard("sword_md"));
    if (this.deckLevel >= 3) deck.push(makeMinorCard("sword_lg"));
    this.deck = this.shuffle(deck);
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  drawCard() {
    if (this.hand.length >= this.handLimit) {
      this.log("手牌已满！", "info");
      return false;
    }
    // 牌库为空时自动重建并洗牌（不断刷新新卡）
    if (this.deck.length === 0) {
      this.buildDeck();
      this.log("牌库已空，重新洗入新卡", "info");
    }
    const card = this.deck.pop();
    this.hand.push(card);
    this.emit("draw", card);
    return true;
  }

  drawCards(n) { for (let i = 0; i < n; i++) this.drawCard(); }

  // 额外抽牌（花费资金）
  buyDraw() {
    const cost = this.player.drawCost;
    if (this.player.money < cost) { this.log("资金不足！", "info"); return false; }
    if (this.hand.length >= this.handLimit) { this.log("手牌已满！", "info"); return false; }
    this.player.money -= cost;
    this.player.drawCost *= 2;
    this.drawCard();
    this.log(`花费 ¥${cost} 抽取一张牌`, "gold");
    // 教程：抽牌推进 step 3→4（此时应抽到俄耳甫斯）
    if (this.isTutorial && this.tutorialStep === 3) {
      this.tutorialStep = 4;
      this.emit("tutorial", { step: 4 });
    }
    this.emit("state");
    return true;
  }

  // 升级牌库（费用 ×1.2）
  upgradeDeck() {
    const baseCosts = [600, 1200, 2400, 4800];
    const baseCost = baseCosts[this.deckLevel - 1] || 9999;
    // 每回合升级费用递减：第1回合-15%，第2回合-30%，第3回合及以后-50%；升级后重置
    const discountTurns = Math.min(this.turn - this.lastUpgradeTurn - 1, 3);
    const discount = discountTurns <= 0 ? 0 : [0, 0.15, 0.30, 0.50][discountTurns];
    const cost = Math.round(baseCost * (1 - discount));
    if (this.deckLevel >= 5) { this.log("牌库已满级", "info"); return false; }
    if (this.player.money < cost) { this.log(`资金不足！需要 ¥${cost}`, "info"); return false; }
    this.player.money -= cost;
    this.deckLevel++;
    this.handLimit = Math.min(8, this.handLimit + 1);
    this.lastUpgradeTurn = this.turn; // 重置折扣计时

    // 从本阵营卡池中选择高阶卡（rank A/S）；若未解锁高阶卡则补充低阶卡（rank C/B）
    const allPool = (this.arcana.persona_pool || []).filter(k => this.meta ? this.meta.isUnlocked(k) : true);
    const highPool = allPool.filter(k => PERSONAS[k] && PERSONAS[k].rank >= 3);
    const lowPool = allPool.filter(k => PERSONAS[k] && PERSONAS[k].rank <= 2);
    let key = null;
    if (highPool.length > 0) {
      key = highPool[Math.floor(Math.random() * highPool.length)];
    } else if (lowPool.length > 0) {
      key = lowPool[Math.floor(Math.random() * lowPool.length)];
    }
    if (key) {
      this.bonusCards.push(key);
      this.deck.push(makePersonaCard(key));
    }
    // 升级后允许下次重建时补充本阵营低阶人格面具卡
    this.allowPersonaRefresh = true;
    // 即时补充一张本阵营随机低阶人格面具
    if (lowPool.length > 0) {
      const lowKey = lowPool[Math.floor(Math.random() * lowPool.length)];
      this.deck.push(makePersonaCard(lowKey));
    }
    this.shuffle(this.deck);
    const discountText = discount > 0 ? `（回合折扣 -${Math.round(discount * 100)}%）` : "";
    this.log(`牌库升至 Lv.${this.deckLevel}！解锁 ${key ? PERSONAS[key].name : "无"}，手牌上限+1，补充人格面具${discountText}`, "gold");
    this.emit("state");
    return true;
  }

  // ---------- 战斗开始 ----------
  startStage(idx) {
    this.stageIndex = idx;
    const stage = STAGES[idx];
    // 教程模式：标记 + 引导步骤计数（0=未触发,1=抽牌,2=出牌,3=构筑,4=完成）
    this.isTutorial = !!stage.isTutorial;
    this.tutorialStep = 0;
    // 多波次 + 环境减益
    this.waves = stage.waves || [stage.enemies];
    this.waveIndex = 0;
    this.environment = stage.environment || [];
    this.spawnWave(0);

    // 从 meta 同步属性和阵营增益
    if (this.meta) {
      const ms = this.meta.getBattlePlayerStats();
      this.player.maxHp = ms.maxHp;
      this.player.attack = ms.attack;
      this.player.critRate = ms.critRate;
      this.player.maxReversed = ms.maxReversed;
      this.theurgyMax = ms.theurgyMax;
      this.handLimit = ms.handLimit;
      this.arcana = this.meta.getArcana();
      this.arcanaLv = ms.arcanaLv || 1;
      this.player.arcanaBonus = this.arcana.bonusKey;
      this.player.arcanaLv = this.arcanaLv;
    }

    this.bonusCards = []; // 每关重置高阶卡解锁
    this.supportBuffs = {}; // 重置辅助 buff
    this.allowPersonaRefresh = true; // 关卡开始允许补充人格面具卡
    if (this.isTutorial) {
      // 教程关：固定牌库（pop 顺序：软泥怪 → 小宝剑 → 俄耳甫斯）
      this.deck = [
        makeMinorCard("pentacle"),
        makeMinorCard("cup"),
        makePersonaCard("orpheus"),
        makeMinorCard("sword_sm"),
        makePersonaCard("slime"),
      ];
    } else {
      this.buildDeck();
    }
    this.theurgy = 0;
    this.theurgyUses = 0;
    this.player.hp = this.player.maxHp;
    this.turn = 0;
    const envNames = this.environment.length ? ` | 环境：${this.environment.map(e => e).join(",")}` : "";
    this.log(`【${stage.name}】战斗开始！阵营：${this.arcana.name}（Lv.${this.arcanaLv}）${envNames}`, "info");
    this.emit("stageStart", stage);
    if (this.isTutorial) {
      this.tutorialStep = 1;
      this.emit("tutorial", { step: 1 });
      this.log("【教程】将软泥怪与小宝剑拖入下方构筑槽，尝试构筑合成技能", "info");
    }
    this.startTurn();
  }

  // 生成指定波次的敌人
  spawnWave(waveIdx) {
    const waveKeys = this.waves[waveIdx] || [];
    this.enemies = waveKeys.map((k, i) => {
      const e = ENEMIES[k];
      return {
        id: `e${i}_${waveIdx}`, key: k, name: e.name, icon: e.icon,
        level: e.level, maxHp: e.hp, hp: e.hp,
        affinities: { ...e.affinities },
        revealedAffinities: new Set(), // 受对应属性伤害后才揭示
        skills: e.skills, attack: e.attack,
        is_knocked_down: false, intent: null,
      };
    });
    this.targetEnemyId = null;
  }

  // ---------- 回合流程 ----------
  startTurn() {
    this.turn++;
    this.state = "PLAYER_ACTION";
    this.firstComposeThisTurn = true;
    this.player.cupStack = 0;
    this.player.drawCost = 60;
    this.supportBuffs = {}; // 每回合清除辅助 buff
    this.allOutUsedThisTurn = false; // 重置总攻击冷却
    // 回合资金：80 + 回合数×15
    let income = 80 + this.turn * 15;
    // 教皇阵营：按等级 +¥30/+¥60/+¥80（Lv3 起手额外 +¥100）
    if (this.player.arcanaBonus === "EXTRA_INCOME") {
      const bonus = [30, 60, 80][this.arcanaLv - 1] || 30;
      income += bonus;
      if (this.arcanaLv >= 3 && this.turn === 1) income += 100;
    }
    this.player.money += income;
    this.log(`—— 回合 ${this.turn} ——  获得 ¥${income}`, "info");

    // 节制阵营：按等级 回合回 0/5%/10% HP
    if (this.player.arcanaBonus === "DAMAGE_REDUCE" && this.arcanaLv >= 2) {
      const healPct = [0, 0.05, 0.10][this.arcanaLv - 1] || 0;
      if (healPct > 0 && this.player.hp < this.player.maxHp) {
        const heal = Math.round(this.player.maxHp * healPct);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this.log(`节制回 ${heal} HP`, "heal");
      }
    }

    // 发牌：min(4, 1+牌库等级)
    let drawNum = Math.min(4, 1 + this.deckLevel);
    // 隐者阵营：按等级 多抽 1/2/2 张
    if (this.player.arcanaBonus === "EXTRA_DRAW") {
      drawNum += [1, 2, 2][this.arcanaLv - 1] || 1;
    }
    // 教程：第一回合固定发软泥怪 + 小宝剑；第二回合后正常发牌
    if (this.isTutorial && this.turn === 1) {
      this.drawCards(2); // 抽软泥怪 + 小宝剑
    } else if (this.isTutorial && this.turn === 2) {
      // 第二回合：保留手牌 + 抽俄耳甫斯（已在牌库中）
      this.drawCards(1);
    } else {
      this.drawCards(drawNum);
    }

    // 清除总攻击卡
    this.hand = this.hand.filter(c => c.type !== CARD_TYPE.ALL_OUT);
    // 清除上一回合留下的攻击牌
    this.hand = this.hand.filter(c => c.type !== CARD_TYPE.ATTACK);

    // 敌人意图
    this.rollEnemyIntents();

    this.emit("turnStart");
    this.emit("state");
  }

  rollEnemyIntents() {
    this.enemies.forEach(e => {
      if (e.hp <= 0) return;
      const skill = e.skills[Math.floor(Math.random() * e.skills.length)];
      e.intent = skill;
    });
  }

  endTurn() {
    if (this.state !== "PLAYER_ACTION") return;
    // 将构筑区卡牌移回手牌
    this.clearCompose();
    // 清除圣杯层数
    this.player.cupStack = 0;
    // 移除总攻击卡
    this.hand = this.hand.filter(c => c.type !== CARD_TYPE.ALL_OUT);
    // 移除攻击牌（每回合清除）
    this.hand = this.hand.filter(c => c.type !== CARD_TYPE.ATTACK);
    this.state = "ENEMY_ACTION";
    this.emit("state");
    this.enemyTurn();
  }

  enemyTurn() {
    let idx = 0;
    const act = () => {
      if (idx >= this.enemies.length) {
        this.afterEnemyTurn();
        return;
      }
      const e = this.enemies[idx++];
      if (e.hp <= 0) { act(); return; }
      if (e.is_knocked_down) {
        this.log(`${e.name} 处于倒地状态，无法行动`, "info");
        e.is_knocked_down = false; // 下一回合恢复
        this.emit("state");
        setTimeout(act, 500);
        return;
      }
      const skill = e.intent || e.skills[0];
      // 恢复技能：敌人先治疗自己
      if (skill.element === ELEMENT.HEAL) {
        const healAmt = Math.round(e.attack * ({1:0.5,2:1.0,3:1.8,4:2.8,5:4.0}[skill.power] || 1));
        const before = e.hp;
        e.hp = Math.min(e.maxHp, e.hp + healAmt);
        const real = e.hp - before;
        this.log(`${e.name} 使用 ${skill.name}，恢复 ${real} HP`, "heal");
        this.emit("enemyAttack", { enemy: e, skill, heal: real });
        this.emit("state");
        setTimeout(act, 700);
        return;
      }
      this.log(`${e.name} 使用 ${skill.name}`, "dmg");
      // 攻击动画触发（在造成伤害前 emit，UI 可播放突进/屏闪）
      this.emit("enemyAttack", { enemy: e, skill });
      // 敌人伤害
      const dmg = this.calcEnemyDamage(skill, e);
      this.damagePlayer(dmg);
      this.emit("enemyAct", { enemy: e, skill });
      if (this.player.hp <= 0) { this.battleEnd(false); return; }
      setTimeout(act, 700);
    };
    act();
  }

  calcEnemyDamage(skill, enemy) {
    const mult = { 1: 0.6, 2: 1.2, 3: 2.0, 4: 3.2, 5: 4.5 }[skill.power] || 1;
    let base = enemy.attack * mult;
    // 环境减益：敌方攻击+25%
    if (this.environment.includes("ENEMY_ATK_UP")) base *= 1.25;
    let dmg = Math.round(base);
    // 节制阵营：按等级 减伤 10%/15%/20%
    if (this.player.arcanaBonus === "DAMAGE_REDUCE") {
      const reduce = [0.10, 0.15, 0.20][this.arcanaLv - 1] || 0.10;
      dmg = Math.round(dmg * (1 - reduce));
    }
    // 防御 buff
    if (this.supportBuffs.DEF_UP) dmg = Math.round(dmg * 0.65);
    return Math.max(1, dmg);
  }

  afterEnemyTurn() {
    this.checkBattleEnd();
    if (this.state === "BATTLE_END") return;
    this.startTurn();
  }

  damagePlayer(dmg) {
    this.player.hp = Math.max(0, this.player.hp - dmg);
    this.log(`玩家受到 ${dmg} 伤害`, "dmg");
    this.emit("playerHurt", dmg);
  }

  healPlayer(amt) {
    // 环境减益：恢复效果减半
    if (this.environment.includes("HEAL_HALVED")) amt = Math.round(amt * 0.5);
    const before = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amt);
    const real = this.player.hp - before;
    this.log(`玩家恢复 ${real} HP`, "heal");
    this.emit("playerHeal", real);
  }

  // ---------- 玩家操作 ----------
  // 计算场上（手牌+构筑槽）逆位牌数量
  getReversedCount() {
    return [...this.hand, ...this.composeSlots].filter(c => c.is_reversed).length;
  }

  // 翻转卡牌正逆位（限制场上同时最多 maxReversed 张逆位牌）
  flipCard(cardId) {
    if (this.state !== "PLAYER_ACTION") return false;
    const card = this.hand.find(c => c.id === cardId) || this.composeSlots.find(c => c.id === cardId);
    if (!card || card.type !== CARD_TYPE.PERSONA) return false;
    // 若正→逆，检查场上逆位牌是否已达上限（倒悬者阵营不受限）
    const freeFlip = this.player.arcanaBonus === "FREE_FLIP";
    if (!card.is_reversed && !freeFlip && this.getReversedCount() >= this.player.maxReversed) {
      this.log(`场上逆位牌已达上限 (${this.player.maxReversed}张)`, "info");
      return false;
    }
    card.is_reversed = !card.is_reversed;
    this.log(`${card.name} → ${card.is_reversed ? "逆位" : "正位"}`, "info");
    // 教程：翻转俄耳甫斯推进 step 4→5
    if (this.isTutorial && this.tutorialStep === 4 && card.cardKey === "orpheus" && card.is_reversed) {
      this.tutorialStep = 5;
      this.emit("tutorial", { step: 5 });
    }
    this.emit("state");
    return true;
  }

  // 将手牌加入构筑槽
  addToCompose(cardId) {
    if (this.state !== "PLAYER_ACTION") return false;
    if (this.composeSlots.length >= 5) { this.log("构筑槽已满", "info"); return false; }
    const idx = this.hand.findIndex(c => c.id === cardId);
    if (idx < 0) return false;
    const card = this.hand[idx];
    // 小阿尔卡那（WAND/CUP/PENTACLE）不进构筑槽，直接使用
    if (card.type === CARD_TYPE.WAND || card.type === CARD_TYPE.CUP || card.type === CARD_TYPE.PENTACLE) {
      this.useMinorCard(card);
      return true;
    }
    // 总攻击卡 / 神通法卡直接打出
    if (card.type === CARD_TYPE.ALL_OUT) { this.useAllOut(card); return true; }
    if (card.type === CARD_TYPE.THEURGY) { this.useTheurgy(card); return true; }
    // 攻击牌直接释放（不入构筑槽）
    if (card.type === CARD_TYPE.ATTACK) { this.useAttackCard(card); return true; }

    this.hand.splice(idx, 1);
    this.composeSlots.push(card);
    // 教程：首次拖入构筑推进 step 1→2
    if (this.isTutorial && this.tutorialStep === 1) {
      this.tutorialStep = 2;
      this.emit("tutorial", { step: 2 });
    }
    this.emit("state");
    return true;
  }

  // 从构筑槽移回手牌
  removeFromCompose(slotIdx) {
    if (this.state !== "PLAYER_ACTION") return false;
    const card = this.composeSlots.splice(slotIdx, 1)[0];
    if (card) this.hand.push(card);
    this.emit("state");
    return true;
  }

  clearCompose() {
    while (this.composeSlots.length) this.hand.push(this.composeSlots.pop());
    this.emit("state");
  }

  // 使用小阿尔卡那
  useMinorCard(card) {
    const idx = this.hand.findIndex(c => c.id === card.id);
    if (idx < 0) return;
    this.hand.splice(idx, 1);
    if (card.type === CARD_TYPE.CUP) {
      // 女皇阵营：圣杯效果翻倍
      const stacks = this.player.arcanaBonus === "CUP_DOUBLE" ? 2 : 1;
      this.player.cupStack += stacks;
      this.log(`圣杯层数 +${stacks}（当前 ${this.player.cupStack}）`, "gold");
    } else if (card.type === CARD_TYPE.PENTACLE) {
      // 星币：基础 200 + 回合×10 + 牌库等级×30（随牌库等级略微上升）
      const gain = 200 + this.turn * 10 + (this.deckLevel - 1) * 30;
      this.player.money += gain;
      this.log(`星币：获得 ¥${gain}`, "gold");
    } else if (card.type === CARD_TYPE.WAND) {
      // 权杖：从本阵营卡池检索一张已解锁的人格面具加入手牌（不消耗牌库、无视手牌上限）
      const pool = (this.arcana.persona_pool || []).filter(k => this.meta ? this.meta.isUnlocked(k) : true);
      if (pool.length) {
        const key = pool[Math.floor(Math.random() * pool.length)];
        const pick = makePersonaCard(key);
        this.hand.push(pick);
        this.log(`权杖：获得 ${pick.name}（不消耗牌库）`, "gold");
      } else {
        this.log("未解锁任何人格面具，权杖效果失效", "info");
      }
    }
    this.emit("state");
  }

  // 使用神通法卡
  useTheurgy(card) {
    if (this.theurgyUses >= this.theurgyMax) { this.log("神通法使用次数已达上限", "info"); return; }
    this.theurgyUses++;
    const idx = this.hand.findIndex(c => c.id === card.id);
    if (idx < 0) return;
    this.hand.splice(idx, 1);
    this.log(`神通法：${card.name}！`, "info");
    this.executeSkill(card.skill, card);
    this.emit("state");
    // 神通法可能击杀敌人，需检查战斗结束
    this.checkBattleEnd();
  }

  // 总攻击
  useAllOut(card) {
    // 一回合内总攻击冷却
    if (this.allOutUsedThisTurn) {
      this.log("本回合已使用过总攻击，需下回合才能再次发动", "info");
      return;
    }
    const idx = this.hand.findIndex(c => c.id === card.id);
    if (idx < 0) return;
    this.hand.splice(idx, 1);
    this.allOutUsedThisTurn = true; // 标记本回合已使用
    this.log(`⚔ 总攻击发动！⚔`, "gold");
    this.executeSkill(card.skill, card);
    // 总攻击结束后立即解除所有敌人倒地状态，避免无限总攻击链
    this.enemies.forEach(e => { if (e.hp > 0) e.is_knocked_down = false; });
    // 教程：总攻击推进 step 6→7
    if (this.isTutorial && this.tutorialStep === 6) {
      this.tutorialStep = 7;
      this.emit("tutorial", { step: 7 });
    }
    this.emit("state");
    // 总攻击可能击杀敌人，需检查战斗结束
    this.checkBattleEnd();
  }

  // 教程专用：直接打出人格面具技能（不进构筑槽）
  usePersonaDirect(card) {
    if (this.state !== "PLAYER_ACTION") return false;
    const idx = this.hand.findIndex(c => c.id === card.id);
    if (idx < 0) return false;
    const skill = getActiveSkill(card);
    if (!skill) return false;
    this.hand.splice(idx, 1);
    this.log(`使用 ${card.name}（${card.is_reversed ? "逆位" : "正位"}）：${skill.name}`, "info");
    this.executeSkill(skill, card);
    // 教程：打出俄耳甫斯推进 step 5→6（敌人倒地后才能用总攻击）
    if (this.isTutorial && this.tutorialStep === 5) {
      this.tutorialStep = 6;
      this.emit("tutorial", { step: 6 });
    }
    this.emit("state");
    this.checkBattleEnd();
    return true;
  }

  // 确认构筑 → 消耗构筑牌，生成一张攻击牌加入手牌（双击攻击牌释放技能）
  confirmCompose() {
    if (this.composeSlots.length === 0) { this.log("构筑区为空", "info"); return false; }
    // 环境减益：构筑需至少 2 张牌
    if (this.environment.includes("COMPOSE_COST_UP") && this.composeSlots.length < 2) {
      this.log("当前环境要求构筑至少 2 张牌！", "info");
      return false;
    }
    const skill = this.getEffectiveComposeSkill();
    if (!skill) return false;

    if (skill.foolBonus) {
      this.log(`愚者增益：力度+1阶`, "info");
    }
    this.firstComposeThisTurn = false;

    const names = this.composeSlots.map(c => c.name).join(" + ");
    this.log(`构筑：${names} → 生成攻击牌（${skill.element} ${skill.range}）`, "info");

    this.composeSlots = []; // 消耗构筑卡牌
    // 生成攻击牌并加入手牌（攻击牌持有合成技能，双击释放）
    const atkCard = makeAttackCard(skill);
    this.hand.push(atkCard);
    this.emit("attackCardCreated", { card: atkCard });

    // 教程：首次构筑完成推进 step 2→3
    if (this.isTutorial && this.tutorialStep === 2) {
      this.tutorialStep = 3;
      this.emit("tutorial", { step: 3 });
    }
    this.emit("state");
    return true;
  }

  // 使用攻击牌：直接释放其持有的合成技能
  useAttackCard(card) {
    if (this.state !== "PLAYER_ACTION") return false;
    const idx = this.hand.findIndex(c => c.id === card.id);
    if (idx < 0) return false;
    const skill = card.skill;
    if (!skill) return false;
    this.hand.splice(idx, 1);
    this.log(`攻击牌发动：${card.name}（${skill.element} ${POWER_INFO[skill.power]?.label || ""}）`, "info");
    // 攻击牌的技能已在生成时应用了环境/阵营增益，executeSkill 中 sourceCard=null 不再重复处理
    this.executeSkill(skill, null);
    this.emit("attackCardUsed", { card });
    this.emit("state");
    this.checkBattleEnd();
    return true;
  }

  // 执行技能（伤害/治疗/辅助结算）
  executeSkill(skill, sourceCard) {
    // 非构筑来源的技能（神通法/总攻击/宝剑直接打出）需应用 POWER_MINUS_1 环境
    let effSkill = skill;
    if (sourceCard && this.environment.includes("POWER_MINUS_1") && !skill._envApplied) {
      effSkill = { ...skill, power: Math.max(POWER.SM, skill.power - 1), _envApplied: true };
    }
    // MAGICIAN/EMPEROR Lv2+ 力度+1阶（仅对应属性）；Lv3 范围转 ALL
    if ((this.player.arcanaBonus === "FIRE_DMG" && effSkill.element === ELEMENT.FIRE) ||
        (this.player.arcanaBonus === "ELEC_DMG" && effSkill.element === ELEMENT.ELEC)) {
      if (this.arcanaLv >= 2) {
        effSkill = { ...effSkill, power: Math.min(POWER.UL, effSkill.power + 1) };
      }
      if (this.arcanaLv >= 3) {
        effSkill = { ...effSkill, range: RANGE.ALL };
      }
    }

    // 辅助技能
    if (effSkill.element === ELEMENT.SUPPORT) {
      if (effSkill.support === "ATK_UP") {
        this.supportBuffs.ATK_UP = true;
        this.log("攻击力上升！", "info");
      } else if (effSkill.support === "DEF_UP") {
        this.supportBuffs.DEF_UP = true;
        this.log("防御力上升！", "info");
      } else if (effSkill.support === "ENEMY_DEBUFF") {
        this.supportBuffs.ENEMY_DEBUFF = true;
        this.enemies.forEach(e => { if (e.hp > 0) e.attack = Math.round(e.attack * 0.7); });
        this.log("敌人攻击力下降！", "info");
      }
      this.emit("state");
      return;
    }

    // 恢复
    if (effSkill.element === ELEMENT.HEAL) {
      const mult = Game.POWER_MULT[effSkill.power] ?? 1;
      let amt = Math.round(this.player.attack * mult);
      // 恋爱阵营：按等级 恢复 +10%/+20%/+30%
      if (this.player.arcanaBonus === "HEAL_UP") {
        const bonus = [0.10, 0.20, 0.30][this.arcanaLv - 1] || 0.10;
        amt = Math.round(amt * (1 + bonus));
      }
      if (effSkill.range === RANGE.ALL) amt = Math.round(amt * 1.2);
      this.healPlayer(amt);
      return;
    }

    const targets = effSkill.range === RANGE.ALL
      ? this.enemies.filter(e => e.hp > 0)
      : [this.targetEnemy()].filter(e => e && e.hp > 0);

    if (targets.length === 0) {
      this.log("没有目标", "info");
      return;
    }

    targets.forEach(enemy => {
      // 应用临时攻击力 buff
      const origAtk = this.player.attack;
      if (this.supportBuffs.ATK_UP) this.player.attack = Math.round(origAtk * 1.3);
      const result = calculateDamage(effSkill, this.player, enemy, this.environment);
      this.player.attack = origAtk; // 恢复
      this.applyDamageResult(enemy, result, effSkill);
    });

    // 检查所有敌人倒地 → 生成总攻击卡
    this.checkAllOutTrigger();
  }

  // 力度→恢复系数（与 POWER_MULTIPLIER 同步，避免 import 循环）
  static POWER_MULT = { 1: 0.4, 2: 0.8, 3: 1.4, 4: 2.2, 5: 3.2 };

  targetEnemy() {
    if (this.targetEnemyId) {
      const e = this.enemies.find(x => x.id === this.targetEnemyId && x.hp > 0);
      if (e) return e;
    }
    return this.enemies.find(e => e.hp > 0) || null;
  }

  applyDamageResult(enemy, result, skill) {
    if (result.isHeal) { return; }
    if (result.isRepel) {
      this.log(`${enemy.name} 反弹了 ${result.damage} 伤害！`, "dmg");
      this.damagePlayer(result.damage);
      this.emit("enemyHit", { enemy, dmg: 0, repel: true });
      return;
    }
    if (result.isDrain) {
      const heal = result.damage;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
      this.log(`${enemy.name} 吸收了 ${heal} 点伤害并恢复`, "heal");
      this.emit("enemyHit", { enemy, dmg: 0, drain: true });
      return;
    }

    // 死神 Lv3 处决：<30% 血敌人额外 +50% 伤害
    let finalDmg = result.damage;
    if (this.player.arcanaBonus === "KILL_HEAL" && this.arcanaLv >= 3 &&
        enemy.hp > 0 && enemy.hp < enemy.maxHp * 0.30) {
      finalDmg = Math.round(finalDmg * 1.5);
    }
    enemy.hp = Math.max(0, enemy.hp - finalDmg);
    // 揭示敌人对应属性的相性
    if (skill && skill.element) {
      if (!enemy.revealedAffinities) enemy.revealedAffinities = new Set();
      enemy.revealedAffinities.add(skill.element);
    }
    this.emit("enemyHit", { enemy, dmg: finalDmg, crit: result.isCrit, affinity: result.affinity, element: skill?.element });
    // 敌人被击杀：触发击杀动画 + 揭示属性相性（全部显示）
    if (enemy.hp <= 0) {
      this.emit("enemyDeath", { enemy });
    }

    if (result.damage === 0 && result.affinity === AFFINITY.NULL) {
      this.log(`${enemy.name} 无效化了攻击`, "info");
    } else {
      const affTxt = result.affinity === AFFINITY.WEAK ? "（弱点！）" :
                     result.affinity === AFFINITY.RESIST ? "（耐性）" : "";
      this.log(`对 ${enemy.name} 造成 ${result.damage} 伤害${affTxt}${result.isCrit ? " 暴击！" : ""}`, result.affinity === AFFINITY.WEAK ? "dmg" : "info");

      // 弱点 → 倒地 + 神通法槽+20% + 立即抽一张手牌
      if (result.affinity === AFFINITY.WEAK) {
        enemy.is_knocked_down = true;
        this.addTheurgy(20);
        // 倒地抽牌（同权杖机制）
        if (this.hand.length < this.handLimit && this.deck.length > 0) {
          const card = this.deck.pop();
          this.hand.push(card);
          this.emit("draw", card);
          this.log(`弱点命中！额外抽到 ${card.name}`, "gold");
        } else if (this.hand.length >= this.handLimit) {
          this.log("弱点命中！但手牌已满", "info");
        }
      }
      // 暴击 → 神通法+10%
      if (result.isCrit) this.addTheurgy(10);
    }

    if (enemy.hp <= 0) {
      this.log(`${enemy.name} 被击倒！`, "dmg");
      // 死神阵营：击杀回血 15%/25%/25%，Lv3 <30%血处决 +50% 伤害
      if (this.player.arcanaBonus === "KILL_HEAL") {
        const healPct = [0.15, 0.25, 0.25][this.arcanaLv - 1] || 0.15;
        const heal = Math.round(this.player.maxHp * healPct);
        this.healPlayer(heal);
      }
    }
    // 正义阵营：Lv2+ 暴击回血 5%/10%
    if (this.player.arcanaBonus === "CRIT_UP" && result.isCrit && this.arcanaLv >= 2) {
      const critHealPct = [0, 0.05, 0.10][this.arcanaLv - 1] || 0;
      if (critHealPct > 0) {
        const heal = Math.round(this.player.maxHp * critHealPct);
        this.healPlayer(heal);
      }
    }
  }

  // 死神 Lv3 处决：<30% 血敌人额外 +50% 伤害
  applyDeathExecute(enemy, dmg) {
    if (this.player.arcanaBonus === "KILL_HEAL" && this.arcanaLv >= 3 &&
        enemy.hp > 0 && enemy.hp < enemy.maxHp * 0.30) {
      return Math.round(dmg * 1.5);
    }
    return dmg;
  }

  addTheurgy(amt) {
    if (this.theurgyUses >= this.theurgyMax) return;
    this.theurgy = Math.min(100, this.theurgy + amt);
    if (this.theurgy >= 100) {
      this.theurgy = 0;
      // 随机获得一张神通法卡
      const pool = ["theurgy_maragi", "theurgy_mabufu", "theurgy_mazio", "theurgy_media"];
      const key = pool[Math.floor(Math.random() * pool.length)];
      if (this.hand.length < this.handLimit) {
        this.hand.push(makeTheurgyCard(key));
        this.log(`神通法槽满！获得 ${PERSONAS[key].name}`, "gold");
      } else {
        this.log("手牌已满，神通法卡丢失", "info");
      }
    }
  }

  checkAllOutTrigger() {
    const alive = this.enemies.filter(e => e.hp > 0);
    if (alive.length > 0 && alive.every(e => e.is_knocked_down)) {
      if (!this.hand.find(c => c.type === CARD_TYPE.ALL_OUT)) {
        // 总攻击力度：初始 LG(3)，每级牌库+1，上限 XH(5)
        const power = Math.min(POWER.LG + (this.deckLevel - 1), POWER.XH);
        this.hand.push(makeAllOutCard(power));
        this.log(`所有敌人倒地！总攻击卡牌出现！`, "gold");
        this.emit("allOut");
      }
    }
  }

  checkBattleEnd() {
    if (this.player.hp <= 0) {
      this.battleEnd(false);
      return;
    }
    // 当前波全部死亡
    if (this.enemies.every(e => e.hp <= 0)) {
      const isLastWave = this.waveIndex >= this.waves.length - 1;
      if (isLastWave) {
        this.battleEnd(true);
      } else {
        // 生成下一波：玩家不回血，清构筑槽/倒地状态
        this.waveIndex++;
        this.spawnWave(this.waveIndex);
        this.composeSlots = [];
        this.hand = this.hand.filter(c => c.type !== CARD_TYPE.ALL_OUT);
        this.hand = this.hand.filter(c => c.type !== CARD_TYPE.ATTACK);
        this.firstComposeThisTurn = true;
        this.rollEnemyIntents();
        this.log(`▶ 新的暗影将你包围了！（第 ${this.waveIndex + 1}/${this.waves.length} 波）`, "info");
        this.emit("waveStart", { waveIndex: this.waveIndex, total: this.waves.length });
        this.emit("state");
      }
    }
  }

  battleEnd(victory) {
    this.state = "BATTLE_END";
    if (victory) {
      const stage = STAGES[this.stageIndex];
      this.log(`🎉 胜利！获得 ${stage.reward.exp} 经验，◈${stage.reward.money} 精魄`, "gold");
      // 通过 meta 记录经验和精魄（meta.money = 精魄，持久；局内 player.money 不持久）
      if (this.meta) {
        this.meta.addExp(stage.reward.exp);
        this.meta.money += stage.reward.money;
        this.meta.clearStage(stage.id);
        // 注册使用过的人格面具到图鉴
        this.hand.forEach(c => { if (c.cardKey) this.meta.registerPersona(c.cardKey); });
        this.composeSlots.forEach(c => { if (c.cardKey) this.meta.registerPersona(c.cardKey); });
        this.bonusCards.forEach(k => this.meta.registerPersona(k));
        this.meta.save();
      }
      // 不再累加到 player.money（局内资金仅本局有效）
    } else {
      this.log(`💀 战斗失败...`, "dmg");
    }
    // 教程胜利后标记 step 7（返回 Hub 时由 UI 显示局外养成引导）
    if (victory && this.isTutorial && this.tutorialStep === 7) {
      this.tutorialStep = 8;
    }
    this.emit("battleEnd", { victory });
  }

  // 获取当前构筑的合成技能（用于预览，不含阵营增益）
  getComposeResult() {
    return composeSkill(this.composeSlots);
  }

  // 获取含阵营增益的有效技能（用于预览与结算一致）
  getEffectiveComposeSkill() {
    const skill = composeSkill(this.composeSlots);
    if (!skill) return null;
    const eff = { ...skill };
    // 环境减益：力度-1阶（下限 SM）
    if (this.environment.includes("POWER_MINUS_1")) {
      eff.power = Math.max(POWER.SM, eff.power - 1);
      eff._envApplied = true;
    }
    // 愚者：Lv1 首次构筑+1阶；Lv2 首次2次+1阶；Lv3 所有+1阶
    if (this.arcana.bonusKey === "FOOL_FIRST") {
      const lv = this.arcanaLv;
      let bonus = false;
      if (lv === 1 && this.firstComposeThisTurn) bonus = true;
      else if (lv === 2 && this.firstComposeThisTurn) bonus = true;
      else if (lv === 3) bonus = true; // 所有构筑+1阶
      if (bonus) {
        eff.power = Math.min(eff.power + 1, POWER.UL);
        eff.foolBonus = true;
      }
    }
    return eff;
  }
}
