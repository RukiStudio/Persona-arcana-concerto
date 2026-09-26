// ============================================================
// 游戏状态机：回合流程、牌库、战斗结算
// ============================================================
import {
  ARCANA, PERSONAS, MINOR_CARDS, ENEMIES, STAGES,
  CARD_TYPE, RANK, RANK_LABEL, POWER, RANGE, ELEMENT, AFFINITY,
  nextId,
} from "./data.js?v=4";
import { composeSkill, calculateDamage, getActiveSkill } from "./core.js?v=4";

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

export class Game {
  constructor() {
    this.stageIndex = 0;
    this.arcana = ARCANA.FOOL;
    this.player = {
      maxHp: 900, hp: 900, attack: 120,
      critRate: 0.05,
      cupStack: 0,
      money: 120,
      drawCost: 50,
      arcanaBonus: null, // "FIRE_DMG" etc.
      maxReversed: 2, // 场上同时存在的逆位牌上限
    };
    this.deckLevel = 1;
    this.handLimit = 6;
    this.theurgy = 0;
    this.theurgyUses = 0;
    this.theurgyMax = 3;
    this.turn = 0;
    this.state = "IDLE"; // IDLE, PLAYER_ACTION, ENEMY_ACTION, BATTLE_END
    this.deck = [];
    this.hand = [];
    this.composeSlots = []; // 当前构筑中的卡牌
    this.enemies = [];
    this.targetEnemyId = null;
    this.listeners = [];
    this.firstComposeThisTurn = false;
    this.bonusCards = []; // 升级解锁的高阶卡 key（牌库重建时保留）
  }

  on(fn) { this.listeners.push(fn); }
  emit(type, data) { this.listeners.forEach(fn => fn(type, data)); }
  log(msg, cls = "info") { this.emit("log", { msg, cls }); }

  // ---------- 牌库 / 发牌 ----------
  buildDeck() {
    const pool = this.arcana.persona_pool;
    const deck = [];
    // 人格面具卡：每个 2 张
    pool.forEach(key => { deck.push(makePersonaCard(key)); deck.push(makePersonaCard(key)); });
    // 小阿尔卡那
    deck.push(makeMinorCard("wand"));
    deck.push(makeMinorCard("cup")); deck.push(makeMinorCard("cup"));
    deck.push(makeMinorCard("pentacle")); deck.push(makeMinorCard("pentacle"));
    // 宝剑
    deck.push(makeMinorCard("sword_sm")); deck.push(makeMinorCard("sword_md"));
    // 升级解锁的高阶卡（重建时保留）
    this.bonusCards.forEach(key => deck.push(makePersonaCard(key)));
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
    this.emit("state");
    return true;
  }

  // 升级牌库
  upgradeDeck() {
    const costs = [500, 1000, 2000, 4000];
    const cost = costs[this.deckLevel - 1] || 9999;
    if (this.deckLevel >= 5) { this.log("牌库已满级", "info"); return false; }
    if (this.player.money < cost) { this.log("资金不足！", "info"); return false; }
    this.player.money -= cost;
    this.deckLevel++;
    this.handLimit = Math.min(8, this.handLimit + 1);
    // 升级时解锁一张高阶卡（记入 bonusCards，牌库重建时保留）
    const highCards = ["orpheus_tel", "high_pixie"];
    const key = highCards[Math.floor(Math.random() * highCards.length)];
    this.bonusCards.push(key);
    this.deck.push(makePersonaCard(key));
    this.shuffle(this.deck);
    this.log(`牌库升至 Lv.${this.deckLevel}！解锁 ${PERSONAS[key].name}，手牌上限+1`, "gold");
    this.emit("state");
    return true;
  }

  // ---------- 战斗开始 ----------
  startStage(idx) {
    this.stageIndex = idx;
    const stage = STAGES[idx];
    this.enemies = stage.enemies.map((k, i) => {
      const e = ENEMIES[k];
      return {
        id: `e${i}`, key: k, name: e.name, icon: e.icon,
        level: e.level, maxHp: e.hp, hp: e.hp,
        affinities: { ...e.affinities },
        skills: e.skills, attack: e.attack,
        is_knocked_down: false, intent: null,
      };
    });
    // 设置阵营增益
    this.player.arcanaBonus =
      this.arcana.id === "MAGICIAN" ? "FIRE_DMG" :
      this.arcana.id === "LOVERS" ? "HEAL_UP" : null;

    this.bonusCards = []; // 每关重置高阶卡解锁
    this.buildDeck();
    this.theurgy = 0;
    this.theurgyUses = 0;
    this.player.hp = this.player.maxHp;
    this.turn = 0;
    this.log(`【${stage.name}】战斗开始！阵营：${this.arcana.name}`, "info");
    this.emit("stageStart", stage);
    this.startTurn();
  }

  // ---------- 回合流程 ----------
  startTurn() {
    this.turn++;
    this.state = "PLAYER_ACTION";
    this.firstComposeThisTurn = true;
    this.player.cupStack = 0;
    this.player.drawCost = 50;
    // 回合资金：100 + 回合数×20
    const income = 100 + this.turn * 20;
    this.player.money += income;
    this.log(`—— 回合 ${this.turn} ——  获得 ¥${income}`, "info");

    // 发牌：根据牌库等级，每回合发 3~5 张
    const drawNum = Math.min(5, 2 + this.deckLevel);
    this.drawCards(drawNum);

    // 清除总攻击卡
    this.hand = this.hand.filter(c => c.type !== CARD_TYPE.ALL_OUT);

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
    // 清除构筑区
    this.composeSlots = [];
    // 清除圣杯层数
    this.player.cupStack = 0;
    // 移除总攻击卡
    this.hand = this.hand.filter(c => c.type !== CARD_TYPE.ALL_OUT);
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
      this.log(`${e.name} 使用 ${skill.name}`, "dmg");
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
    const mult = { 1: 0.5, 2: 1.0, 3: 1.8, 4: 2.8, 5: 4.0 }[skill.power] || 1;
    return Math.round(enemy.attack * mult);
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
    // 若正→逆，检查场上逆位牌是否已达上限
    if (!card.is_reversed && this.getReversedCount() >= this.player.maxReversed) {
      this.log(`场上逆位牌已达上限 (${this.player.maxReversed}张)`, "info");
      return false;
    }
    card.is_reversed = !card.is_reversed;
    this.log(`${card.name} → ${card.is_reversed ? "逆位" : "正位"}`, "info");
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

    this.hand.splice(idx, 1);
    this.composeSlots.push(card);
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
      this.player.cupStack++;
      this.log(`圣杯层数 +1（当前 ${this.player.cupStack}）`, "gold");
    } else if (card.type === CARD_TYPE.PENTACLE) {
      const gain = 200 + this.turn * 10;
      this.player.money += gain;
      this.log(`星币：获得 ¥${gain}`, "gold");
    } else if (card.type === CARD_TYPE.WAND) {
      // 从牌库检索 rank+1 的随机卡加入手牌
      const higher = this.deck.filter(c => c.type === CARD_TYPE.PERSONA && c.rank >= 2);
      if (higher.length) {
        const pick = higher[Math.floor(Math.random() * higher.length)];
        const di = this.deck.indexOf(pick);
        this.deck.splice(di, 1);
        if (this.hand.length < this.handLimit) {
          this.hand.push(pick);
          this.log(`权杖：获得 ${pick.name}`, "gold");
        } else { this.log("手牌已满，权杖效果失效", "info"); }
      } else { this.log("牌库中没有更高阶卡牌", "info"); }
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
  }

  // 总攻击
  useAllOut(card) {
    const idx = this.hand.findIndex(c => c.id === card.id);
    if (idx < 0) return;
    this.hand.splice(idx, 1);
    this.log(`⚔ 总攻击发动！⚔`, "gold");
    this.executeSkill(card.skill, card);
    this.emit("state");
  }

  // 确认构筑 → 打出合成技能
  confirmCompose() {
    if (this.composeSlots.length === 0) { this.log("构筑区为空", "info"); return false; }
    const skill = this.getEffectiveComposeSkill();
    if (!skill) return false;

    if (skill.foolBonus) {
      this.log(`愚者增益：力度+1阶`, "info");
    }
    this.firstComposeThisTurn = false;

    const names = this.composeSlots.map(c => c.name).join(" + ");
    this.log(`构筑：${names} → ${skill.element} ${skill.range}`, "info");

    this.composeSlots = []; // 消耗卡牌
    this.executeSkill(skill, null);
    this.emit("state");
    this.checkBattleEnd();
    return true;
  }

  // 执行技能（伤害/治疗结算）
  executeSkill(skill, sourceCard) {
    // 恢复 / 辅助
    if (skill.element === ELEMENT.HEAL) {
      let amt = Math.round(this.player.attack * ({1:0.5,2:1.0,3:1.8,4:2.8,5:4.0}[skill.power]||1));
      if (this.player.arcanaBonus === "HEAL_UP") amt = Math.round(amt * 1.3);
      if (skill.range === RANGE.ALL) amt = Math.round(amt * 1.2);
      this.healPlayer(amt);
      return;
    }

    const targets = skill.range === RANGE.ALL
      ? this.enemies.filter(e => e.hp > 0)
      : [this.targetEnemy()].filter(e => e && e.hp > 0);

    if (targets.length === 0) {
      this.log("没有目标", "info");
      return;
    }

    targets.forEach(enemy => {
      const result = calculateDamage(skill, this.player, enemy);
      this.applyDamageResult(enemy, result, skill);
    });

    // 检查所有敌人倒地 → 生成总攻击卡
    this.checkAllOutTrigger();
  }

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

    enemy.hp = Math.max(0, enemy.hp - result.damage);
    this.emit("enemyHit", { enemy, dmg: result.damage, crit: result.isCrit, affinity: result.affinity });

    if (result.damage === 0 && result.affinity === AFFINITY.NULL) {
      this.log(`${enemy.name} 无效化了攻击`, "info");
    } else {
      const affTxt = result.affinity === AFFINITY.WEAK ? "（弱点！）" :
                     result.affinity === AFFINITY.RESIST ? "（耐性）" : "";
      this.log(`对 ${enemy.name} 造成 ${result.damage} 伤害${affTxt}${result.isCrit ? " 暴击！" : ""}`, result.affinity === AFFINITY.WEAK ? "dmg" : "info");

      // 弱点 → 倒地 + 神通法槽+20%
      if (result.affinity === AFFINITY.WEAK) {
        enemy.is_knocked_down = true;
        this.addTheurgy(20);
      }
      // 暴击 → 神通法+10%
      if (result.isCrit) this.addTheurgy(10);
    }

    if (enemy.hp <= 0) {
      this.log(`${enemy.name} 被击倒！`, "dmg");
    }
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
    if (this.enemies.every(e => e.hp <= 0)) {
      this.battleEnd(true);
    } else if (this.player.hp <= 0) {
      this.battleEnd(false);
    }
  }

  battleEnd(victory) {
    this.state = "BATTLE_END";
    if (victory) {
      const stage = STAGES[this.stageIndex];
      this.log(`🎉 胜利！获得 ${stage.reward.exp} 经验，¥${stage.reward.money}`, "gold");
    } else {
      this.log(`💀 战斗失败...`, "dmg");
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
    if (this.arcana.id === "FOOL" && this.firstComposeThisTurn) {
      eff.power = Math.min(eff.power + 1, POWER.XH);
      eff.foolBonus = true;
    }
    return eff;
  }
}
